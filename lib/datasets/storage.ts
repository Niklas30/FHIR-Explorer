export type DatasetRecord = {
  id: string;
  name: string;
  projectKey: string;
  createdAt: number;
};

const STORAGE_KEY = "fhir-compose-datasets";

const sortByNewest = (a: DatasetRecord, b: DatasetRecord) => b.createdAt - a.createdAt;

export const loadDatasets = (): DatasetRecord[] => {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as DatasetRecord[];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (entry) =>
          entry &&
          typeof entry.id === "string" &&
          typeof entry.name === "string" &&
          typeof entry.projectKey === "string" &&
          typeof entry.createdAt === "number"
      )
      .sort(sortByNewest);
  } catch (error) {
    console.error("Failed to load datasets", error);
    return [];
  }
};

export const saveDatasets = (datasets: DatasetRecord[]) => {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(datasets));
  } catch (error) {
    console.error("Failed to save datasets", error);
  }
};

export const upsertDataset = (dataset: DatasetRecord): DatasetRecord[] => {
  const existing = loadDatasets().filter((entry) => entry.id !== dataset.id);
  const next = [dataset, ...existing].sort(sortByNewest);
  saveDatasets(next);
  return next;
};

export const removeDataset = (datasetId: string): DatasetRecord[] => {
  const next = loadDatasets().filter((entry) => entry.id !== datasetId).sort(sortByNewest);
  saveDatasets(next);
  return next;
};

export const removeDatasetsForProject = (projectKey: string): DatasetRecord[] => {
  const next = loadDatasets()
    .filter((entry) => entry.projectKey !== projectKey)
    .sort(sortByNewest);
  saveDatasets(next);
  return next;
};

export const clearDatasets = () => {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    console.error("Failed to clear datasets", error);
  }
};
