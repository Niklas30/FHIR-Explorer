import type {
  ElementDefinition,
  ElementDefinitionType,
  FhirRegistry,
  StructureDefinition,
} from "@/lib/fhir-editor/registry";
import { getStructureDefinitionByCanonical, normalizeCanonical } from "@/lib/fhir-editor/registry";

export type ProfileSummary = {
  url: string;
  name: string;
  title?: string;
  description?: string;
  type?: string;
  version?: string;
};

export type FieldDefinition = {
  id: string;
  path: string;
  segments: string[];
  label: string;
  min?: number;
  max?: string;
  baseMax?: string;
  type?: ElementDefinitionType[];
  binding?: ElementDefinition["binding"];
  mustSupport?: boolean;
  short?: string;
  definition?: string;
};

const toTitle = (value: string) =>
  value
    .replace(/[-_]/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\\s+/g, " ")
    .trim()
    .replace(/^\\w/, (char) => char.toUpperCase());

const stripSlice = (value: string) => value.split(":")[0];

const buildLabel = (element: ElementDefinition, segments: string[]) => {
  const fallback = toTitle(segments[segments.length - 1] ?? "");
  const base = element.short?.trim() || fallback;
  const slice = element.id?.includes(":") ? element.id.split(":").pop() : undefined;
  return slice ? `${base} (${slice})` : base;
};

const mergeElementWithBase = (
  element: ElementDefinition,
  base?: ElementDefinition
): ElementDefinition => {
  return {
    ...base,
    ...element,
    type: element.type ?? base?.type,
    min: element.min ?? base?.min,
    max: element.max ?? base?.max,
  };
};

const shouldInclude = (segments: string[]) => {
  if (segments.length === 1) return true;
  if (segments.length === 2) return true;
  return false;
};

export const getProfileSummaries = (registry: FhirRegistry): ProfileSummary[] => {
  return registry.structureDefinitions
    .filter(
      (definition) =>
        definition.kind === "resource" &&
        definition.abstract !== true &&
        typeof definition.url === "string" &&
        Boolean(definition.type)
    )
    .map((definition) => ({
      url: definition.url as string,
      name: definition.name ?? definition.id ?? definition.url ?? "Profile",
      title: definition.title,
      description: definition.description as string | undefined,
      type: definition.type,
      version: definition.version as string | undefined,
    }))
    .sort((a, b) => (a.title ?? a.name).localeCompare(b.title ?? b.name));
};

export const resolveProfileForResource = (
  resource: Record<string, unknown>,
  registry: FhirRegistry
): StructureDefinition | null => {
  const meta = resource.meta as { profile?: string[] } | undefined;
  const metaProfile = Array.isArray(meta?.profile)
    ? meta?.profile.find((value) => typeof value === "string")
    : undefined;
  if (metaProfile) {
    const profile = getStructureDefinitionByCanonical(registry, metaProfile);
    if (profile) return profile;
  }
  const resourceType = resource.resourceType as string | undefined;
  if (!resourceType) return null;
  const base = `http://hl7.org/fhir/StructureDefinition/${resourceType}`;
  return getStructureDefinitionByCanonical(registry, base) ?? null;
};

export const resolveProfileType = (
  canonical: string | undefined,
  registry: FhirRegistry
) => {
  if (!canonical) return undefined;
  const profile = getStructureDefinitionByCanonical(registry, canonical);
  if (profile?.type) return profile.type;
  const normalized = normalizeCanonical(canonical);
  const last = normalized.split("/").pop();
  return last;
};

export const buildFieldDefinitions = (
  profile: StructureDefinition,
  registry: FhirRegistry
): FieldDefinition[] => {
  const rootType = profile.type ?? profile.id;
  if (!rootType) return [];

  const collectBaseDefinitions = (start?: StructureDefinition | null) => {
    const list: StructureDefinition[] = [];
    const seen = new Set<string>();
    let current = start ?? null;
    while (current) {
      const key = current.url ?? current.id ?? "";
      if (key && seen.has(key)) break;
      if (key) seen.add(key);
      list.push(current);
      if (!current.baseDefinition) break;
      current = getStructureDefinitionByCanonical(registry, current.baseDefinition) ?? null;
    }
    return list;
  };

  const baseDefinition = profile.baseDefinition
    ? getStructureDefinitionByCanonical(registry, profile.baseDefinition)
    : undefined;
  const baseDefinitions = collectBaseDefinitions(baseDefinition);
  const baseElements: ElementDefinition[] = [];
  for (const base of baseDefinitions.reverse()) {
    const elements = base.snapshot?.element ?? base.differential?.element ?? [];
    baseElements.push(...elements);
  }

  const baseByPath = new Map<string, ElementDefinition>();
  for (const base of baseElements) {
    if (base.path) {
      baseByPath.set(base.path, base);
    }
  }

  const elements =
    profile.differential?.element?.length
      ? profile.differential.element
      : profile.snapshot?.element ?? [];

  const diffByPath = new Map<string, ElementDefinition>();
  for (const element of elements) {
    if (element.path) {
      diffByPath.set(element.path, element);
    }
  }

  const fields: FieldDefinition[] = [];
  const rootPrefix = `${rootType}.`;

  const orderedPaths: string[] = [];
  for (const base of baseElements) {
    if (base.path && !orderedPaths.includes(base.path)) {
      orderedPaths.push(base.path);
    }
  }
  for (const element of elements) {
    if (element.path && !orderedPaths.includes(element.path)) {
      orderedPaths.push(element.path);
    }
  }

  for (const path of orderedPaths) {
    if (!path || path === rootType) continue;
    if (!path.startsWith(rootPrefix)) continue;

    const element = diffByPath.get(path);
    const baseElement = baseByPath.get(path);
    if (!element && !baseElement) continue;

    const segments = path
      .slice(rootPrefix.length)
      .split(".")
      .map(stripSlice)
      .filter(Boolean);

    if (!shouldInclude(segments)) continue;

    const merged = mergeElementWithBase(
      element ?? (baseElement as ElementDefinition),
      baseElement
    );

    const isTopLevel = segments.length === 1;
    const shouldIncludeField =
      Boolean(element) ||
      isTopLevel ||
      Boolean(merged.binding) ||
      Boolean(merged.mustSupport) ||
      (merged.min ?? 0) > 0;

    if (!shouldIncludeField) continue;

    fields.push({
      id: merged.id ?? path,
      path,
      segments,
      label: buildLabel(merged, segments),
      min: merged.min,
      max: merged.max,
      baseMax: baseElement?.max,
      type: merged.type,
      binding: merged.binding,
      mustSupport: merged.mustSupport,
      short: merged.short,
      definition: merged.definition,
    });
  }

  return fields;
};
