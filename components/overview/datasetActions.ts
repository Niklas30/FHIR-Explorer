"use client";

import JSZip from "jszip";
import { toast } from "sonner";
import type { PackageRecord } from "@/lib/fhir-importer/types";
import {
  removeDataset,
  removeDatasetsForProject,
  upsertDataset,
  type DatasetRecord,
} from "@/lib/datasets/storage";
import {
  clearDatasetResources,
  hydrateDatasetResources,
  loadDatasetResources,
  saveDatasetResources,
} from "@/lib/datasets/content";
import type { OverviewText } from "@/components/overview/types";
import {
  cloneJson,
  createDatasetId,
  downloadBlob,
  downloadJson,
  formatText,
  getTimestamp,
  toSafeFilename,
} from "@/components/overview/utils";
import { extractImportedDatasetPayload, parseJsonOrZipFile } from "@/components/overview/actions";

type DatasetListSetter = (next: DatasetRecord[]) => void;

export const createDatasetAction = ({
  selectedProject,
  datasetName,
  isProjectDatasetSelectable,
  text,
  setDatasets,
  onClose,
}: {
  selectedProject: PackageRecord | null;
  datasetName: string;
  isProjectDatasetSelectable: (projectKey: string) => boolean;
  text: OverviewText;
  setDatasets: DatasetListSetter;
  onClose: () => void;
}) => {
  if (!selectedProject) {
    toast.error(text.selectProjectForDataset);
    return;
  }
  if (!isProjectDatasetSelectable(selectedProject.key)) {
    toast.error(text.datasetActionsBlockedUntilImportComplete);
    return;
  }
  const name = datasetName.trim();
  if (!name) {
    toast.error(text.datasetNameRequired);
    return;
  }
  const dataset: DatasetRecord = {
    id: createDatasetId(),
    name,
    projectKey: selectedProject.key,
    createdAt: Date.now(),
  };
  const next = upsertDataset(dataset);
  saveDatasetResources(dataset.id, []);
  setDatasets(next);
  onClose();
  toast.success(text.datasetCreated);
};

export const importDatasetAction = async ({
  selectedProject,
  datasetName,
  importDatasetFile,
  isProjectDatasetSelectable,
  text,
  setDatasets,
  onClose,
  onClearImportFile,
}: {
  selectedProject: PackageRecord | null;
  datasetName: string;
  importDatasetFile: File | null;
  isProjectDatasetSelectable: (projectKey: string) => boolean;
  text: OverviewText;
  setDatasets: DatasetListSetter;
  onClose: () => void;
  onClearImportFile: () => void;
}) => {
  if (!selectedProject) {
    toast.error(text.selectProjectForDataset);
    return;
  }
  if (!isProjectDatasetSelectable(selectedProject.key)) {
    toast.error(text.datasetActionsBlockedUntilImportComplete);
    return;
  }
  if (!importDatasetFile) {
    toast.error(text.chooseDatasetFile);
    return;
  }

  try {
    const parsed = await parseJsonOrZipFile(importDatasetFile, text.zipNoJson);
    const extracted = extractImportedDatasetPayload(parsed);

    const name = (extracted.name ?? datasetName).trim();
    if (!name) {
      toast.error(text.datasetNameMissingImport);
      return;
    }

    const dataset: DatasetRecord = {
      id: extracted.id ?? createDatasetId(),
      name,
      projectKey: selectedProject.key,
      createdAt: Date.now(),
    };
    const resources = hydrateDatasetResources(Array.isArray(extracted.resources) ? extracted.resources : []);
    saveDatasetResources(dataset.id, resources);
    const next = upsertDataset(dataset);
    setDatasets(next);
    onClose();
    onClearImportFile();
    toast.success(text.datasetImported);
  } catch (error) {
    toast.error(text.datasetImportFailed);
    console.error(error);
  }
};

export const deleteDatasetAction = ({
  dataset,
  text,
  setDatasets,
}: {
  dataset: DatasetRecord;
  text: OverviewText;
  setDatasets: DatasetListSetter;
}) => {
  const ok = window.confirm(formatText(text.confirmDeleteDataset, { name: dataset.name }));
  if (!ok) return;
  clearDatasetResources(dataset.id);
  const next = removeDataset(dataset.id);
  setDatasets(next);
  toast.success(text.datasetDeleted);
};

export const duplicateDatasetAction = ({
  dataset,
  datasets,
  isProjectDatasetSelectable,
  text,
  setDatasets,
}: {
  dataset: DatasetRecord;
  datasets: DatasetRecord[];
  isProjectDatasetSelectable: (projectKey: string) => boolean;
  text: OverviewText;
  setDatasets: DatasetListSetter;
}) => {
  if (!isProjectDatasetSelectable(dataset.projectKey)) {
    toast.error(text.datasetActionsBlockedUntilImportComplete);
    return;
  }

  const baseName = formatText(text.duplicateDatasetName, { name: dataset.name });
  const existingNames = new Set(
    datasets.filter((entry) => entry.projectKey === dataset.projectKey).map((entry) => entry.name)
  );
  let name = baseName;
  for (let i = 2; existingNames.has(name); i += 1) {
    name = `${baseName} ${i}`;
  }

  const duplicated: DatasetRecord = {
    id: createDatasetId(),
    name,
    projectKey: dataset.projectKey,
    createdAt: getTimestamp(),
  };

  const resources = loadDatasetResources(dataset.id);
  const copiedResources = resources.map((resource) => ({
    ...resource,
    content: cloneJson(resource.content),
    createdAt: duplicated.createdAt,
    updatedAt: duplicated.createdAt,
    lastSelectedAt: undefined,
  }));
  saveDatasetResources(duplicated.id, copiedResources);

  const next = upsertDataset(duplicated);
  setDatasets(next);
  toast.success(formatText(text.datasetDuplicated, { name: duplicated.name }));
};

export const exportDatasetFile = async ({
  dataset,
  resources,
  mode,
  exportFormat,
}: {
  dataset: DatasetRecord;
  resources: unknown[];
  mode: "package" | "resources" | "searchset";
  exportFormat: "json" | "zip";
}) => {
  const safeName = toSafeFilename(dataset.name) || "dataset";
  let payload: unknown;
  let filename = `${safeName}.json`;
  let zipName = `${safeName}.zip`;

  if (mode === "package") {
    payload = { id: dataset.id, name: dataset.name, projectKey: dataset.projectKey, resources };
  } else if (mode === "resources") {
    payload = resources;
    filename = `${safeName}-resources.json`;
    zipName = `${safeName}-resources.zip`;
  } else {
    payload = {
      resourceType: "Bundle",
      type: "searchset",
      total: resources.length,
      entry: resources.map((resource) => ({ resource })),
    };
    filename = `${safeName}-searchset.json`;
    zipName = `${safeName}-searchset.zip`;
  }

  if (exportFormat === "json") {
    downloadJson(filename, payload);
    return;
  }

  const zip = new JSZip();
  zip.file(filename, JSON.stringify(payload, null, 2));
  const blob = await zip.generateAsync({ type: "blob" });
  downloadBlob(zipName, blob);
};

export const exportDatasetAction = async ({
  dataset,
  mode,
  exportFormat,
  text,
}: {
  dataset: DatasetRecord;
  mode: "package" | "resources" | "searchset";
  exportFormat: "json" | "zip";
  text: Pick<OverviewText, "datasetExported">;
}) => {
  const resources = loadDatasetResources(dataset.id).map((entry) => entry.content);
  await exportDatasetFile({ dataset, resources, mode, exportFormat });
  toast.success(text.datasetExported);
};

export const deleteProjectAction = async ({
  project,
  canDeleteProject,
  text,
  deletePackage,
  datasets,
  setDatasets,
}: {
  project: PackageRecord;
  canDeleteProject: (projectKey: string) => boolean;
  text: OverviewText;
  deletePackage: (packageKey: string) => Promise<void>;
  datasets: DatasetRecord[];
  setDatasets: DatasetListSetter;
}) => {
  if (!canDeleteProject(project.key)) {
    toast.error(text.projectRequiredByOthers);
    return;
  }
  const ok = window.confirm(
    formatText(text.confirmDeleteProject, {
      project: `${project.id}@${project.version}`,
    })
  );
  if (!ok) return;
  await deletePackage(project.key);
  const datasetIds = datasets.filter((dataset) => dataset.projectKey === project.key).map((dataset) => dataset.id);
  for (const datasetId of datasetIds) {
    clearDatasetResources(datasetId);
  }
  const next = removeDatasetsForProject(project.key);
  setDatasets(next);
  toast.success(text.projectDeleted);
};
