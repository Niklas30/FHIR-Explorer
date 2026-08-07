export const formatText = (template: string, values: Record<string, string | number>) =>
  template.replace(/\{(\w+)\}/g, (_, key) => String(values[key] ?? ""));

export const createDatasetId = () => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `dataset-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
};

export const getTimestamp = () => Date.now();

export const matchesFilter = (
  filter: string,
  record:
    | {
        id?: string;
        version?: string;
        manifest?: { title?: string; name?: string; description?: string };
      }
    | undefined,
  fallbackKey: string
) => {
  if (!filter) return true;
  const haystack = [
    fallbackKey,
    record?.id,
    record?.version,
    record?.manifest?.title,
    record?.manifest?.name,
    record?.manifest?.description,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return haystack.includes(filter);
};

export const formatTimestamp = (timestamp: number) => new Date(timestamp).toLocaleString();

export const downloadBlob = (filename: string, blob: Blob) => {
  if (typeof window === "undefined") return;
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
};

export const downloadJson = (filename: string, payload: unknown) => {
  if (typeof window === "undefined") return;
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json",
  });
  downloadBlob(filename, blob);
};

export const toSafeFilename = (value: string) =>
  value
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+/, "")
    .replace(/-+$/, "");

export const cloneJson = <T,>(value: T): T => {
  if (typeof structuredClone === "function") return structuredClone(value);
  return JSON.parse(JSON.stringify(value)) as T;
};

