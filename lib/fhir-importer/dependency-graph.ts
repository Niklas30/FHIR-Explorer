import type { PackageRecord } from "@/lib/fhir-importer/types";
import { buildPackageKey, isExactVersion } from "@/lib/fhir-importer/utils";

export type DependencyEdge = {
  fromKey: string;
  toKey: string;
  dependencyId: string;
  requirement: string;
  resolved: boolean;
};

export type DependencyGraph = {
  byKey: Map<string, PackageRecord>;
  adjacency: Map<string, DependencyEdge[]>;
};

const buildMissingDependencyKey = (dependencyId: string, requirement: string) =>
  `missing:${dependencyId}@${requirement}`;

export const buildDependencyGraph = (packages: PackageRecord[]): DependencyGraph => {
  const byKey = new Map<string, PackageRecord>();
  const byId = new Map<string, PackageRecord[]>();

  for (const pkg of packages) {
    byKey.set(pkg.key, pkg);
    const list = byId.get(pkg.id) ?? [];
    list.push(pkg);
    byId.set(pkg.id, list);
  }

  const adjacency = new Map<string, DependencyEdge[]>();

  for (const pkg of packages) {
    const deps = pkg.manifest.dependencies ?? {};
    const edges: DependencyEdge[] = [];
    const seen = new Set<string>();

    for (const [dependencyId, spec] of Object.entries(deps)) {
      const requirement = spec.trim();
      if (!requirement) continue;

      if (isExactVersion(requirement)) {
        const dependencyKey = buildPackageKey(dependencyId, requirement);
        if (byKey.has(dependencyKey)) {
          const dedupeKey = `resolved:${dependencyKey}:${requirement}`;
          if (!seen.has(dedupeKey)) {
            seen.add(dedupeKey);
            edges.push({
              fromKey: pkg.key,
              toKey: dependencyKey,
              dependencyId,
              requirement,
              resolved: true,
            });
          }
          continue;
        }

        const missingKey = buildMissingDependencyKey(dependencyId, requirement);
        const dedupeKey = `missing:${missingKey}`;
        if (!seen.has(dedupeKey)) {
          seen.add(dedupeKey);
          edges.push({
            fromKey: pkg.key,
            toKey: missingKey,
            dependencyId,
            requirement,
            resolved: false,
          });
        }
        continue;
      }

      const candidates = byId.get(dependencyId) ?? [];
      if (candidates.length === 0) {
        const missingKey = buildMissingDependencyKey(dependencyId, requirement);
        const dedupeKey = `missing:${missingKey}`;
        if (!seen.has(dedupeKey)) {
          seen.add(dedupeKey);
          edges.push({
            fromKey: pkg.key,
            toKey: missingKey,
            dependencyId,
            requirement,
            resolved: false,
          });
        }
        continue;
      }

      for (const candidate of candidates) {
        const dedupeKey = `resolved:${candidate.key}:${requirement}`;
        if (seen.has(dedupeKey)) continue;
        seen.add(dedupeKey);
        edges.push({
          fromKey: pkg.key,
          toKey: candidate.key,
          dependencyId,
          requirement,
          resolved: true,
        });
      }
    }

    adjacency.set(pkg.key, edges);
  }

  return { byKey, adjacency };
};

export const collectDependencies = (targetKey: string, graph: DependencyGraph): Set<string> => {
  const { adjacency, byKey } = graph;
  const visited = new Set<string>();
  const dependencies = new Set<string>();
  const queue = [targetKey];

  while (queue.length > 0) {
    const key = queue.shift();
    if (!key || visited.has(key)) continue;
    visited.add(key);

    const edges = adjacency.get(key) ?? [];
    for (const edge of edges) {
      if (!edge.resolved || !byKey.has(edge.toKey)) continue;
      if (!visited.has(edge.toKey)) {
        dependencies.add(edge.toKey);
        queue.push(edge.toKey);
      }
    }
  }

  dependencies.delete(targetKey);
  return dependencies;
};
