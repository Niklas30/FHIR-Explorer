import type { ElementDefinitionType } from "@/lib/fhir-editor/registry";
import { isUppercaseTypeCode, type SchemaNode } from "@/lib/fhir-editor/schema/types";

const capitalize = (value: string) =>
  value.length > 0 ? value[0].toUpperCase() + value.slice(1) : value;

export const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value && typeof value === "object" && !Array.isArray(value));

/** JSON property name for a choice element serialized with the given type. */
export const getChoiceKey = (node: SchemaNode, typeCode: string) =>
  `${node.key}${capitalize(typeCode)}`;

/** JSON property name of a node — choice elements need a selected type. */
export const getNodeKey = (node: SchemaNode, typeCode?: string) => {
  if (!node.isChoice) return node.key;
  const code = typeCode ?? node.types[0]?.code;
  return code ? getChoiceKey(node, code) : node.key;
};

export type ChoicePresence = {
  type: ElementDefinitionType;
  key: string;
};

/** Detects which choice variant is present on the parent value, if any. */
export const detectChoiceType = (
  node: SchemaNode,
  parentValue: Record<string, unknown> | undefined
): ChoicePresence | null => {
  if (!node.isChoice || !parentValue) return null;
  for (const type of node.types) {
    if (!type.code) continue;
    const key = getChoiceKey(node, type.code);
    if (parentValue[key] !== undefined) {
      return { type, key };
    }
  }
  return null;
};

/** All keys a choice element could occupy on the parent object. */
export const getChoiceKeys = (node: SchemaNode) =>
  node.types
    .map((type) => (type.code ? getChoiceKey(node, type.code) : null))
    .filter((key): key is string => Boolean(key));

export const isNodePresent = (
  node: SchemaNode,
  parentValue: Record<string, unknown> | undefined
) => {
  if (!parentValue) return false;
  if (node.isChoice) return detectChoiceType(node, parentValue) !== null;
  return parentValue[node.key] !== undefined;
};

/** Immutable single-key update; `undefined` removes the key. */
export const setChildValue = (
  parent: Record<string, unknown>,
  key: string,
  value: unknown
): Record<string, unknown> => {
  if (value === undefined) {
    if (!(key in parent)) return parent;
    const next = { ...parent };
    delete next[key];
    return next;
  }
  return { ...parent, [key]: value };
};

const defaultPrimitiveValue = (typeCode: string): unknown => {
  switch (typeCode) {
    case "boolean":
      return false;
    case "integer":
    case "positiveInt":
    case "unsignedInt":
    case "decimal":
      return 0;
    default:
      return "";
  }
};

/**
 * Default value for adding a node instance. Pattern/fixed values from the
 * profile pre-fill the value where available.
 */
export const createDefaultValue = (
  node: SchemaNode,
  typeCode?: string
): unknown => {
  const fixedOrPattern = node.fixedValue ?? node.patternValue;
  if (fixedOrPattern !== undefined) {
    return typeof fixedOrPattern === "object" && fixedOrPattern !== null
      ? JSON.parse(JSON.stringify(fixedOrPattern))
      : fixedOrPattern;
  }
  const code = typeCode ?? node.types[0]?.code;
  if (!code) return {};
  if (!isUppercaseTypeCode(code)) {
    return defaultPrimitiveValue(code);
  }
  return {};
};

/** Default entry when adding to a repeating element (single item, not the array). */
export const createDefaultItem = (node: SchemaNode, typeCode?: string) =>
  createDefaultValue(node, typeCode);

/** Wraps a default in an array when the node is serialized as an array. */
export const createDefaultFieldValue = (node: SchemaNode, typeCode?: string) => {
  const item = createDefaultValue(node, typeCode);
  return node.isArray ? [item] : item;
};

export const asItems = (value: unknown): unknown[] => {
  if (Array.isArray(value)) return value;
  if (value === undefined || value === null) return [];
  return [value];
};

export const parseMaxCount = (max?: string): number | null => {
  if (!max || max === "*") return null;
  const parsed = Number(max);
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return parsed;
};

/**
 * Deep subset check: does `value` contain everything `pattern` requires?
 * Used for pattern[x] validation and slice discrimination.
 */
export const matchesPattern = (value: unknown, pattern: unknown): boolean => {
  if (pattern === null || pattern === undefined) return true;
  if (Array.isArray(pattern)) {
    if (!Array.isArray(value)) return false;
    return pattern.every((patternEntry) =>
      value.some((valueEntry) => matchesPattern(valueEntry, patternEntry))
    );
  }
  if (typeof pattern === "object") {
    if (!isRecord(value)) return false;
    return Object.entries(pattern as Record<string, unknown>).every(([key, entry]) =>
      matchesPattern(value[key], entry)
    );
  }
  return value === pattern;
};
