import type { ResourcePayload } from "@/lib/fhir-importer/types";

export type FhirResource = Record<string, unknown> & {
  resourceType: string;
  id?: string;
  url?: string;
  name?: string;
  title?: string;
};

export type ElementDefinitionType = {
  code?: string;
  profile?: string[];
  targetProfile?: string[];
};

export type ElementDefinition = {
  id?: string;
  path?: string;
  short?: string;
  definition?: string;
  min?: number;
  max?: string;
  mustSupport?: boolean;
  type?: ElementDefinitionType[];
  binding?: {
    strength?: string;
    valueSet?: string;
  };
  patternCodeableConcept?: {
    coding?: Array<{
      system?: string;
      code?: string;
      display?: string;
    }>;
  };
};

export type CodeSystemConcept = {
  code?: string;
  display?: string;
  concept?: CodeSystemConcept[];
};

export type StructureDefinition = FhirResource & {
  resourceType: "StructureDefinition";
  kind?: string;
  abstract?: boolean;
  type?: string;
  baseDefinition?: string;
  differential?: { element?: ElementDefinition[] };
  snapshot?: { element?: ElementDefinition[] };
};

export type ValueSetCompose = {
  include?: Array<{
    system?: string;
    concept?: Array<{
      code?: string;
      display?: string;
      concept?: Array<{ code?: string; display?: string }>;
    }>;
    valueSet?: string[];
    filter?: Array<{
      property?: string;
      op?: string;
      value?: string;
    }>;
  }>;
  exclude?: Array<{
    system?: string;
    concept?: Array<{
      code?: string;
      display?: string;
      concept?: Array<{ code?: string; display?: string }>;
    }>;
    valueSet?: string[];
    filter?: Array<{
      property?: string;
      op?: string;
      value?: string;
    }>;
  }>;
};

export type ValueSet = FhirResource & {
  resourceType: "ValueSet";
  compose?: ValueSetCompose;
  expansion?: {
    contains?: ValueSetExpansionContains[];
  };
};

export type ValueSetExpansionContains = {
  system?: string;
  code?: string;
  display?: string;
  contains?: ValueSetExpansionContains[];
};

export type CodeSystem = FhirResource & {
  resourceType: "CodeSystem";
  valueSet?: string;
  concept?: CodeSystemConcept[];
};

export type CodingOption = {
  system?: string;
  code: string;
  display?: string;
};

export type FhirRegistry = {
  structureDefinitions: StructureDefinition[];
  structureDefinitionsByUrl: Map<string, StructureDefinition>;
  valueSetsByUrl: Map<string, ValueSet>;
  codeSystemsByUrl: Map<string, CodeSystem>;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value && typeof value === "object" && !Array.isArray(value));

export const normalizeCanonical = (value: string) => value.split("|")[0].trim();

export const buildRegistry = (payloads: ResourcePayload[]): FhirRegistry => {
  const structureDefinitions: StructureDefinition[] = [];
  const structureDefinitionsByUrl = new Map<string, StructureDefinition>();
  const valueSetsByUrl = new Map<string, ValueSet>();
  const codeSystemsByUrl = new Map<string, CodeSystem>();

  for (const payload of payloads) {
    const content = payload.content;
    if (!isRecord(content)) continue;
    const resourceType = content.resourceType;
    if (typeof resourceType !== "string") continue;

    if (resourceType === "StructureDefinition") {
      const definition = content as StructureDefinition;
      structureDefinitions.push(definition);
      if (definition.url) {
        structureDefinitionsByUrl.set(normalizeCanonical(definition.url), definition);
      }
      continue;
    }

    if (resourceType === "ValueSet") {
      const valueSet = content as ValueSet;
      if (valueSet.url) {
        valueSetsByUrl.set(normalizeCanonical(valueSet.url), valueSet);
      }
      continue;
    }

    if (resourceType === "CodeSystem") {
      const codeSystem = content as CodeSystem;
      if (codeSystem.url) {
        codeSystemsByUrl.set(normalizeCanonical(codeSystem.url), codeSystem);
      }
    }
  }

  return {
    structureDefinitions,
    structureDefinitionsByUrl,
    valueSetsByUrl,
    codeSystemsByUrl,
  };
};

export const getStructureDefinitionByCanonical = (
  registry: FhirRegistry,
  canonical?: string
) => {
  if (!canonical) return undefined;

  const normalized = normalizeCanonical(canonical);
  const direct = registry.structureDefinitionsByUrl.get(normalized);
  if (direct) return direct;

  const withoutTrailingSlash = normalized.endsWith("/")
    ? normalized.slice(0, -1)
    : normalized;
  if (withoutTrailingSlash !== normalized) {
    const trailingResolved = registry.structureDefinitionsByUrl.get(withoutTrailingSlash);
    if (trailingResolved) return trailingResolved;
  }

  const toggledProtocol = normalized.startsWith("https://")
    ? normalized.replace("https://", "http://")
    : normalized.startsWith("http://")
    ? normalized.replace("http://", "https://")
    : undefined;
  if (toggledProtocol) {
    const protocolResolved = registry.structureDefinitionsByUrl.get(toggledProtocol);
    if (protocolResolved) return protocolResolved;
  }

  const tail = withoutTrailingSlash.split("/").pop();
  if (!tail) return undefined;

  return registry.structureDefinitions.find((definition) => {
    const byId = definition.id === tail;
    const byName = definition.name === tail;
    return byId || byName;
  });
};

const toOptionKey = (option: Pick<CodingOption, "system" | "code">) =>
  `${option.system ?? ""}|${option.code}`;

const uniqueOptions = (options: CodingOption[]) => {
  const unique = new Map<string, CodingOption>();
  for (const option of options) {
    const key = toOptionKey(option);
    if (!unique.has(key)) {
      unique.set(key, option);
    }
  }
  return Array.from(unique.values());
};

const withoutTrailingSlash = (value: string) =>
  value.endsWith("/") ? value.slice(0, -1) : value;

const toggleProtocol = (value: string) => {
  if (value.startsWith("https://")) {
    return `http://${value.slice("https://".length)}`;
  }
  if (value.startsWith("http://")) {
    return `https://${value.slice("http://".length)}`;
  }
  return undefined;
};

const buildCanonicalCandidates = (canonical: string) => {
  const normalized = normalizeCanonical(canonical);
  const variants = new Set<string>();

  const addVariant = (value?: string) => {
    if (!value) return;
    variants.add(value);
  };

  addVariant(normalized);
  const withoutSlash = withoutTrailingSlash(normalized);
  addVariant(withoutSlash);
  addVariant(`${withoutSlash}/`);

  for (const candidate of Array.from(variants)) {
    addVariant(toggleProtocol(candidate));
  }

  return Array.from(variants);
};

const resolveFromCanonicalMap = <T extends FhirResource>(
  byUrl: Map<string, T>,
  canonical: string | undefined
) => {
  if (!canonical) return undefined;

  for (const candidate of buildCanonicalCandidates(canonical)) {
    const direct = byUrl.get(candidate);
    if (direct) return direct;
  }

  const tail = withoutTrailingSlash(normalizeCanonical(canonical)).split("/").pop();
  if (!tail) return undefined;

  for (const resource of byUrl.values()) {
    if (resource.id === tail || resource.name === tail) {
      return resource;
    }
    if (resource.url) {
      const resourceTail = withoutTrailingSlash(normalizeCanonical(resource.url)).split("/").pop();
      if (resourceTail === tail) {
        return resource;
      }
    }
  }

  return undefined;
};

const getValueSetByCanonical = (registry: FhirRegistry, canonical: string | undefined) =>
  resolveFromCanonicalMap(registry.valueSetsByUrl, canonical);

const getCodeSystemByCanonical = (registry: FhirRegistry, canonical: string | undefined) =>
  resolveFromCanonicalMap(registry.codeSystemsByUrl, canonical);

type ConceptLike = {
  code?: string;
  display?: string;
  concept?: ConceptLike[];
};

const flattenConcepts = (concepts: ConceptLike[], system?: string): CodingOption[] => {
  const options: CodingOption[] = [];
  for (const concept of concepts) {
    if (concept.code) {
      options.push({
        system,
        code: concept.code,
        display: concept.display,
      });
    }
    if (Array.isArray(concept.concept) && concept.concept.length > 0) {
      options.push(...flattenConcepts(concept.concept, system));
    }
  }
  return options;
};

type FlatConcept = {
  code: string;
  parentCode?: string;
};

const flattenConceptTree = (
  concepts: ConceptLike[],
  parentCode?: string,
  target: FlatConcept[] = []
) => {
  for (const concept of concepts) {
    if (!concept.code) continue;
    const next: FlatConcept = {
      code: concept.code,
      parentCode,
    };
    target.push(next);
    if (Array.isArray(concept.concept) && concept.concept.length > 0) {
      flattenConceptTree(concept.concept, concept.code, target);
    }
  }
  return target;
};

const buildChildrenByParent = (concepts: FlatConcept[]) => {
  const childrenByParent = new Map<string, string[]>();
  for (const concept of concepts) {
    if (!concept.parentCode) continue;
    const list = childrenByParent.get(concept.parentCode) ?? [];
    list.push(concept.code);
    childrenByParent.set(concept.parentCode, list);
  }
  return childrenByParent;
};

const collectDescendantCodes = (
  rootCode: string,
  includeSelf: boolean,
  childrenByParent: Map<string, string[]>
) => {
  const collected = new Set<string>();
  const stack = [rootCode];

  while (stack.length > 0) {
    const current = stack.pop();
    if (!current) continue;
    if (includeSelf || current !== rootCode) {
      collected.add(current);
    }
    const children = childrenByParent.get(current) ?? [];
    for (const child of children) {
      stack.push(child);
    }
  }

  return collected;
};

const parseCodeList = (raw: string) =>
  raw
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);

type ComposeClause = NonNullable<ValueSetCompose["include"]>[number];
type ComposeFilter = NonNullable<ComposeClause["filter"]>[number];

const resolveCodesForFilter = (
  filter: ComposeFilter,
  codeSystem: CodeSystem,
  registry: FhirRegistry,
  visited: Set<string>
) => {
  if (!filter.op || !filter.value) return undefined;

  const concepts = codeSystem.concept ?? [];
  const flatConcepts = flattenConceptTree(concepts);
  if (flatConcepts.length === 0) return undefined;

  const allCodes = new Set(flatConcepts.map((concept) => concept.code));
  const childrenByParent = buildChildrenByParent(flatConcepts);
  const normalizedOp = filter.op.toLowerCase();
  const normalizedProperty = filter.property?.toLowerCase();
  const rawValue = filter.value.trim();

  const isConceptProperty =
    normalizedProperty === "concept" || normalizedProperty === "code" || !normalizedProperty;
  if (!isConceptProperty) return undefined;

  if (normalizedOp === "=") {
    return new Set([rawValue]);
  }

  if (normalizedOp === "is-a") {
    return collectDescendantCodes(rawValue, true, childrenByParent);
  }

  if (normalizedOp === "descendent-of") {
    return collectDescendantCodes(rawValue, false, childrenByParent);
  }

  if (normalizedOp === "is-not-a") {
    const descendants = collectDescendantCodes(rawValue, true, childrenByParent);
    const remaining = new Set<string>();
    for (const code of allCodes) {
      if (!descendants.has(code)) {
        remaining.add(code);
      }
    }
    return remaining;
  }

  if (normalizedOp === "in" || normalizedOp === "not-in") {
    const listedCodes = parseCodeList(rawValue);
    if (listedCodes.length > 0) {
      return new Set(listedCodes);
    }

    const nestedOptions = resolveValueSetOptionsInternal(rawValue, registry, visited);
    const nestedCodes = new Set<string>();
    for (const option of nestedOptions) {
      if (option.system && codeSystem.url && normalizeCanonical(option.system) !== normalizeCanonical(codeSystem.url)) {
        continue;
      }
      nestedCodes.add(option.code);
    }
    return nestedCodes;
  }

  return undefined;
};

const applyCodeSystemFilters = (
  options: CodingOption[],
  codeSystem: CodeSystem,
  filters: ComposeClause["filter"],
  registry: FhirRegistry,
  visited: Set<string>
) => {
  if (!Array.isArray(filters) || filters.length === 0) return options;

  let filtered = options;
  for (const filter of filters) {
    const matchingCodes = resolveCodesForFilter(filter, codeSystem, registry, visited);
    if (!matchingCodes) {
      // Unknown/unsupported filters are treated as non-resolvable so we do not
      // expose potentially invalid options in the editor.
      return [];
    }
    const isNegative = filter.op?.toLowerCase() === "not-in";
    filtered = filtered.filter((option) =>
      isNegative ? !matchingCodes.has(option.code) : matchingCodes.has(option.code)
    );
  }

  return filtered;
};

const resolveComposeClauseOptions = (
  clause: ComposeClause,
  registry: FhirRegistry,
  visited: Set<string>
) => {
  const options: CodingOption[] = [];
  const hasConcepts = Array.isArray(clause.concept) && clause.concept.length > 0;
  const hasFilters = Array.isArray(clause.filter) && clause.filter.length > 0;

  if (hasConcepts) {
    options.push(...flattenConcepts(clause.concept as ConceptLike[], clause.system));
  }

  if (clause.system) {
    const codeSystem = getCodeSystemByCanonical(registry, clause.system);
    if (codeSystem?.concept) {
      if (!hasConcepts || hasFilters) {
        let systemOptions = flattenConcepts(codeSystem.concept, codeSystem.url);
        if (hasFilters) {
          systemOptions = applyCodeSystemFilters(
            systemOptions,
            codeSystem,
            clause.filter,
            registry,
            visited
          );
        }
        options.push(...systemOptions);
      }
    }
  }

  if (Array.isArray(clause.valueSet)) {
    for (const nestedValueSet of clause.valueSet) {
      options.push(...resolveValueSetOptionsInternal(nestedValueSet, registry, visited));
    }
  }

  return uniqueOptions(options);
};

const subtractOptions = (base: CodingOption[], excluded: CodingOption[]) => {
  if (excluded.length === 0) return base;
  const excludedKeys = new Set(excluded.map((option) => toOptionKey(option)));
  return base.filter((option) => !excludedKeys.has(toOptionKey(option)));
};

const resolveCodeSystemOptions = (
  canonical: string,
  registry: FhirRegistry
): CodingOption[] => {
  const options: CodingOption[] = [];
  const codeSystem = getCodeSystemByCanonical(registry, canonical);
  if (codeSystem?.concept) {
    options.push(...flattenConcepts(codeSystem.concept, codeSystem.url));
  }

  const canonicalCandidates = new Set(buildCanonicalCandidates(canonical));
  for (const entry of registry.codeSystemsByUrl.values()) {
    if (!entry.valueSet || !entry.concept) continue;
    const valueSetCanonical = normalizeCanonical(entry.valueSet);
    if (!canonicalCandidates.has(valueSetCanonical)) continue;
    options.push(...flattenConcepts(entry.concept, entry.url));
  }

  return uniqueOptions(options);
};

const flattenExpansionContains = (
  contains: ValueSetExpansionContains[],
  inheritedSystem?: string
): CodingOption[] => {
  const options: CodingOption[] = [];
  for (const entry of contains) {
    const entrySystem = entry.system ?? inheritedSystem;
    if (entry.code) {
      options.push({
        system: entrySystem,
        code: entry.code,
        display: entry.display,
      });
    }
    if (Array.isArray(entry.contains) && entry.contains.length > 0) {
      options.push(...flattenExpansionContains(entry.contains, entrySystem));
    }
  }
  return options;
};

const resolveValueSetOptionsInternal = (
  canonical: string | undefined,
  registry: FhirRegistry,
  visited: Set<string>
): CodingOption[] => {
  if (!canonical) return [];
  const normalized = normalizeCanonical(canonical);
  if (visited.has(normalized)) return [];
  visited.add(normalized);
  try {
    const valueSet = getValueSetByCanonical(registry, normalized);
    if (!valueSet) {
      return resolveCodeSystemOptions(normalized, registry);
    }

    if (Array.isArray(valueSet.expansion?.contains) && valueSet.expansion.contains.length > 0) {
      return uniqueOptions(flattenExpansionContains(valueSet.expansion.contains));
    }

    const includes = valueSet.compose?.include ?? [];
    const excludes = valueSet.compose?.exclude ?? [];
    const includeOptions = includes.flatMap((include) =>
      resolveComposeClauseOptions(include, registry, visited)
    );
    const excludeOptions = excludes.flatMap((exclude) =>
      resolveComposeClauseOptions(exclude, registry, visited)
    );

    return subtractOptions(uniqueOptions(includeOptions), uniqueOptions(excludeOptions));
  } finally {
    visited.delete(normalized);
  }
};

export const resolveValueSetOptions = (
  canonical: string | undefined,
  registry: FhirRegistry
): CodingOption[] => {
  return uniqueOptions(resolveValueSetOptionsInternal(canonical, registry, new Set<string>()));
};
