import { logger } from "@fhir-explorer/core/logger";
import {
  DATASETS_STORAGE_KEY,
  isDatasetRecord,
  sortDatasetsByNewest,
  type DatasetRecord,
} from "@fhir-explorer/core/datasets/storage";

export const loadDatasets = (): DatasetRecord[] => {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(DATASETS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as DatasetRecord[];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isDatasetRecord).sort(sortDatasetsByNewest);
  } catch (error) {
    logger.error("Failed to load datasets", { error });
    return [];
  }
};

export const saveDatasets = (datasets: DatasetRecord[]) => {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(DATASETS_STORAGE_KEY, JSON.stringify(datasets));
  } catch (error) {
    logger.error("Failed to save datasets", { error });
  }
};

export const upsertDataset = (dataset: DatasetRecord): DatasetRecord[] => {
  const existing = loadDatasets().filter((entry) => entry.id !== dataset.id);
  const next = [dataset, ...existing].sort(sortDatasetsByNewest);
  saveDatasets(next);
  return next;
};

export const removeDataset = (datasetId: string): DatasetRecord[] => {
  const next = loadDatasets()
    .filter((entry) => entry.id !== datasetId)
    .sort(sortDatasetsByNewest);
  saveDatasets(next);
  return next;
};

export const removeDatasetsForProject = (projectKey: string): DatasetRecord[] => {
  const next = loadDatasets()
    .filter((entry) => entry.projectKey !== projectKey)
    .sort(sortDatasetsByNewest);
  saveDatasets(next);
  return next;
};

export const clearDatasets = () => {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(DATASETS_STORAGE_KEY);
  } catch (error) {
    logger.error("Failed to clear datasets", { error });
  }
};
