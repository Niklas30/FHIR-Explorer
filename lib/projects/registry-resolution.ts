import { buildPackageKey } from "@/lib/fhir-importer/utils";
import { collectDependencies, type DependencyGraph } from "@/lib/fhir-importer/dependency-graph";
import type { PackageManifest, ResourcePayload } from "@/lib/fhir-importer/types";
import type { AuthoredProjectRecord, AuthoredResource } from "@/lib/projects/types";

/**
 * Map a project's authored resources to registry payloads so its own profiles,
 * value sets etc. participate in `buildRegistry`. Shared by the project editor
 * and the dataset editor.
 */
export const toPayloads = (
  projectKey: string,
  resources: AuthoredResource[]
): ResourcePayload[] =>
  resources.map((resource) => {
    const content = resource.content as Record<string, unknown>;
    return {
      key: `${projectKey}:${resource.id}`,
      packageKey: projectKey,
      resourceType: resource.resourceType,
      id: typeof content.id === "string" ? content.id : undefined,
      url: typeof content.url === "string" ? content.url : undefined,
      content: resource.content,
    };
  });

/**
 * Resolve a manifest's dependencies to imported package keys, expanded across
 * the importer dependency graph. A dependency is matched by exact `id@version`
 * key first, then by id (any imported version).
 */
export const resolveDependencyPackageKeys = (
  dependencies: PackageManifest["dependencies"],
  graph: DependencyGraph
): string[] => {
  const keys = new Set<string>();
  for (const [id, version] of Object.entries(dependencies ?? {})) {
    const directKey = buildPackageKey(id, version);
    let rootKey: string | undefined;
    if (graph.byKey.get(directKey)) {
      rootKey = directKey;
    } else {
      for (const record of graph.byKey.values()) {
        if (record.id === id) {
          rootKey = record.key;
          break;
        }
      }
    }
    if (!rootKey) continue;
    keys.add(rootKey);
    for (const depKey of collectDependencies(rootKey, graph)) keys.add(depKey);
  }
  return Array.from(keys);
};

/**
 * The imported package keys whose payloads make up a project's registry.
 *
 * - **authored** project: the dependency closure of its manifest (its own
 *   resources are added separately via {@link toPayloads}).
 * - **imported** project: the package itself plus its resolved dependencies.
 */
export const resolveProjectPackageKeys = ({
  authored,
  projectKey,
  graph,
}: {
  authored: AuthoredProjectRecord | null;
  projectKey: string;
  graph: DependencyGraph;
}): string[] => {
  if (authored) {
    return resolveDependencyPackageKeys(authored.manifest.dependencies, graph);
  }
  return [projectKey, ...collectDependencies(projectKey, graph)];
};
