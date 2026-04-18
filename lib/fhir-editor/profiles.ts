import type {
  ElementDefinition,
  ElementDefinitionType,
  FhirRegistry,
  StructureDefinition,
} from "@/lib/fhir-editor/registry";
import {
  getStructureDefinitionByCanonical,
  normalizeCanonical,
  resolveValueSetOptions,
  type CodingOption,
} from "@/lib/fhir-editor/registry";

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
  identifierSystems?: Array<{ system: string; label: string; profile?: string; sliceName?: string }>;
  identifierTypeOptions?: CodingOption[];
  choiceOptions?: CodingOption[];
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

const hasType = (type?: ElementDefinitionType[]) =>
  Array.isArray(type) && type.some((entry) => Boolean(entry.code));

const getTypeCodes = (types?: ElementDefinitionType[]) =>
  (types ?? []).map((type) => type.code).filter((code): code is string => Boolean(code));

const isComplexType = (types?: ElementDefinitionType[]) =>
  getTypeCodes(types).some((code) => code[0] === code[0].toUpperCase());

type PatternElement = ElementDefinition & {
  fixedUri?: string;
  patternUri?: string;
  fixedCode?: string;
  patternCode?: string;
  fixedString?: string;
  patternString?: string;
  patternCoding?: { system?: string; code?: string; display?: string };
};

const getPatternValue = (
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

const extractSliceFromId = (id: string | undefined, path: string) => {
  if (!id) return undefined;
  const prefix = `${path}:`;
  if (!id.startsWith(prefix)) return undefined;
  const rest = id.slice(prefix.length);
  const slice = rest.split(".")[0];
  return slice || undefined;
};

const getFixedSystemFromIdentifierProfile = (profile: StructureDefinition) => {
  const elements =
    profile.snapshot?.element?.length
      ? profile.snapshot.element
      : profile.differential?.element ?? [];
  const systemElement = elements.find((element) => element.path === "Identifier.system");
  if (!systemElement) return undefined;
  return getPatternValue(systemElement, [
    "fixedUri",
    "patternUri",
    "fixedString",
    "patternString",
  ]);
};

const getIdentifierTypeOptionsFromProfile = (
  profile: StructureDefinition,
  registry: FhirRegistry
): CodingOption[] => {
  const elements =
    profile.snapshot?.element?.length
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
    options.push({
      system: coding.system,
      code: coding.code,
      display: coding.display,
    });
  }

  const unique = new Map<string, CodingOption>();
  for (const option of options) {
    const key = `${option.system ?? ""}|${option.code}`;
    if (!unique.has(key)) {
      unique.set(key, option);
    }
  }
  return Array.from(unique.values());
};

const mergeElementWithBase = (
  element: ElementDefinition,
  base?: ElementDefinition
): ElementDefinition => {
  return {
    ...base,
    ...element,
    type: hasType(element.type) ? element.type : base?.type,
    min: element.min ?? base?.min,
    max: element.max ?? base?.max,
  };
};

const isSliceElementForPath = (element: ElementDefinition) => {
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

const shouldInclude = (segments: string[]) => {
  return segments.length >= 1 && segments.length <= 3;
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

  const getElementsForDefinition = (definition: StructureDefinition) => {
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

  const baseByPath = new Map<string, ElementDefinition>();
  for (const base of baseDefinitions.reverse()) {
    const baseDefinitionElements = getElementsForDefinition(base);
    baseElements.push(...baseDefinitionElements);
    for (const element of baseDefinitionElements) {
      if (!element.path) continue;
      if (isSliceElementForPath(element)) continue;
      const previous = baseByPath.get(element.path);
      baseByPath.set(
        element.path,
        previous ? mergeElementWithBase(element, previous) : element
      );
    }
  }

  const profileElements = getElementsForDefinition(profile);

  const diffByPath = new Map<string, ElementDefinition>();
  for (const element of profileElements) {
    if (!element.path) continue;
    if (isSliceElementForPath(element)) continue;
    const previous = diffByPath.get(element.path);
    diffByPath.set(
      element.path,
      previous ? mergeElementWithBase(element, previous) : element
    );
  }

  const fields: FieldDefinition[] = [];
  const rootPrefix = `${rootType}.`;

  const orderedPaths: string[] = [];
  for (const base of baseElements) {
    if (base.path && !orderedPaths.includes(base.path)) {
      orderedPaths.push(base.path);
    }
  }
  for (const element of profileElements) {
    if (element.path && !orderedPaths.includes(element.path)) {
      orderedPaths.push(element.path);
    }
  }

  const codingParents = new Set<string>();
  for (const path of orderedPaths) {
    if (!path || !path.startsWith(rootPrefix)) continue;
    const segments = path
      .slice(rootPrefix.length)
      .split(".")
      .map(stripSlice)
      .filter(Boolean);
    const normalized = [rootType, ...segments].join(".");
    if (normalized.endsWith(".coding")) {
      codingParents.add(normalized.slice(0, -".coding".length));
    }
  }

  const allElements = [...baseElements, ...profileElements];
  const getIdentifierSystemsForPath = (path: string) => {
    const slices = allElements.filter(
      (element) =>
        element.path === path &&
        typeof element.id === "string" &&
        element.id.includes(":") &&
        Array.isArray(element.type)
    );
    const options: Array<{ system: string; label: string; profile?: string; sliceName?: string }> = [];

    for (const slice of slices) {
      for (const entry of slice.type ?? []) {
        const profiles = entry.profile ?? [];
        for (const profileUrl of profiles) {
          if (!profileUrl) continue;
          const profile = getStructureDefinitionByCanonical(registry, profileUrl);
          if (!profile || profile.type !== "Identifier") continue;
          const system = getFixedSystemFromIdentifierProfile(profile);
          if (!system) continue;
          const sliceName =
            "sliceName" in slice ? (slice as { sliceName?: string }).sliceName : undefined;
          const label =
            sliceName ??
            profile.title ??
            profile.name ??
            profile.id ??
            system;
          options.push({
            system,
            label,
            profile: profile.url ?? profileUrl,
            sliceName,
          });
        }
      }
    }

    const seen = new Set<string>();
    return options.filter((option) => {
      if (seen.has(option.system)) return false;
      seen.add(option.system);
      return true;
    });
  };

  const getIdentifierTypeOptionsForPath = (path: string) => {
    const slices = allElements.filter(
      (element) =>
        element.path === path &&
        typeof element.id === "string" &&
        element.id.includes(":") &&
        Array.isArray(element.type)
    );
    const options: CodingOption[] = [];

    for (const slice of slices) {
      for (const entry of slice.type ?? []) {
        const profiles = entry.profile ?? [];
        for (const profileUrl of profiles) {
          if (!profileUrl) continue;
          const profile = getStructureDefinitionByCanonical(registry, profileUrl);
          if (!profile || profile.type !== "Identifier") continue;
          options.push(...getIdentifierTypeOptionsFromProfile(profile, registry));
        }
      }
    }

    const unique = new Map<string, CodingOption>();
    for (const option of options) {
      const key = `${option.system ?? ""}|${option.code}`;
      if (!unique.has(key)) {
        unique.set(key, option);
      }
    }
    return Array.from(unique.values());
  };

  const getChoiceOptionsForPath = (path: string) => {
    const options: CodingOption[] = [];
    const pathElements = allElements.filter((element) => element.path === path);
    const directElement = diffByPath.get(path);
    const baseElement = baseByPath.get(path);
    const mergedElement =
      directElement || baseElement
        ? mergeElementWithBase(
            directElement ?? (baseElement as ElementDefinition),
            baseElement
          )
        : undefined;

    if (mergedElement?.binding?.valueSet) {
      options.push(...resolveValueSetOptions(mergedElement.binding.valueSet, registry));
    }

    const sliceElements = pathElements.filter(
      (element) =>
        typeof element.id === "string" &&
        element.id.includes(":") &&
        element.binding?.valueSet
    );
    for (const element of sliceElements) {
      if (!element.binding?.valueSet) continue;
      options.push(...resolveValueSetOptions(element.binding.valueSet, registry));
    }

    for (const element of pathElements) {
      const patternCoding = (element as PatternElement).patternCoding;
      if (patternCoding?.code) {
        options.push({
          system: patternCoding.system,
          code: patternCoding.code,
          display: patternCoding.display,
        });
      }
    }

    const sliceNames = new Set<string>();
    for (const element of allElements) {
      const sliceName = extractSliceFromId(element.id, path);
      if (sliceName) {
        sliceNames.add(sliceName);
      }
    }

    const findSliceElement = (childPath: string, sliceName: string) =>
      allElements.find(
        (element) =>
          element.path === childPath &&
          extractSliceFromId(element.id, path) === sliceName
      );

    for (const sliceName of sliceNames) {
      const systemElement = findSliceElement(`${path}.system`, sliceName);
      const codeElement = findSliceElement(`${path}.code`, sliceName);
      const displayElement = findSliceElement(`${path}.display`, sliceName);

      const code = getPatternValue(codeElement, [
        "fixedCode",
        "patternCode",
        "fixedString",
        "patternString",
      ]);
      if (!code) continue;

      const system = getPatternValue(systemElement, [
        "fixedUri",
        "patternUri",
        "fixedString",
        "patternString",
      ]);
      const display = getPatternValue(displayElement, [
        "fixedString",
        "patternString",
      ]);

      options.push({ system, code, display });
    }

    const unique = new Map<string, CodingOption>();
    for (const option of options) {
      const key = `${option.system ?? ""}|${option.code}`;
      if (!unique.has(key)) {
        unique.set(key, option);
      }
    }
    return Array.from(unique.values());
  };

  const typeBackedElementByPath = new Map<string, ElementDefinition | undefined>();
  const getTypeBackedElementForPath = (path: string, segments: string[]) => {
    if (segments.length !== 2) return undefined;
    if (typeBackedElementByPath.has(path)) {
      return typeBackedElementByPath.get(path);
    }

    const parentPath = `${rootType}.${segments[0]}`;
    const parentElement = diffByPath.get(parentPath);
    const parentBase = baseByPath.get(parentPath);
    if (!parentElement && !parentBase) {
      typeBackedElementByPath.set(path, undefined);
      return undefined;
    }

    const mergedParent = mergeElementWithBase(
      parentElement ?? (parentBase as ElementDefinition),
      parentBase
    );

    let resolvedParentTypes = hasType(mergedParent.type) ? mergedParent.type ?? [] : [];
    if (resolvedParentTypes.length === 0) {
      const parentCandidates = allElements.filter((element) => element.path === parentPath);
      for (const candidate of parentCandidates) {
        if (!hasType(candidate.type)) continue;
        resolvedParentTypes = candidate.type ?? [];
        break;
      }
    }
    const canonicalCandidates: string[] = [];
    for (const parentType of resolvedParentTypes) {
      if (!parentType.code) continue;
      if (parentType.code[0] !== parentType.code[0].toUpperCase()) continue;
      for (const profileUrl of parentType.profile ?? []) {
        if (profileUrl) canonicalCandidates.push(profileUrl);
      }
      canonicalCandidates.push(`http://hl7.org/fhir/StructureDefinition/${parentType.code}`);
    }

    const seenCanonical = new Set<string>();
    for (const canonical of canonicalCandidates) {
      const normalizedCanonical = normalizeCanonical(canonical);
      if (seenCanonical.has(normalizedCanonical)) continue;
      seenCanonical.add(normalizedCanonical);

      const profile = getStructureDefinitionByCanonical(registry, canonical);
      if (!profile) continue;
      const profileType = profile.type ?? canonical.split("/").pop();
      if (!profileType) continue;
      const childPath = `${profileType}.${segments[1]}`;
      const profileElements =
        profile.snapshot?.element?.length
          ? profile.snapshot.element
          : profile.differential?.element ?? [];
      const childElement = profileElements.find((element) => element.path === childPath);
      if (childElement) {
        typeBackedElementByPath.set(path, childElement);
        return childElement;
      }
    }

    typeBackedElementByPath.set(path, undefined);
    return undefined;
  };

  const inferTypeForPath = (path: string) => {
    const normalizedSegments = path
      .slice(rootPrefix.length)
      .split(".")
      .map(stripSlice)
      .filter(Boolean);
    const element = diffByPath.get(path);
    const baseElement = baseByPath.get(path);
    const typeBackedElement = getTypeBackedElementForPath(path, normalizedSegments);
    const mergedBase = baseElement
      ? mergeElementWithBase(baseElement, typeBackedElement)
      : typeBackedElement;
    if (!element && !mergedBase) return undefined;
    const merged = mergeElementWithBase(
      element ?? (mergedBase as ElementDefinition),
      mergedBase
    );
    const normalizedPath = [rootType, ...normalizedSegments].join(".");
    const inferredType = hasType(merged.type)
      ? merged.type
      : normalizedPath.endsWith(".coding")
      ? [{ code: "Coding" }]
      : codingParents.has(normalizedPath)
      ? [{ code: "CodeableConcept" }]
      : merged.type;
    return inferredType;
  };

  for (const path of orderedPaths) {
    if (!path || path === rootType) continue;
    if (!path.startsWith(rootPrefix)) continue;

    const element = diffByPath.get(path);
    const baseElement = baseByPath.get(path);

    const segments = path
      .slice(rootPrefix.length)
      .split(".")
      .map(stripSlice)
      .filter(Boolean);
    const typeBackedElement = getTypeBackedElementForPath(path, segments);
    const mergedBase = baseElement
      ? mergeElementWithBase(baseElement, typeBackedElement)
      : typeBackedElement;
    if (!element && !mergedBase) continue;
    const normalizedPath = [rootType, ...segments].join(".");

    if (!shouldInclude(segments)) continue;

    const merged = mergeElementWithBase(
      element ?? (mergedBase as ElementDefinition),
      mergedBase
    );
    if (merged.max === "0") continue;

    const inferredType =
      inferTypeForPath(path) ??
      (hasType(merged.type)
        ? merged.type
        : normalizedPath.endsWith(".coding")
        ? [{ code: "Coding" }]
        : codingParents.has(normalizedPath)
        ? [{ code: "CodeableConcept" }]
        : merged.type);

    const isTopLevel = segments.length === 1;
    const shouldIncludeField =
      Boolean(element) ||
      isTopLevel ||
      Boolean(merged.binding) ||
      Boolean(merged.mustSupport) ||
      (merged.min ?? 0) > 0;

    if (!shouldIncludeField) {
      if (segments.length >= 2) {
        const parentPath = `${rootType}.${segments.slice(0, -1).join(".")}`;
        const parentType = inferTypeForPath(parentPath);
        if (!isComplexType(parentType)) continue;
      } else {
        continue;
      }
    }

    fields.push({
      id: merged.id ?? path,
      path,
      segments,
      label: buildLabel(merged, segments),
      min: merged.min,
      max: merged.max,
      baseMax: baseElement?.max ?? typeBackedElement?.max,
      type: inferredType,
      binding: merged.binding,
      identifierSystems: path.endsWith(".identifier")
        ? getIdentifierSystemsForPath(path)
        : undefined,
      identifierTypeOptions: path.endsWith(".identifier")
        ? getIdentifierTypeOptionsForPath(path)
        : undefined,
      choiceOptions: getChoiceOptionsForPath(path),
      mustSupport: merged.mustSupport,
      short: merged.short,
      definition: merged.definition,
    });
  }

  return fields;
};
