import { buildPackageKey } from "@fhir-explorer/core/fhir-importer/utils";
import type { PackageRegistryApi } from "@/registry/types";
import { compareVersions, resolveVersionRange } from "@/registry/version";

/**
 * Works out everything that has to be installed, before anything is downloaded.
 *
 * The registry publishes each version's `dependencies`, so the whole tree can
 * be walked over metadata alone. The user then sees one plan — how many
 * packages, which conflicts, what is already on disk — and confirms once,
 * rather than being sent round the loop per missing dependency.
 */

export type PlannedPackage = {
  id: string;
  version: string;
  key: string;
  /** Packages that asked for this one; empty for a root request. */
  requestedBy: string[];
  /** True when the user asked for it directly, not a transitive pull-in. */
  direct: boolean;
  /** Already in the store or the shared cache, so nothing to download. */
  satisfied: boolean;
  /**
   * Download url the registry declared. Registries do not always serve the
   * tarball themselves — packages.fhir.org points at simplifier.net — so the
   * declared url wins over one we construct.
   */
  tarball?: string;
};

export type DependencyConflict = {
  id: string;
  /** Every version that was asked for, with who asked. */
  requested: { version: string; requestedBy: string[] }[];
  /** What the planner settled on — the newest, unless the caller overrides. */
  chosen: string;
};

export type UnresolvedDependency = {
  id: string;
  range: string;
  requestedBy: string[];
  reason: "unknown-package" | "unknown-version";
};

export type InstallPlan = {
  packages: PlannedPackage[];
  conflicts: DependencyConflict[];
  unresolved: UnresolvedDependency[];
};

export type PlanRequest = { id: string; version: string };

export type PlanOptions = {
  /** Lets the planner mark what is already available without downloading. */
  isSatisfied?: (id: string, version: string) => boolean;
  /** Pins chosen by the user in an earlier round, `id -> version`. */
  overrides?: Record<string, string>;
  /** Safety net against a cyclic or absurdly deep dependency graph. */
  maxPackages?: number;
};

type Requested = {
  version: string;
  requestedBy: Set<string>;
  direct: boolean;
};

const DEFAULT_MAX_PACKAGES = 200;

/**
 * Resolve the transitive closure of `roots`.
 *
 * Conflicts do not stop the walk: the newest requested version wins so the
 * user gets a complete picture in one pass, and the conflict is reported for
 * them to override.
 */
export const planInstall = async (
  roots: PlanRequest[],
  registry: PackageRegistryApi,
  options: PlanOptions = {}
): Promise<InstallPlan> => {
  const maxPackages = options.maxPackages ?? DEFAULT_MAX_PACKAGES;
  const overrides = options.overrides ?? {};

  /** Everything asked for so far, keyed by package id. */
  const requested = new Map<string, Requested>();
  /** Download url per resolved `id@version`, taken from the metadata. */
  const tarballs = new Map<string, string>();
  /** Every version ever asked for, so a conflict can be reported in full. */
  const seenVersions = new Map<string, Map<string, Set<string>>>();
  const unresolved: UnresolvedDependency[] = [];
  const queue: { id: string; version: string; by?: string; direct: boolean }[] = [];

  const noteVersion = (id: string, version: string, by?: string) => {
    const versions = seenVersions.get(id) ?? new Map<string, Set<string>>();
    const requesters = versions.get(version) ?? new Set<string>();
    if (by) requesters.add(by);
    versions.set(version, requesters);
    seenVersions.set(id, versions);
  };

  for (const root of roots) {
    queue.push({ id: root.id, version: root.version, direct: true });
  }

  while (queue.length > 0 && requested.size <= maxPackages) {
    const entry = queue.shift();
    if (!entry) break;

    const pinned = overrides[entry.id];
    const wanted = pinned ?? entry.version;
    noteVersion(entry.id, wanted, entry.by);

    const existing = requested.get(entry.id);
    if (existing) {
      if (entry.by) existing.requestedBy.add(entry.by);
      existing.direct ||= entry.direct;
      // Already covered by an equal or newer version — nothing more to walk.
      if (compareVersions(existing.version, wanted) >= 0) continue;
      existing.version = wanted;
    } else {
      requested.set(entry.id, {
        version: wanted,
        requestedBy: new Set(entry.by ? [entry.by] : []),
        direct: entry.direct,
      });
    }

    const metadata = await registry.metadata(entry.id);
    if (!metadata) {
      unresolved.push({
        id: entry.id,
        range: wanted,
        requestedBy: entry.by ? [entry.by] : [],
        reason: "unknown-package",
      });
      continue;
    }

    const available = metadata.versions.map((version) => version.version);
    const resolved = resolveVersionRange(wanted, available, metadata.latest);
    if (!resolved) {
      unresolved.push({
        id: entry.id,
        range: wanted,
        requestedBy: entry.by ? [entry.by] : [],
        reason: "unknown-version",
      });
      continue;
    }

    const target = requested.get(entry.id);
    if (target) target.version = pinned ?? resolved;

    const version = metadata.versions.find(
      (candidate) => candidate.version === (pinned ?? resolved)
    );
    const key = buildPackageKey(entry.id, pinned ?? resolved);
    if (version?.tarball) tarballs.set(key, version.tarball);

    for (const [dependencyId, range] of Object.entries(version?.dependencies ?? {})) {
      queue.push({ id: dependencyId, version: range, by: key, direct: false });
    }
  }

  const packages: PlannedPackage[] = [...requested.entries()]
    .map(([id, entry]) => ({
      id,
      version: entry.version,
      key: buildPackageKey(id, entry.version),
      requestedBy: [...entry.requestedBy].sort(),
      direct: entry.direct,
      satisfied: options.isSatisfied?.(id, entry.version) ?? false,
      tarball: tarballs.get(buildPackageKey(id, entry.version)),
    }))
    // Direct requests first, then alphabetically — the order the plan is read in.
    .sort((a, b) => Number(b.direct) - Number(a.direct) || a.id.localeCompare(b.id));

  const conflicts: DependencyConflict[] = [];
  for (const [id, versions] of seenVersions) {
    if (versions.size < 2) continue;
    const chosen = requested.get(id)?.version;
    if (!chosen) continue;
    conflicts.push({
      id,
      requested: [...versions.entries()]
        .map(([version, requesters]) => ({
          version,
          requestedBy: [...requesters].sort(),
        }))
        .sort((a, b) => compareVersions(b.version, a.version)),
      chosen,
    });
  }

  return { packages, conflicts, unresolved };
};
