import type { ElementDefinition, ElementDefinitionType, FhirRegistry, StructureDefinition } from "@/lib/fhir-editor/registry";
import { getStructureDefinitionByCanonical, resolveValueSetOptions, type CodingOption } from "@/lib/fhir-editor/registry";

export type PatternElement = ElementDefinition & {
  fixedUri?: string;
  patternUri?: string;
  fixedCode?: string;
  patternCode?: string;
  fixedString?: string;
  patternString?: string;
  patternCoding?: { system?: string; code?: string; display?: string };
};

const toTitle = (value: string) =>
  value
    .replace(/[-_]/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\\s+/g, " ")
    .trim()
    .replace(/^\\w/, (char) => char.toUpperCase());

export const stripSlice = (value: string) => value.split(":")[0];

export const buildLabel = (element: ElementDefinition, segments: string[]) => {
  const fallback = toTitle(segments[segments.length - 1] ?? "");
  const base = element.short?.trim() || fallback;
  const slice = element.id?.includes(":") ? element.id.split(":").pop() : undefined;
  return slice ? `${base} (${slice})` : base;
};

export const hasType = (type?: ElementDefinitionType[]) =>
  Array.isArray(type) && type.some((entry) => Boolean(entry.code));

const getTypeCodes = (types?: ElementDefinitionType[]) =>
  (types ?? []).map((type) => type.code).filter((code): code is string => Boolean(code));

export const isComplexType = (types?: ElementDefinitionType[]) =>
  getTypeCodes(types).some((code) => code[0] === code[0].toUpperCase());

export const getPatternValue = (
  element: ElementDefinition | undefined,
  keys: Array<keyof PatternElement>
) => {
  if (!element) return undefined;
  const typed = element as PatternElement;
  for (const key of keys) {
    const value = typed[key];
    if (typeof value === "string" && value.length > 0) {
      return value;
    }
  }
  return undefined;
};

export const extractSliceFromId = (id: string | undefined, path: string) => {
  if (!id) return undefined;
  const prefix = `${path}:`;
  if (!id.startsWith(prefix)) return undefined;
  const rest = id.slice(prefix.length);
  const slice = rest.split(".")[0];
  return slice || undefined;
};

export const getDefinitionElements = (definition: StructureDefinition) => {
  const snapshotElements = definition.snapshot?.element ?? [];
  const differentialElements = definition.differential?.element ?? [];
  if (snapshotElements.length === 0) {
    return differentialElements;
  }
  if (differentialElements.length === 0) {
    return snapshotElements;
  }
  // Snapshot gives the resolved tree; differential keeps profile-local overrides/slices.
  return [...snapshotElements, ...differentialElements];
};

export const collectBaseDefinitions = (start: StructureDefinition | undefined, registry: FhirRegistry) => {
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

export const mergeElementWithBase = (element: ElementDefinition, base?: ElementDefinition) => {
  return {
    ...base,
    ...element,
    type: hasType(element.type) ? element.type : base?.type,
    min: element.min ?? base?.min,
    max: element.max ?? base?.max,
  } satisfies ElementDefinition;
};

export const isSliceElementForPath = (element: ElementDefinition) => {
  if (!element.id || !element.path) return false;
  if (!element.id.includes(":")) return false;

  const idSegments = element.id.split(".");
  const pathSegments = element.path.split(".");
  if (idSegments.length !== pathSegments.length) return false;

  let hasSlice = false;
  for (let index = 0; index < idSegments.length; index += 1) {
    const idSegment = idSegments[index];
    if (idSegment.includes(":")) {
      hasSlice = true;
    }
    if (stripSlice(idSegment) !== pathSegments[index]) {
      return false;
    }
  }

  return hasSlice;
};

export const shouldInclude = (segments: string[]) => {
  return segments.length >= 1 && segments.length <= 3;
};

export const uniqueCodingOptions = (options: CodingOption[]) => {
  const unique = new Map<string, CodingOption>();
  for (const option of options) {
    const key = `${option.system ?? ""}|${option.code}`;
    if (!unique.has(key)) {
      unique.set(key, option);
    }
  }
  return Array.from(unique.values());
};

export const getIdentifierTypeOptionsFromProfile = (
  profile: StructureDefinition,
  registry: FhirRegistry
): CodingOption[] => {
  const elements = profile.snapshot?.element?.length
    ? profile.snapshot.element
    : profile.differential?.element ?? [];
  const typeElement = elements.find((element) => element.path === "Identifier.type");
  if (!typeElement) return [];

  const options: CodingOption[] = [];
  if (typeElement.binding?.valueSet) {
    options.push(...resolveValueSetOptions(typeElement.binding.valueSet, registry));
  }

  const patternCodings = typeElement.patternCodeableConcept?.coding ?? [];
  for (const coding of patternCodings) {
    if (!coding?.code) continue;
    options.push({ system: coding.system, code: coding.code, display: coding.display });
  }

  return uniqueCodingOptions(options);
};

export const getFixedSystemFromIdentifierProfile = (profile: StructureDefinition) => {
  const elements = profile.snapshot?.element?.length
    ? profile.snapshot.element
    : profile.differential?.element ?? [];
  const systemElement = elements.find((element) => element.path === "Identifier.system");
  if (!systemElement) return undefined;
  return getPatternValue(systemElement, ["fixedUri", "patternUri", "fixedString", "patternString"]);
};

