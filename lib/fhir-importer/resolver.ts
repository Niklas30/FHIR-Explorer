import type { DependencyRequirement, DependencyState, ImportState, PackageRecord } from "./types";
import { buildPackageKey, isExactVersion, unique } from "./utils";

const normalizeSpec = (spec: string) => spec.trim();

const emptyDependencyState = (): DependencyState => ({
  missing: [],
  resolved: [],
  conflicts: [],
});

const buildImportedVersionMap = (packages: PackageRecord[]) => {
  const importedVersions = new Map<string, Set<string>>();
  for (const pkg of packages) {
    if (!importedVersions.has(pkg.id)) {
      importedVersions.set(pkg.id, new Set());
    }
    importedVersions.get(pkg.id)!.add(pkg.version);
  }
  return importedVersions;
};

const buildScopedPackages = (
  packages: PackageRecord[],
  state: ImportState,
  importedVersions: Map<string, Set<string>>
) => {
  if (!state.currentTarget) return [];

  const targetKey = buildPackageKey(state.currentTarget.id, state.currentTarget.version);
  const byKey = new Map(packages.map((pkg) => [pkg.key, pkg]));
  const target = byKey.get(targetKey);
  if (!target) return [];

  const scoped: PackageRecord[] = [];
  const visited = new Set<string>();
  const queue: PackageRecord[] = [target];

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current || visited.has(current.key)) continue;
    visited.add(current.key);
    scoped.push(current);

    const deps = current.manifest.dependencies ?? {};
    for (const [depId, rawSpec] of Object.entries(deps)) {
      const normalized = normalizeSpec(rawSpec);
      if (!normalized) continue;

      let nextVersion: string | undefined;
      if (isExactVersion(normalized)) {
        nextVersion = normalized;
      } else {
        nextVersion = state.versionSelections[depId];
        if (!nextVersion) {
          const versions = importedVersions.get(depId);
          if (versions?.size === 1) {
            nextVersion = Array.from(versions)[0];
          }
        }
      }

      if (!nextVersion) continue;
      const nextPackage = byKey.get(buildPackageKey(depId, nextVersion));
      if (nextPackage && !visited.has(nextPackage.key)) {
        queue.push(nextPackage);
      }
    }
  }

  return scoped;
};

export const resolveDependencies = (
  packages: PackageRecord[],
  state: ImportState
): DependencyState => {
  const importedVersions = buildImportedVersionMap(packages);
  const scopedPackages = buildScopedPackages(packages, state, importedVersions);
  if (scopedPackages.length === 0) {
    return emptyDependencyState();
  }

  const requirements = new Map<
    string,
    {
      ranges: string[];
      exactVersions: Set<string>;
      requestedBy: Set<string>;
    }
  >();

  for (const pkg of scopedPackages) {
    const deps = pkg.manifest.dependencies ?? {};
    for (const [depId, spec] of Object.entries(deps)) {
      const normalized = normalizeSpec(spec);
      const entry = requirements.get(depId) ?? {
        ranges: [],
        exactVersions: new Set<string>(),
        requestedBy: new Set<string>(),
      };

      entry.ranges.push(normalized);
      if (isExactVersion(normalized)) {
        entry.exactVersions.add(normalized);
      }
      entry.requestedBy.add(pkg.key);

      requirements.set(depId, entry);
    }
  }

  const missing: DependencyRequirement[] = [];
  const resolved: DependencyRequirement[] = [];
  const conflicts: DependencyRequirement[] = [];

  for (const [depId, requirement] of requirements.entries()) {
    const ranges = unique(requirement.ranges);
    const requestedBy = Array.from(requirement.requestedBy);
    const exactVersions = Array.from(requirement.exactVersions);
    const importedForId = importedVersions.get(depId);
    const importedList = importedForId ? Array.from(importedForId) : [];

    let status: DependencyRequirement["status"] = "missing";
    let conflictReason: string | undefined;
    let exactVersion: string | undefined;
    let chosenVersion: string | undefined;

    if (exactVersions.length > 1) {
      status = "conflict";
      conflictReason = "Multiple exact versions required.";
    } else if (exactVersions.length === 1) {
      exactVersion = exactVersions[0];
      status = importedList.includes(exactVersion) ? "resolved" : "missing";
    } else {
      chosenVersion = state.versionSelections[depId];
      if (chosenVersion) {
        status = importedList.includes(chosenVersion) ? "resolved" : "missing";
      } else if (importedList.length === 1) {
        // A range was satisfied by an uploaded package, use it as the chosen version.
        chosenVersion = importedList[0];
        status = "resolved";
      }
    }

    const requirementRecord: DependencyRequirement = {
      id: depId,
      ranges,
      exactVersion,
      chosenVersion,
      requestedBy,
      status,
      conflictReason,
    };

    if (status === "conflict") {
      conflicts.push(requirementRecord);
    } else if (status === "resolved") {
      resolved.push(requirementRecord);
    } else {
      missing.push(requirementRecord);
    }
  }

  return {
    missing: missing.sort((a, b) => a.id.localeCompare(b.id)),
    resolved: resolved.sort((a, b) => a.id.localeCompare(b.id)),
    conflicts: conflicts.sort((a, b) => a.id.localeCompare(b.id)),
  };
};
