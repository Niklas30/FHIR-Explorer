import { logger } from "@/lib/logger";

export type DatasetResource = {
  id: string;
  resourceType: string;
  profile?: string;
  title?: string;
  content: Record<string, unknown>;
  createdAt: number;
  updatedAt: number;
  lastSelectedAt?: number;
};

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
      store[datasetId] = resources.filter(
        (entry): entry is DatasetResource =>
          isRecord(entry) &&
          typeof entry.id === "string" &&
          typeof entry.resourceType === "string" &&
          isRecord(entry.content) &&
          typeof entry.createdAt === "number" &&
          typeof entry.updatedAt === "number" &&
          (typeof entry.lastSelectedAt === "number" ||
            typeof entry.lastSelectedAt === "undefined")
      );
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

export const createDatasetResourceId = () => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `resource-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 8)}`;
};

const extractTitle = (resource: Record<string, unknown>) => {
  const name = resource.name;
  if (typeof name === "string" && name.trim()) return name.trim();
  const title = resource.title;
  if (typeof title === "string" && title.trim()) return title.trim();
  return undefined;
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

export const hydrateDatasetResources = (resources: unknown[]): DatasetResource[] => {
  const now = Date.now();
  const hydrated: DatasetResource[] = [];

  for (const resource of resources ?? []) {
    if (!isRecord(resource)) continue;
    const resourceType = resource.resourceType;
    if (typeof resourceType !== "string") continue;
    const meta = resource.meta;
    const profile =
      isRecord(meta) && Array.isArray(meta.profile)
        ? meta.profile.find((entry) => typeof entry === "string")
        : undefined;

    hydrated.push({
      id:
        typeof resource.id === "string" && resource.id
          ? `${resourceType}-${resource.id}`
          : createDatasetResourceId(),
      resourceType,
      profile,
      title: extractTitle(resource),
      content: resource,
      createdAt: now,
      updatedAt: now,
    });
  }

  return hydrated;
};
