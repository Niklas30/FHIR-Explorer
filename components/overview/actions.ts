import JSZip from "jszip";

type ImportedDatasetPayload = {
  id?: string;
  name?: string;
  resources?: unknown[];
};

const isObject = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const getString = (value: unknown): string | undefined =>
  typeof value === "string" ? value : undefined;

const getArray = (value: unknown): unknown[] | undefined => (Array.isArray(value) ? value : undefined);

export const parseJsonOrZipFile = async (file: File, zipNoJsonMessage: string): Promise<unknown> => {
  const lower = file.name.toLowerCase();
  const isZip =
    lower.endsWith(".zip") ||
    file.type === "application/zip" ||
    file.type === "application/x-zip-compressed";

  if (!isZip) {
    const raw = await file.text();
    return JSON.parse(raw);
  }

  const zip = await JSZip.loadAsync(file);
  const jsonEntry = Object.values(zip.files).find(
    (entry) => !entry.dir && entry.name.toLowerCase().endsWith(".json")
  );
  if (!jsonEntry) {
    throw new Error(zipNoJsonMessage);
  }
  const raw = await jsonEntry.async("text");
  return JSON.parse(raw);
};

export const extractImportedDatasetPayload = (parsed: unknown): ImportedDatasetPayload => {
  if (Array.isArray(parsed)) {
    return { resources: parsed };
  }

  if (!isObject(parsed)) {
    return {};
  }

  const datasets = getArray(parsed.datasets);
  if (datasets && datasets.length > 0 && isObject(datasets[0])) {
    const first = datasets[0] as Record<string, unknown>;
    return {
      name: getString(first.name),
      id: getString(first.id),
      resources: getArray(first.resources),
    };
  }

  const resourceType = getString(parsed.resourceType);
  const bundleType = getString(parsed.type);
  if (resourceType === "Bundle" && bundleType === "searchset") {
    const entries = getArray(parsed.entry) ?? [];
    const resources = entries
      .map((entry) => (isObject(entry) ? (entry as Record<string, unknown>).resource : undefined))
      .filter(Boolean) as unknown[];
    return { resources };
  }

  return {
    name: getString(parsed.name),
    id: getString(parsed.id),
    resources: getArray(parsed.resources),
  };
};

