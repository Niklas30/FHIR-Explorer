import { logger } from "@fhir-explorer/core/logger";
import type { ResourceStore } from "@fhir-explorer/core/ports";
import {
  isDatasetResource,
  type DatasetResource,
} from "@fhir-explorer/core/datasets/content";

type DatasetResourceStore = Record<string, DatasetResource[]>;

const STORAGE_KEY = "fhir-explorer-dataset-resources";

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
};

const loadStore = (): DatasetResourceStore => {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!isRecord(parsed)) return {};
    const store: DatasetResourceStore = {};
    for (const [datasetId, resources] of Object.entries(parsed)) {
      if (!Array.isArray(resources)) continue;
      store[datasetId] = resources.filter(isDatasetResource);
    }
    return store;
  } catch (error) {
    logger.error("Failed to load dataset resources", { error });
    return {};
  }
};

const saveStore = (store: DatasetResourceStore) => {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch (error) {
    logger.error("Failed to save dataset resources", { error });
  }
};

export const loadDatasetResources = (datasetId: string): DatasetResource[] => {
  const store = loadStore();
  return store[datasetId] ?? [];
};

export const saveDatasetResources = (
  datasetId: string,
  resources: DatasetResource[]
) => {
  const store = loadStore();
  store[datasetId] = resources;
  saveStore(store);
};

export const upsertDatasetResource = (
  datasetId: string,
  resource: DatasetResource
): DatasetResource[] => {
  const current = loadDatasetResources(datasetId);
  const next = [
    resource,
    ...current.filter((entry) => entry.id !== resource.id),
  ];
  saveDatasetResources(datasetId, next);
  return next;
};

export const removeDatasetResource = (
  datasetId: string,
  resourceId: string
): DatasetResource[] => {
  const next = loadDatasetResources(datasetId).filter(
    (entry) => entry.id !== resourceId
  );
  saveDatasetResources(datasetId, next);
  return next;
};

export const clearDatasetResources = (datasetId: string) => {
  const store = loadStore();
  delete store[datasetId];
  saveStore(store);
};

export const clearAllDatasetResources = () => {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    logger.error("Failed to clear dataset resources", { error });
  }
};

/**
 * Port-shaped view of the same localStorage data. localStorage is synchronous,
 * so the promises resolve immediately; hosts that cannot be synchronous (the
 * VS Code file system) implement the port directly instead.
 */
export const localDatasetResourceStore: ResourceStore<DatasetResource> = {
  load: async (datasetId) => loadDatasetResources(datasetId),
  save: async (datasetId, resources) => saveDatasetResources(datasetId, resources),
  clear: async (datasetId) => clearDatasetResources(datasetId),
};
