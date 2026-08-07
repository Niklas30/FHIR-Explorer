"use client";

import { downloadJson, toSafeFilename } from "@/components/overview/utils";
import { loadDatasetResources } from "@fhir-explorer/core/datasets/content";
import type { DatasetRecord } from "@fhir-explorer/core/datasets/storage";
import { type DependencyGraph } from "@fhir-explorer/core/fhir-importer/dependency-graph";
import type {
  ComposeDatasetExport,
  ComposePackageExport,
  ComposeProjectExport,
} from "@fhir-explorer/core/fhir-importer/compose";
import type { PackageRecord, ResourcePayload } from "@fhir-explorer/core/fhir-importer/types";
import type { AuthoredProjectRecord, AuthoredResource } from "@fhir-explorer/core/projects/types";
import { resolveDependencyPackageKeys } from "@fhir-explorer/core/projects/registry-resolution";

/**
 * Export an authored project as a single `fhir-explorer-project` JSON file:
 * the authored package (manifest + its resources), the resolved dependency
 * package closure, and the linked datasets. Compatible with the importer's
 * compose-project format so it round-trips through `/importer`.
 */
export const exportAuthoredProject = async ({
  project,
  resources,
  datasets,
  graph,
  getResourcePayloadsByPackageKeys,
}: {
  project: AuthoredProjectRecord;
  resources: AuthoredResource[];
  datasets: DatasetRecord[];
  graph: DependencyGraph;
  getResourcePayloadsByPackageKeys: (keys: string[]) => Promise<ResourcePayload[]>;
}) => {
  const dependencyKeys = resolveDependencyPackageKeys(project.manifest.dependencies, graph);
  const dependencyRecords = dependencyKeys
    .map((key) => graph.byKey.get(key))
    .filter((record): record is PackageRecord => Boolean(record));

  const payloads = dependencyKeys.length
    ? await getResourcePayloadsByPackageKeys(dependencyKeys)
    : [];
  const payloadsByKey = new Map<string, ResourcePayload[]>();
  for (const payload of payloads) {
    const list = payloadsByKey.get(payload.packageKey) ?? [];
    list.push(payload);
    payloadsByKey.set(payload.packageKey, list);
  }

  const authoredPackage: ComposePackageExport = {
    key: project.key,
    id: project.id,
    version: project.version,
    manifest: project.manifest,
    resources: resources.map((resource) => {
      const content = resource.content as Record<string, unknown>;
      return {
        resourceType: resource.resourceType,
        id: typeof content.id === "string" ? content.id : undefined,
        url: typeof content.url === "string" ? content.url : undefined,
        content: resource.content,
      };
    }),
  };

  const dependencyPackages: ComposePackageExport[] = dependencyRecords.map((pkg) => ({
    key: pkg.key,
    id: pkg.id,
    version: pkg.version,
    manifest: pkg.manifest,
    resources: (payloadsByKey.get(pkg.key) ?? []).map((resource) => ({
      resourceType: resource.resourceType,
      id: resource.id,
      url: resource.url ?? undefined,
      content: resource.content,
    })),
  }));

  const exportDatasets: ComposeDatasetExport[] = datasets.map((dataset) => ({
    id: dataset.id,
    name: dataset.name,
    projectKey: dataset.projectKey,
    resources: loadDatasetResources(dataset.id).map((entry) => entry.content),
  }));

  const payload: ComposeProjectExport = {
    type: "fhir-explorer-project",
    version: 1,
    targetKey: project.key,
    exportedAt: new Date().toISOString(),
    packages: [authoredPackage, ...dependencyPackages],
    datasets: exportDatasets,
  };

  const filename =
    toSafeFilename(`${project.id}-${project.version}-compose.json`) || "compose-project.json";
  downloadJson(filename, payload);
};
