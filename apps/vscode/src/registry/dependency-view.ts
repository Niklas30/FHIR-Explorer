import { buildDependencyGraph } from "@fhir-explorer/core/fhir-importer/dependency-graph";
import type {
  DependencyGraph,
  DependencyEdge,
} from "@fhir-explorer/core/fhir-importer/dependency-graph";
import type { PackageRecord } from "@fhir-explorer/core/fhir-importer/types";
import type { WorkspaceProject } from "@/workspace/project-discovery";

/**
 * The dependency graph of a workspace project.
 *
 * The project itself is not an imported package — it is a folder — but the
 * graph builder works on package records, so it is presented as one. Tree and
 * graph then read the same structure and cannot disagree about what depends on
 * what.
 */

/** Make the project look like the package it declares itself to be. */
export const projectAsPackageRecord = (project: WorkspaceProject): PackageRecord => ({
  key: project.key,
  id: project.manifest.name,
  version: project.manifest.version,
  manifest: project.manifest,
  addedAt: 0,
  resourceCount: 0,
});

export const buildProjectDependencyGraph = (
  project: WorkspaceProject,
  installed: PackageRecord[]
): DependencyGraph =>
  buildDependencyGraph([
    projectAsPackageRecord(project),
    // A package with the project's own key would shadow the synthesised root.
    ...installed.filter((entry) => entry.key !== project.key),
  ]);

export type DependencyNode = {
  /** Graph key: `id@version`, or `missing:id@requirement`. */
  key: string;
  id: string;
  /** Resolved version, or the unmet requirement when missing. */
  version: string;
  resolved: boolean;
  /** Human label, falling back to the id when the manifest has no title. */
  title: string;
  /** True once this key has already appeared higher up — stop recursing. */
  repeated: boolean;
  /**
   * Declared by the project itself rather than pulled in by another package.
   * Only these can be updated or removed — a transitive version is decided by
   * whoever depends on it.
   */
  direct: boolean;
};

const nodeFor = (
  graph: DependencyGraph,
  edge: DependencyEdge,
  seen: Set<string>,
  direct: boolean
): DependencyNode => {
  const record = graph.byKey.get(edge.toKey);
  return {
    key: edge.toKey,
    id: edge.dependencyId,
    version: record?.version ?? edge.requirement,
    resolved: edge.resolved,
    title: record?.manifest.title ?? record?.manifest.name ?? edge.dependencyId,
    repeated: seen.has(edge.toKey),
    direct,
  };
};

/**
 * Direct dependencies of one node, sorted so unmet ones come first — those are
 * the actionable entries.
 */
export const childrenOf = (
  graph: DependencyGraph,
  key: string,
  ancestors: Set<string>,
  direct = false
): DependencyNode[] =>
  [...(graph.adjacency.get(key) ?? [])]
    .map((edge) => nodeFor(graph, edge, ancestors, direct))
    .sort(
      (a, b) => Number(a.resolved) - Number(b.resolved) || a.id.localeCompare(b.id)
    );

/** Every package reachable from the root, for a count in the view title. */
export const reachableCount = (graph: DependencyGraph, rootKey: string): number => {
  const seen = new Set<string>();
  const queue = [rootKey];
  while (queue.length > 0) {
    const key = queue.shift();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    for (const edge of graph.adjacency.get(key) ?? []) queue.push(edge.toKey);
  }
  seen.delete(rootKey);
  return seen.size;
};
