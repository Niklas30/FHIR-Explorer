import type {
  ElementDefinition,
  ElementDefinitionType,
  FhirRegistry,
  StructureDefinition,
} from "@/lib/fhir-editor/registry";

/**
 * ElementDefinition properties that the schema engine relies on beyond the
 * minimal shape declared in the registry. Real snapshots carry `base`,
 * `sliceName`, `contentReference` and fixed/pattern values.
 */
export type SchemaElementDefinition = ElementDefinition & {
  sliceName?: string;
  slicing?: { discriminator?: Array<{ type?: string; path?: string }>; rules?: string };
  contentReference?: string;
  base?: { path?: string; min?: number; max?: string };
  isModifier?: boolean;
  isSummary?: boolean;
  // fixed[x] / pattern[x] live under dynamic keys (fixedUri, patternCodeableConcept, ...)
  [key: string]: unknown;
};

export type SchemaNode = {
  /** JSON property name of this element ("name", "value" for value[x], ...). */
  key: string;
  /** Element id from the snapshot (unique within the tree). */
  elementId: string;
  /** Element path, e.g. "Patient.contact.name". */
  path: string;
  /** Human readable label derived from the key / slice name. */
  label: string;
  short?: string;
  definition?: string;
  min: number;
  max: string;
  /**
   * Structural cardinality of the element in the base resource/datatype.
   * Determines the JSON shape (array vs single value) even when a profile
   * constrains max to 1.
   */
  baseMax?: string;
  /** True when the serialized JSON value is an array. */
  isArray: boolean;
  types: ElementDefinitionType[];
  /** True when the element is a choice element (path ends with [x]). */
  isChoice: boolean;
  binding?: ElementDefinition["binding"];
  fixedValue?: unknown;
  patternValue?: unknown;
  mustSupport?: boolean;
  isModifier?: boolean;
  sliceName?: string;
  /** Named slices constraining this element (profile-defined). */
  slices: SchemaNode[];
  /** Reference to another element in the same tree ("#Questionnaire.item"). */
  contentReference?: string;
  /** Inline children from the same snapshot (BackboneElements, constrained sub-elements). */
  children: SchemaNode[];
};

export type SchemaTree = {
  /** Resource or datatype root, e.g. "Patient" or "HumanName". */
  rootType: string;
  /** The StructureDefinition the tree was built from. */
  definition: StructureDefinition;
  root: SchemaNode;
};

export type SchemaContext = {
  registry: FhirRegistry;
  /** Generated/normalized snapshot elements per StructureDefinition. */
  snapshotCache: Map<StructureDefinition, SchemaElementDefinition[]>;
  /** Built schema trees per canonical URL (datatypes, profiles). */
  treeCache: Map<string, SchemaTree | null>;
  /** Guards recursive snapshot generation against baseDefinition cycles. */
  inProgress: Set<StructureDefinition>;
};

export const createSchemaContext = (registry: FhirRegistry): SchemaContext => ({
  registry,
  snapshotCache: new Map(),
  treeCache: new Map(),
  inProgress: new Set(),
});

export const FHIR_CORE_URL_PREFIX = "http://hl7.org/fhir/StructureDefinition/";

export const isUppercaseTypeCode = (code: string) =>
  code.length > 0 && code[0] === code[0].toUpperCase();

/** Types whose children are defined inline in the parent snapshot. */
export const isInlineType = (code: string | undefined) =>
  code === "BackboneElement" || code === "Element";

export const getFixedValue = (element: SchemaElementDefinition): unknown => {
  for (const key of Object.keys(element)) {
    if (key.startsWith("fixed") && key.length > 5 && /[A-Z]/.test(key[5])) {
      return element[key];
    }
  }
  return undefined;
};

export const getPatternValue = (element: SchemaElementDefinition): unknown => {
  for (const key of Object.keys(element)) {
    if (key.startsWith("pattern") && key.length > 7 && /[A-Z]/.test(key[7])) {
      return element[key];
    }
  }
  return undefined;
};
