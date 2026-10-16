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

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
};

/** Narrow an untrusted entry read back from storage into a DatasetResource. */
export const isDatasetResource = (entry: unknown): entry is DatasetResource =>
  isRecord(entry) &&
  typeof entry.id === "string" &&
  typeof entry.resourceType === "string" &&
  isRecord(entry.content) &&
  typeof entry.createdAt === "number" &&
  typeof entry.updatedAt === "number" &&
  (typeof entry.lastSelectedAt === "number" ||
    typeof entry.lastSelectedAt === "undefined");

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
