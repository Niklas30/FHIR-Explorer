import type { DatasetResource } from "@/lib/datasets/content";

type TraverseOptions = {
  maxNodes?: number;
  maxDepth?: number;
};

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
};

const normalizeReference = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed || trimmed.startsWith("#")) return null;

  const segments = trimmed.split("/").filter(Boolean);
  if (segments.length < 2) return null;

  const resourceType = segments[segments.length - 2];
  const id = segments[segments.length - 1];
  if (!resourceType || !id) return null;

  return `${resourceType}/${id}`;
};

const resolveResourceId = (resource: DatasetResource) => {
  const contentId = resource.content.id;
  if (typeof contentId === "string" && contentId.trim()) return contentId.trim();

  const prefix = `${resource.resourceType}-`;
  if (resource.id.startsWith(prefix)) return resource.id.slice(prefix.length);

  return resource.id;
};

export const buildDatasetReferenceIndex = (resources: DatasetResource[]) => {
  const index = new Set<string>();

  for (const resource of resources) {
    const id = resolveResourceId(resource);
    if (!id) continue;
    index.add(`${resource.resourceType}/${id}`);
  }

  return index;
};

export const isBrokenLocalReference = (reference: string, referenceIndex: Set<string>) => {
  const normalized = normalizeReference(reference);
  if (!normalized) return false;
  return !referenceIndex.has(normalized);
};

export const collectBrokenReferences = (
  content: unknown,
  referenceIndex: Set<string>,
  options: TraverseOptions = {}
) => {
  const maxNodes = options.maxNodes ?? 10_000;
  const maxDepth = options.maxDepth ?? 50;

  const missing = new Set<string>();
  const queue: Array<{ value: unknown; depth: number }> = [{ value: content, depth: 0 }];
  let visited = 0;

  while (queue.length > 0) {
    const next = queue.shift();
    if (!next) break;
    visited += 1;
    if (visited > maxNodes) break;

    const { value, depth } = next;
    if (depth > maxDepth) continue;

    if (Array.isArray(value)) {
      for (const entry of value) {
        queue.push({ value: entry, depth: depth + 1 });
      }
      continue;
    }

    if (!isRecord(value)) continue;

    const reference = value.reference;
    if (typeof reference === "string") {
      const normalized = normalizeReference(reference);
      if (normalized && !referenceIndex.has(normalized)) {
        missing.add(normalized);
      }
      continue;
    }

    for (const entry of Object.values(value)) {
      queue.push({ value: entry, depth: depth + 1 });
    }
  }

  return Array.from(missing).sort();
};

