import JSZip from "jszip";
import { hydrateDatasetResources, saveDatasetResources } from "@/lib/datasets/content";
import { upsertDataset, type DatasetRecord } from "@/lib/datasets/storage";
import { logger } from "@/lib/logger";
import type {
  ComposeDatasetExport,
  ComposePackageExport,
  ComposeProjectExport,
} from "@/lib/fhir-importer/compose";
import { isComposeProjectArchive, isComposeProjectExport } from "@/lib/fhir-importer/compose";
import type { useImportWizardText } from "@/components/importer/import-wizard/text";

const createDatasetId = () =>
  `dataset-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

const parseComposeZip = async (file: File): Promise<ComposeProjectExport | null> => {
  try {
    const buffer = await file.arrayBuffer();
    const zip = await JSZip.loadAsync(buffer);
    const manifestFile = zip.file("compose-project.json");
    if (!manifestFile) return null;

    const manifestText = await manifestFile.async("text");
    const manifest = JSON.parse(manifestText);

    if (isComposeProjectExport(manifest)) {
      return manifest;
    }

    if (!isComposeProjectArchive(manifest)) return null;

    const packages: ComposePackageExport[] = [];
    for (const entry of manifest.packages) {
      const pkgFile = zip.file(entry.file);
      if (!pkgFile) continue;
      const pkgText = await pkgFile.async("text");
      packages.push(JSON.parse(pkgText) as ComposePackageExport);
    }

    const datasets: ComposeDatasetExport[] = [];
    for (const entry of manifest.datasets ?? []) {
      const datasetFile = zip.file(entry.file);
      if (!datasetFile) continue;
      const datasetText = await datasetFile.async("text");
      datasets.push(JSON.parse(datasetText) as ComposeDatasetExport);
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
    logger.error("Failed to parse compose project zip", { error: err });
    return null;
  }
};

const importComposeBundle = async ({
  bundle,
  importComposeProject,
  text,
  format,
}: {
  bundle: ComposeProjectExport;
  importComposeProject: (bundle: ComposeProjectExport) => Promise<{
    imported: number;
    skipped: number;
  } | null>;
  text: ReturnType<typeof useImportWizardText>["text"];
  format: ReturnType<typeof useImportWizardText>["format"];
}) => {
  const result = await importComposeProject(bundle);
  if (!result) {
    return text.failedComposeProjectImport;
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

  return format(text.composeProjectImported, {
    imported: result.imported,
    skipped: result.skipped,
  });
};

export const maybeImportComposeProject = async ({
  file,
  importComposeProject,
  text,
  format,
}: {
  file: File;
  importComposeProject: (bundle: ComposeProjectExport) => Promise<{
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
      const bundle = await parseComposeZip(file);
      if (!bundle) return null;
      return await importComposeBundle({ bundle, importComposeProject, text, format });
    }

    if (!isJson) return null;
    const content = await file.text();
    const parsed = JSON.parse(content);
    if (!isComposeProjectExport(parsed)) {
      return null;
    }
    return await importComposeBundle({ bundle: parsed, importComposeProject, text, format });
  } catch (err) {
    logger.error("Failed to import compose project bundle", { error: err });
    return text.failedComposeProjectImport;
  }
};
