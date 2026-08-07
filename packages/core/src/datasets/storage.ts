export type DatasetRecord = {
  id: string;
  name: string;
  projectKey: string;
  createdAt: number;
};

export const DATASETS_STORAGE_KEY = "fhir-explorer-datasets";

export const sortDatasetsByNewest = (a: DatasetRecord, b: DatasetRecord) =>
  b.createdAt - a.createdAt;

export const isDatasetRecord = (entry: unknown): entry is DatasetRecord =>
  Boolean(
    entry &&
      typeof entry === "object" &&
      typeof (entry as DatasetRecord).id === "string" &&
      typeof (entry as DatasetRecord).name === "string" &&
      typeof (entry as DatasetRecord).projectKey === "string" &&
      typeof (entry as DatasetRecord).createdAt === "number"
  );
