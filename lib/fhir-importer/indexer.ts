import type { ParsedResource, ResourceIndexEntry } from "./types";

const makeKey = (resource: ParsedResource): string => {
  if (resource.url) {
    return `${resource.resourceType}|${resource.url}`;
  }
  if (resource.id) {
    return `${resource.resourceType}|${resource.id}|${resource.packageKey}`;
  }
  return `${resource.resourceType}|${resource.sourcePath}|${resource.packageKey}`;
};

const extractBindings = (resource: ParsedResource): Array<{ path: string; valueSet: string }> => {
  if (resource.resourceType !== "StructureDefinition") return [];
  const content = resource.content as Record<string, unknown> | undefined;
  if (!content) return [];

  const snapshot = content.snapshot as { element?: Array<{ path?: string; binding?: { valueSet?: string } }> } | undefined;
  const differential =
    content.differential as { element?: Array<{ path?: string; binding?: { valueSet?: string } }> } | undefined;

  const elements = [...(snapshot?.element ?? []), ...(differential?.element ?? [])];
  const bindings: Array<{ path: string; valueSet: string }> = [];

  for (const element of elements) {
    const path = element.path;
    const valueSet = element.binding?.valueSet;
    if (path && valueSet) {
      bindings.push({ path, valueSet });
    }
  }

  return bindings;
};

export const buildResourceIndexEntries = (
  resources: ParsedResource[]
): ResourceIndexEntry[] =>
  resources.map((resource) => ({
    key: makeKey(resource),
    packageKey: resource.packageKey,
    resourceType: resource.resourceType,
    id: resource.id,
    url: resource.url,
    name: resource.name,
    title: resource.title,
    bindings: extractBindings(resource),
  }));
