import type { ElementDefinition, FhirRegistry, StructureDefinition } from "@/lib/fhir-editor/registry";
import {
  getStructureDefinitionByCanonical,
  normalizeCanonical,
  resolveValueSetOptions,
  type CodingOption,
} from "@/lib/fhir-editor/registry";
import type { FieldDefinition } from "@/lib/fhir-editor/profiles/types";
import {
  buildLabel,
  collectBaseDefinitions,
  extractSliceFromId,
  getFixedSystemFromIdentifierProfile,
  getIdentifierTypeOptionsFromProfile,
  getPatternValue,
  getDefinitionElements,
  hasType,
  isComplexType,
  isSliceElementForPath,
  mergeElementWithBase,
  shouldInclude,
  stripSlice,
  uniqueCodingOptions,
  type PatternElement,
} from "@/lib/fhir-editor/profiles/field-definition-helpers";

const buildBaseLookups = (profile: StructureDefinition, registry: FhirRegistry) => {
  const baseDefinition = profile.baseDefinition
    ? getStructureDefinitionByCanonical(registry, profile.baseDefinition)
    : undefined;
  const baseDefinitions = collectBaseDefinitions(baseDefinition, registry);

  const baseElements: ElementDefinition[] = [];
  const baseByPath = new Map<string, ElementDefinition>();
  const structuralBaseMaxByPath = new Map<string, string | undefined>();

  for (const base of baseDefinitions.reverse()) {
    const baseDefinitionElements = getDefinitionElements(base);
    baseElements.push(...baseDefinitionElements);
    for (const element of baseDefinitionElements) {
      if (!element.path) continue;
      if (!structuralBaseMaxByPath.has(element.path)) {
        structuralBaseMaxByPath.set(element.path, element.max);
      }
      if (isSliceElementForPath(element)) continue;
      const previous = baseByPath.get(element.path);
      baseByPath.set(element.path, previous ? mergeElementWithBase(element, previous) : element);
    }
  }

  return { baseElements, baseByPath, structuralBaseMaxByPath };
};

const buildDiffByPath = (profileElements: ElementDefinition[]) => {
  const diffByPath = new Map<string, ElementDefinition>();
  for (const element of profileElements) {
    if (!element.path) continue;
    if (isSliceElementForPath(element)) continue;
    const previous = diffByPath.get(element.path);
    diffByPath.set(element.path, previous ? mergeElementWithBase(element, previous) : element);
  }
  return diffByPath;
};

const buildOrderedPaths = (baseElements: ElementDefinition[], profileElements: ElementDefinition[]) => {
  const orderedPaths: string[] = [];
  for (const element of baseElements) {
    if (element.path && !orderedPaths.includes(element.path)) {
      orderedPaths.push(element.path);
    }
  }
  for (const element of profileElements) {
    if (element.path && !orderedPaths.includes(element.path)) {
      orderedPaths.push(element.path);
    }
  }
  return orderedPaths;
};

const buildCodingParents = (orderedPaths: string[], rootType: string, rootPrefix: string) => {
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
  return codingParents;
};

const getIdentifierSystemsForPath = (
  path: string,
  allElements: ElementDefinition[],
  registry: FhirRegistry
) => {
  const slices = allElements.filter(
    (element) =>
      element.path === path &&
      typeof element.id === "string" &&
      element.id.includes(":") &&
      Array.isArray(element.type)
  );
  const options: Array<{ system: string; label: string; profile?: string; sliceName?: string }> =
    [];

  for (const slice of slices) {
    for (const entry of slice.type ?? []) {
      for (const profileUrl of entry.profile ?? []) {
        if (!profileUrl) continue;
        const identifierProfile = getStructureDefinitionByCanonical(registry, profileUrl);
        if (!identifierProfile || identifierProfile.type !== "Identifier") continue;
        const system = getFixedSystemFromIdentifierProfile(identifierProfile);
        if (!system) continue;
        const sliceName =
          "sliceName" in slice ? (slice as { sliceName?: string }).sliceName : undefined;
        const label =
          sliceName ??
          identifierProfile.title ??
          identifierProfile.name ??
          identifierProfile.id ??
          system;
        options.push({
          system,
          label,
          profile: identifierProfile.url ?? profileUrl,
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

const getIdentifierTypeOptionsForPath = (
  path: string,
  allElements: ElementDefinition[],
  registry: FhirRegistry
) => {
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
      for (const profileUrl of entry.profile ?? []) {
        if (!profileUrl) continue;
        const identifierProfile = getStructureDefinitionByCanonical(registry, profileUrl);
        if (!identifierProfile || identifierProfile.type !== "Identifier") continue;
        options.push(...getIdentifierTypeOptionsFromProfile(identifierProfile, registry));
      }
    }
  }

  return uniqueCodingOptions(options);
};

const getChoiceOptionsForPath = ({
  path,
  allElements,
  diffByPath,
  baseByPath,
  registry,
}: {
  path: string;
  allElements: ElementDefinition[];
  diffByPath: Map<string, ElementDefinition>;
  baseByPath: Map<string, ElementDefinition>;
  registry: FhirRegistry;
}) => {
  const options: CodingOption[] = [];
  const pathElements = allElements.filter((element) => element.path === path);
  const directElement = diffByPath.get(path);
  const baseElement = baseByPath.get(path);
  const mergedElement =
    directElement || baseElement
      ? mergeElementWithBase(directElement ?? (baseElement as ElementDefinition), baseElement)
      : undefined;

  if (mergedElement?.binding?.valueSet) {
    options.push(...resolveValueSetOptions(mergedElement.binding.valueSet, registry));
  }

  const sliceElements = pathElements.filter(
    (element) =>
      typeof element.id === "string" && element.id.includes(":") && element.binding?.valueSet
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
      (element) => element.path === childPath && extractSliceFromId(element.id, path) === sliceName
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
    const display = getPatternValue(displayElement, ["fixedString", "patternString"]);

    options.push({ system, code, display });
  }

  return uniqueCodingOptions(options);
};

const createTypeBackedElementResolver = ({
  rootType,
  diffByPath,
  baseByPath,
  allElements,
  registry,
}: {
  rootType: string;
  diffByPath: Map<string, ElementDefinition>;
  baseByPath: Map<string, ElementDefinition>;
  allElements: ElementDefinition[];
  registry: FhirRegistry;
}) => {
  const cache = new Map<string, ElementDefinition | undefined>();

  return (path: string, segments: string[]) => {
    if (segments.length !== 2) return undefined;
    if (cache.has(path)) return cache.get(path);

    const parentPath = `${rootType}.${segments[0]}`;
    const parentElement = diffByPath.get(parentPath);
    const parentBase = baseByPath.get(parentPath);
    if (!parentElement && !parentBase) {
      cache.set(path, undefined);
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

      const candidateProfile = getStructureDefinitionByCanonical(registry, canonical);
      if (!candidateProfile) continue;
      const profileType = candidateProfile.type ?? canonical.split("/").pop();
      if (!profileType) continue;

      const childPath = `${profileType}.${segments[1]}`;
      const profileElements = candidateProfile.snapshot?.element?.length
        ? candidateProfile.snapshot.element
        : candidateProfile.differential?.element ?? [];
      const childElement = profileElements.find((element) => element.path === childPath);
      if (childElement) {
        cache.set(path, childElement);
        return childElement;
      }
    }

    cache.set(path, undefined);
    return undefined;
  };
};

const createInferTypeForPath = ({
  rootType,
  rootPrefix,
  diffByPath,
  baseByPath,
  codingParents,
  getTypeBackedElementForPath,
}: {
  rootType: string;
  rootPrefix: string;
  diffByPath: Map<string, ElementDefinition>;
  baseByPath: Map<string, ElementDefinition>;
  codingParents: Set<string>;
  getTypeBackedElementForPath: (path: string, segments: string[]) => ElementDefinition | undefined;
}) => {
  return (path: string) => {
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

    const merged = mergeElementWithBase(element ?? (mergedBase as ElementDefinition), mergedBase);
    const normalizedPath = [rootType, ...normalizedSegments].join(".");

    if (hasType(merged.type)) return merged.type;
    if (normalizedPath.endsWith(".coding")) return [{ code: "Coding" }];
    if (codingParents.has(normalizedPath)) return [{ code: "CodeableConcept" }];
    return merged.type;
  };
};

const createFieldBuilder = ({
  rootType,
  rootPrefix,
  diffByPath,
  baseByPath,
  structuralBaseMaxByPath,
  codingParents,
  allElements,
  registry,
  getTypeBackedElementForPath,
  inferTypeForPath,
}: {
  rootType: string;
  rootPrefix: string;
  diffByPath: Map<string, ElementDefinition>;
  baseByPath: Map<string, ElementDefinition>;
  structuralBaseMaxByPath: Map<string, string | undefined>;
  codingParents: Set<string>;
  allElements: ElementDefinition[];
  registry: FhirRegistry;
  getTypeBackedElementForPath: (path: string, segments: string[]) => ElementDefinition | undefined;
  inferTypeForPath: (path: string) => ElementDefinition["type"] | undefined;
}) => {
  return (path: string): FieldDefinition | null => {
    if (!path || path === rootType) return null;
    if (!path.startsWith(rootPrefix)) return null;

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
    if (!element && !mergedBase) return null;

    if (!shouldInclude(segments)) return null;

    const normalizedPath = [rootType, ...segments].join(".");
    const merged = mergeElementWithBase(element ?? (mergedBase as ElementDefinition), mergedBase);
    if (merged.max === "0") return null;

    const inferredType =
      inferTypeForPath(path) ??
      (normalizedPath.endsWith(".coding")
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
        if (!isComplexType(parentType)) return null;
      } else {
        return null;
      }
    }

    return {
      id: merged.id ?? path,
      path,
      segments,
      label: buildLabel(merged, segments),
      min: merged.min,
      max: merged.max,
      baseMax: structuralBaseMaxByPath.get(path) ?? baseElement?.max ?? typeBackedElement?.max,
      type: inferredType,
      binding: merged.binding,
      identifierSystems: path.endsWith(".identifier")
        ? getIdentifierSystemsForPath(path, allElements, registry)
        : undefined,
      identifierTypeOptions: path.endsWith(".identifier")
        ? getIdentifierTypeOptionsForPath(path, allElements, registry)
        : undefined,
      choiceOptions: getChoiceOptionsForPath({
        path,
        allElements,
        diffByPath,
        baseByPath,
        registry,
      }),
      mustSupport: merged.mustSupport,
      short: merged.short,
      definition: merged.definition,
    };
  };
};

export const buildFieldDefinitions = (
  profile: StructureDefinition,
  registry: FhirRegistry
): FieldDefinition[] => {
  const rootType = profile.type ?? profile.id;
  if (!rootType) return [];

  const rootPrefix = `${rootType}.`;

  const { baseElements, baseByPath, structuralBaseMaxByPath } = buildBaseLookups(profile, registry);
  const profileElements = getDefinitionElements(profile);
  const diffByPath = buildDiffByPath(profileElements);
  const orderedPaths = buildOrderedPaths(baseElements, profileElements);
  const codingParents = buildCodingParents(orderedPaths, rootType, rootPrefix);
  const allElements = [...baseElements, ...profileElements];

  const getTypeBackedElementForPath = createTypeBackedElementResolver({
    rootType,
    diffByPath,
    baseByPath,
    allElements,
    registry,
  });
  const inferTypeForPath = createInferTypeForPath({
    rootType,
    rootPrefix,
    diffByPath,
    baseByPath,
    codingParents,
    getTypeBackedElementForPath,
  });
  const buildFieldForPath = createFieldBuilder({
    rootType,
    rootPrefix,
    diffByPath,
    baseByPath,
    structuralBaseMaxByPath,
    codingParents,
    allElements,
    registry,
    getTypeBackedElementForPath,
    inferTypeForPath,
  });

  const fields: FieldDefinition[] = [];
  for (const path of orderedPaths) {
    const field = buildFieldForPath(path);
    if (field) fields.push(field);
  }
  return fields;
};

