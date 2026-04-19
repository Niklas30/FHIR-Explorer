"use client";

import JSZip from "jszip";
import { toast } from "sonner";
import type { PackageRecord, ResourcePayload } from "@/lib/fhir-importer/types";
import type { DependencyGraph } from "@/lib/fhir-importer/dependency-graph";
import { collectDependencies } from "@/lib/fhir-importer/dependency-graph";
import type {
  ComposeDatasetExport,
  ComposePackageExport,
  ComposeProjectArchiveManifest,
  ComposeProjectExport,
} from "@/lib/fhir-importer/compose";
import type { DatasetRecord } from "@/lib/datasets/storage";
import { loadDatasetResources } from "@/lib/datasets/content";
import type { OverviewText } from "@/components/overview/types";
import { downloadBlob, downloadJson, toSafeFilename } from "@/components/overview/utils";

type ProjectExportText = Pick<OverviewText, "noPackagesToExport" | "projectExported">;

export const prepareProjectExport = async ({
  project,
  includeDatasets,
  graph,
  datasets,
  getResourcePayloadsByPackageKeys,
  text,
}: {
  project: PackageRecord;
  includeDatasets: boolean;
  graph: DependencyGraph;
  datasets: DatasetRecord[];
  getResourcePayloadsByPackageKeys: (keys: string[]) => Promise<ResourcePayload[]>;
  text: ProjectExportText;
}): Promise<{
  projectKeys: Set<string>;
  exportPackages: ComposePackageExport[];
  exportDatasets: ComposeDatasetExport[];
} | null> => {
  const dependencyKeys = collectDependencies(project.key, graph);
  const projectKeys = new Set<string>([project.key, ...dependencyKeys]);
  const packageRecords = Array.from(projectKeys)
    .map((key) => graph.byKey.get(key))
    .filter((record): record is PackageRecord => Boolean(record));

  if (packageRecords.length === 0) {
    toast.error(text.noPackagesToExport);
    return null;
  }

  const payloads = await getResourcePayloadsByPackageKeys(Array.from(projectKeys));
  const payloadsByKey = new Map<string, ResourcePayload[]>();
  for (const payload of payloads) {
    const list = payloadsByKey.get(payload.packageKey) ?? [];
    list.push(payload);
    payloadsByKey.set(payload.packageKey, list);
  }

  const exportPackages: ComposePackageExport[] = packageRecords.map((pkg) => ({
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

  const exportDatasets: ComposeDatasetExport[] = includeDatasets
    ? datasets
        .filter((dataset) => projectKeys.has(dataset.projectKey))
        .map((dataset) => ({
          id: dataset.id,
          name: dataset.name,
          projectKey: dataset.projectKey,
          resources: loadDatasetResources(dataset.id).map((entry) => entry.content),
        }))
    : [];

  return { projectKeys, exportPackages, exportDatasets };
};

export const exportProject = async ({
  project,
  includeDatasets,
  exportFormat,
  graph,
  datasets,
  getResourcePayloadsByPackageKeys,
  text,
}: {
  project: PackageRecord;
  includeDatasets: boolean;
  exportFormat: "json" | "zip";
  graph: DependencyGraph;
  datasets: DatasetRecord[];
  getResourcePayloadsByPackageKeys: (keys: string[]) => Promise<ResourcePayload[]>;
  text: ProjectExportText;
}) => {
  const prepared = await prepareProjectExport({
    project,
    includeDatasets,
    graph,
    datasets,
    getResourcePayloadsByPackageKeys,
    text,
  });
  if (!prepared) return;

  if (exportFormat === "json") {
    const payload: ComposeProjectExport = {
      type: "health-compose-project",
      version: 1,
      targetKey: project.key,
      exportedAt: new Date().toISOString(),
      packages: prepared.exportPackages,
      datasets: prepared.exportDatasets,
    };

    const filename = toSafeFilename(`${project.id}-${project.version}-compose.json`) || "compose-project.json";
    downloadJson(filename, payload);
    toast.success(text.projectExported);
    return;
  }

  const zip = new JSZip();
  const packagesFolder = zip.folder("packages");
  const datasetsFolder = zip.folder("datasets");

  const packageEntries = prepared.exportPackages.map((pkg) => {
    const filename = toSafeFilename(`${pkg.key}.json`) || "package.json";
    packagesFolder?.file(filename, JSON.stringify(pkg, null, 2));
    return {
      key: pkg.key,
      id: pkg.id,
      version: pkg.version,
      manifest: pkg.manifest,
      file: `packages/${filename}`,
    };
  });

  const datasetEntries = prepared.exportDatasets.map((dataset, index) => {
    const baseName = toSafeFilename(dataset.id ?? dataset.name) || `dataset-${index + 1}`;
    const filename = `${baseName}.json`;
    datasetsFolder?.file(filename, JSON.stringify(dataset, null, 2));
    return {
      id: dataset.id,
      name: dataset.name,
      projectKey: dataset.projectKey,
      file: `datasets/${filename}`,
    };
  });

  const manifest: ComposeProjectArchiveManifest = {
    type: "health-compose-project-archive",
    version: 1,
    targetKey: project.key,
    exportedAt: new Date().toISOString(),
    packages: packageEntries,
    datasets: includeDatasets ? datasetEntries : undefined,
  };

  zip.file("compose-project.json", JSON.stringify(manifest, null, 2));
  const blob = await zip.generateAsync({ type: "blob" });
  const filename = toSafeFilename(`${project.id}-${project.version}-compose.zip`) || "compose-project.zip";
  downloadBlob(filename, blob);
  toast.success(text.projectExported);
};
