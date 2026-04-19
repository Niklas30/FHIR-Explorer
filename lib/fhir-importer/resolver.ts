import type { DependencyRequirement, DependencyState, ImportState, PackageRecord } from "./types";
import { buildPackageKey, isExactVersion, unique } from "./utils";

const normalizeSpec = (spec: string) => spec.trim();

export const resolveDependencies = (
  packages: PackageRecord[],
  state: ImportState
): DependencyState => {
  if (!state.currentTarget) {
    return { missing: [], resolved: [], conflicts: [] };
  }

  const packagesByKey = new Map(packages.map((pkg) => [pkg.key, pkg] as const));
  const requirements = new Map<
    string,
    {
      ranges: string[];
      exactVersions: Set<string>;
      requestedBy: Set<string>;
    }
  >();

  const importedVersions = new Map<string, Set<string>>();

  for (const pkg of packages) {
    if (!importedVersions.has(pkg.id)) {
      importedVersions.set(pkg.id, new Set());
    }
    importedVersions.get(pkg.id)!.add(pkg.version);
  }

  const visitedKeys = new Set<string>();
  const queue: string[] = [
    buildPackageKey(state.currentTarget.id, state.currentTarget.version),
  ];

  while (queue.length > 0) {
    const pkgKey = queue.shift();
    if (!pkgKey || visitedKeys.has(pkgKey)) continue;
    visitedKeys.add(pkgKey);

    const pkg = packagesByKey.get(pkgKey);
    if (!pkg) continue;

    const deps = pkg.manifest.dependencies ?? {};
    for (const [depId, spec] of Object.entries(deps)) {
      const normalized = normalizeSpec(spec);
      if (!normalized) continue;

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

      const importedList = Array.from(importedVersions.get(depId) ?? []);

      if (isExactVersion(normalized)) {
        const depKey = buildPackageKey(depId, normalized);
        if (importedList.includes(normalized) && packagesByKey.has(depKey)) {
          queue.push(depKey);
        }
        continue;
      }

      const chosen = state.versionSelections[depId];
      const selected =
        chosen && importedList.includes(chosen)
          ? chosen
          : !chosen && importedList.length === 1
            ? importedList[0]
            : undefined;
      if (!selected) continue;

      const depKey = buildPackageKey(depId, selected);
      if (packagesByKey.has(depKey)) {
        queue.push(depKey);
      }
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
      } else {
        status = "missing";
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
