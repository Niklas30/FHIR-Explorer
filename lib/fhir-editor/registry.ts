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
  }>;
};

export type ValueSet = FhirResource & {
  resourceType: "ValueSet";
  compose?: ValueSetCompose;
  expansion?: {
    contains?: Array<{
      system?: string;
      code?: string;
      display?: string;
      contains?: Array<{
        system?: string;
        code?: string;
        display?: string;
      }>;
    }>;
  };
};

export type CodeSystem = FhirResource & {
  resourceType: "CodeSystem";
  concept?: Array<{
    code?: string;
    display?: string;
    concept?: Array<{ code?: string; display?: string }>;
  }>;
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
  return registry.structureDefinitionsByUrl.get(normalizeCanonical(canonical));
};

type ConceptNode = {
  code?: string;
  display?: string;
  concept?: ConceptNode[];
};

const flattenConcepts = (
  concepts: ConceptNode[],
  system?: string
): CodingOption[] => {
  const options: CodingOption[] = [];
  for (const concept of concepts) {
    if (concept.code) {
      options.push({
        system,
        code: concept.code,
        display: concept.display,
      });
    }
    if (Array.isArray(concept.concept)) {
      options.push(...flattenConcepts(concept.concept, system));
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

  const valueSet = registry.valueSetsByUrl.get(normalized);
  if (!valueSet) return [];

  const options: CodingOption[] = [];

  if (Array.isArray(valueSet.expansion?.contains)) {
    for (const entry of valueSet.expansion?.contains ?? []) {
      if (entry.code) {
        options.push({
          system: entry.system,
          code: entry.code,
          display: entry.display,
        });
      }
      if (Array.isArray(entry.contains)) {
        for (const nested of entry.contains) {
          if (!nested.code) continue;
          options.push({
            system: nested.system ?? entry.system,
            code: nested.code,
            display: nested.display,
          });
        }
      }
    }
    return options;
  }

  const includes = valueSet.compose?.include ?? [];
  for (const include of includes) {
    if (Array.isArray(include.concept) && include.concept.length > 0) {
      options.push(...flattenConcepts(include.concept, include.system));
    }
    if (include.system) {
      const codeSystem = registry.codeSystemsByUrl.get(normalizeCanonical(include.system));
      if (codeSystem?.concept) {
        options.push(...flattenConcepts(codeSystem.concept, codeSystem.url));
      }
    }
    if (Array.isArray(include.valueSet)) {
      for (const nestedValueSet of include.valueSet) {
        options.push(...resolveValueSetOptionsInternal(nestedValueSet, registry, visited));
      }
    }
  }

  return options;
};

export const resolveValueSetOptions = (
  canonical: string | undefined,
  registry: FhirRegistry
): CodingOption[] => {
  const options = resolveValueSetOptionsInternal(canonical, registry, new Set<string>());
  const unique = new Map<string, CodingOption>();
  for (const option of options) {
    const key = `${option.system ?? ""}|${option.code}`;
    if (!unique.has(key)) {
      unique.set(key, option);
    }
  }
  return Array.from(unique.values());
};
