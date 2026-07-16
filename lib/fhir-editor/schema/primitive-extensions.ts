import type { SchemaNode } from "@/lib/fhir-editor/schema/types";

/**
 * Primitive extensions: FHIR serializes extensions on primitive values into
 * a sibling property prefixed with an underscore ("birthDate" →
 * "_birthDate": { "extension": [...] }). This module models that companion
 * object so the editor can offer structured extension editing on primitives.
 */

export const getPrimitiveCompanionKey = (valueKey: string) => `_${valueKey}`;

/**
 * Synthetic schema node for the `extension` list inside a primitive's
 * companion object. Mirrors Element.extension (0..*).
 */
export const createPrimitiveExtensionNode = (node: SchemaNode): SchemaNode => ({
  key: "extension",
  elementId: `${node.elementId}.__primitive-extension`,
  path: `${node.path}.extension`,
  label: "Extension",
  short: "Additional content defined by implementations",
  min: 0,
  max: "*",
  baseMax: "*",
  isArray: true,
  types: [{ code: "Extension" }],
  isChoice: false,
  slices: [],
  children: [],
});

export const isEmptyCompanion = (value: unknown): boolean => {
  if (value === null || value === undefined) return true;
  if (typeof value !== "object" || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  const extension = record.extension;
  const hasExtensions = Array.isArray(extension) && extension.length > 0;
  const otherKeys = Object.keys(record).filter((key) => key !== "extension");
  return !hasExtensions && otherKeys.length === 0;
};
