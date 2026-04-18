import type { DatasetResource } from "@/lib/datasets/content";

export type BrokenReferenceIssue = {
  reference: string;
  targetKey: string;
  jsonPath: string;
};

type CollectBrokenReferenceOptions = {
  maxNodes?: number;
  maxDepth?: number;
};

type ParsedReference = {
  resourceType: string;
  id: string;
  key: string;
};

const RESOURCE_TYPE_PATTERN = /^[A-Za-z][A-Za-z0-9]+$/;
const REFERENCE_ID_PATTERN = /^[A-Za-z0-9\-.]{1,64}$/;

const stripReferenceDecorators = (value: string) =>
  value.split("?")[0]?.split("#")[0] ?? value;

const resolveReferenceTail = (segments: string[]) => {
  if (segments.length >= 4 && segments[segments.length - 2] === "_history") {
    return {
      resourceType: segments[segments.length - 4],
      id: segments[segments.length - 3],
    };
  }

  if (segments.length >= 2) {
    return {
      resourceType: segments[segments.length - 2],
      id: segments[segments.length - 1],
    };
  }

  return null;
};

const getResourceInstanceId = (resource: DatasetResource) => {
  const resourceId = resource.content.id;
  if (typeof resourceId === "string" && resourceId.trim().length > 0) {
    return resourceId.trim();
  }
  return resource.id;
};

const toPath = (segments: string[]) => {
  return segments
    .map((segment) =>
      /^\d+$/.test(segment) ? `[${segment}]` : segment
    )
    .reduce((acc, segment, index) => {
      if (segment.startsWith("[")) return `${acc}${segment}`;
      return index === 0 ? segment : `${acc}.${segment}`;
    }, "");
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value && typeof value === "object" && !Array.isArray(value));

const DEFAULT_MAX_NODES = 20_000;
const DEFAULT_MAX_DEPTH = 80;

export const parseLocalReference = (value: string): ParsedReference | null => {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("#")) return null;
  if (trimmed.includes("://")) return null;
  if (trimmed.startsWith("urn:")) return null;

  const normalized = stripReferenceDecorators(trimmed)
    .replace(/^\/+/, "")
    .replace(/^\.\/+/, "")
    .replace(/\/+$/, "");
  if (!normalized) return null;

  const segments = normalized.split("/").filter(Boolean);
  const tail = resolveReferenceTail(segments);
  if (!tail) return null;
  const { resourceType, id } = tail;

  if (!RESOURCE_TYPE_PATTERN.test(resourceType)) return null;
  if (!REFERENCE_ID_PATTERN.test(id)) return null;

  return {
    resourceType,
    id,
    key: `${resourceType}/${id}`,
  };
};

export const buildDatasetReferenceIndex = (resources: DatasetResource[]) => {
  const keys = new Set<string>();
  for (const resource of resources) {
    const id = getResourceInstanceId(resource);
    keys.add(`${resource.resourceType}/${id}`);
  }
  return keys;
};

export const isBrokenLocalReference = (
  reference: string,
  existingReferences: Set<string>
) => {
  const parsed = parseLocalReference(reference);
  if (!parsed) return false;
  return !existingReferences.has(parsed.key);
};

export const collectBrokenReferences = (
  content: Record<string, unknown>,
  existingReferences: Set<string>,
  options?: CollectBrokenReferenceOptions
): BrokenReferenceIssue[] => {
  const issues: BrokenReferenceIssue[] = [];
  const seen = new Set<string>();
  const visitedObjects = new WeakSet<object>();
  const maxNodes = Math.max(1, options?.maxNodes ?? DEFAULT_MAX_NODES);
  const maxDepth = Math.max(1, options?.maxDepth ?? DEFAULT_MAX_DEPTH);
  let visitedNodes = 0;
  const stack: Array<{ value: unknown; pathSegments: string[]; depth: number }> = [
    { value: content, pathSegments: [], depth: 0 },
  ];

  while (stack.length > 0 && visitedNodes < maxNodes) {
    const current = stack.pop();
    if (!current) break;
    const { value, pathSegments, depth } = current;
    visitedNodes += 1;

    if (Array.isArray(value)) {
      if (visitedObjects.has(value)) continue;
      visitedObjects.add(value);
      if (depth >= maxDepth) continue;

      for (let index = value.length - 1; index >= 0; index -= 1) {
        const entry = value[index];
        if (entry && typeof entry === "object") {
          stack.push({
            value: entry,
            pathSegments: [...pathSegments, String(index)],
            depth: depth + 1,
          });
        }
      }
      continue;
    }

    if (!isRecord(value)) continue;
    if (visitedObjects.has(value)) continue;
    visitedObjects.add(value);
    if (depth >= maxDepth) continue;

    for (const [key, entry] of Object.entries(value)) {
      const nextPath = [...pathSegments, key];
      if (key === "reference" && typeof entry === "string") {
        const parsed = parseLocalReference(entry);
        if (parsed && !existingReferences.has(parsed.key)) {
          const path = toPath(nextPath);
          const dedupeKey = `${path}|${entry}`;
          if (!seen.has(dedupeKey)) {
            seen.add(dedupeKey);
            issues.push({
              reference: entry,
              targetKey: parsed.key,
              jsonPath: path,
            });
          }
        }
      }

      if (entry && typeof entry === "object") {
        stack.push({
          value: entry,
          pathSegments: nextPath,
          depth: depth + 1,
        });
      }
    }
  }

  return issues;
};
