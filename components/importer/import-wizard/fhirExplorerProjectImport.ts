import JSZip from "jszip";
import { hydrateDatasetResources, saveDatasetResources } from "@/lib/datasets/content";
import { upsertDataset, type DatasetRecord } from "@/lib/datasets/storage";
import { logger } from "@/lib/logger";
import type {
  FhirExplorerDatasetExport,
  FhirExplorerPackageExport,
  FhirExplorerProjectExport,
} from "@/lib/fhir-importer/fhir-explorer";
import { isFhirExplorerProjectArchive, isFhirExplorerProjectExport } from "@/lib/fhir-importer/fhir-explorer";
import type { useImportWizardText } from "@/components/importer/import-wizard/text";

const createDatasetId = () =>
  `dataset-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

const parseFhirExplorerZip = async (file: File): Promise<FhirExplorerProjectExport | null> => {
  try {
    const buffer = await file.arrayBuffer();
    const zip = await JSZip.loadAsync(buffer);
    const manifestFile =
      zip.file("fhir-explorer-project.json") ?? zip.file("compose-project.json");
    if (!manifestFile) return null;

    const manifestText = await manifestFile.async("text");
    const manifest = JSON.parse(manifestText);

    if (isFhirExplorerProjectExport(manifest)) {
      return manifest;
    }

    if (!isFhirExplorerProjectArchive(manifest)) return null;

    const packages: FhirExplorerPackageExport[] = [];
    for (const entry of manifest.packages) {
      const pkgFile = zip.file(entry.file);
      if (!pkgFile) continue;
      const pkgText = await pkgFile.async("text");
      packages.push(JSON.parse(pkgText) as FhirExplorerPackageExport);
    }

    const datasets: FhirExplorerDatasetExport[] = [];
    for (const entry of manifest.datasets ?? []) {
      const datasetFile = zip.file(entry.file);
      if (!datasetFile) continue;
      const datasetText = await datasetFile.async("text");
      datasets.push(JSON.parse(datasetText) as FhirExplorerDatasetExport);
    }

    return {
      type: "fhir-explorer-project",
      version: 1,
      targetKey: manifest.targetKey,
      exportedAt: manifest.exportedAt,
      packages,
      datasets,
    };
  } catch (err) {
    logger.error("Failed to parse fhir explorer project zip", { error: err });
    return null;
  }
};

const importFhirExplorerBundle = async ({
  bundle,
  importFhirExplorerProject,
  text,
  format,
}: {
  bundle: FhirExplorerProjectExport;
  importFhirExplorerProject: (bundle: FhirExplorerProjectExport) => Promise<{
    imported: number;
    skipped: number;
  } | null>;
  text: ReturnType<typeof useImportWizardText>["text"];
  format: ReturnType<typeof useImportWizardText>["format"];
}) => {
  const result = await importFhirExplorerProject(bundle);
  if (!result) {
    return text.failedFhirExplorerProjectImport;
  }

  const datasets = bundle.datasets ?? [];
  if (datasets.length > 0) {
    for (const dataset of datasets) {
      if (!dataset?.name) continue;
      const datasetId = dataset.id ?? createDatasetId();
      const record: DatasetRecord = {
        id: datasetId,
        name: dataset.name,
        projectKey: dataset.projectKey ?? bundle.targetKey ?? "imported",
        createdAt: Date.now(),
      };
      upsertDataset(record);
      const resources = hydrateDatasetResources(
        Array.isArray(dataset.resources) ? dataset.resources : []
      );
      saveDatasetResources(datasetId, resources);
    }
  }

  return format(text.fhirExplorerProjectImported, {
    imported: result.imported,
    skipped: result.skipped,
  });
};

export const maybeImportFhirExplorerProject = async ({
  file,
  importFhirExplorerProject,
  text,
  format,
}: {
  file: File;
  importFhirExplorerProject: (bundle: FhirExplorerProjectExport) => Promise<{
    imported: number;
    skipped: number;
  } | null>;
  text: ReturnType<typeof useImportWizardText>["text"];
  format: ReturnType<typeof useImportWizardText>["format"];
}) => {
  const name = file.name.toLowerCase();
  const isJson =
    name.endsWith(".json") || file.type === "application/json" || file.type === "text/json";
  const isZip = name.endsWith(".zip") || file.type === "application/zip";

  try {
    if (isZip) {
      const bundle = await parseFhirExplorerZip(file);
      if (!bundle) return null;
      return await importFhirExplorerBundle({ bundle, importFhirExplorerProject, text, format });
    }

    if (!isJson) return null;
    const content = await file.text();
    const parsed = JSON.parse(content);
    if (!isFhirExplorerProjectExport(parsed)) {
      return null;
    }
    return await importFhirExplorerBundle({ bundle: parsed, importFhirExplorerProject, text, format });
  } catch (err) {
    logger.error("Failed to import fhir explorer project bundle", { error: err });
    return text.failedFhirExplorerProjectImport;
  }
};
