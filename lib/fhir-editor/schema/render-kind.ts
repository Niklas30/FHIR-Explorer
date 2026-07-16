import { isUppercaseTypeCode } from "@/lib/fhir-editor/schema/types";

/** Primitive input widgets the editor knows how to render. */
export type PrimitiveKind =
  | "string"
  | "markdown"
  | "xhtml"
  | "boolean"
  | "integer"
  | "decimal"
  | "date"
  | "dateTime"
  | "time"
  | "code"
  | "uri"
  | "base64Binary";

export type RenderKind =
  | { kind: "primitive"; primitive: PrimitiveKind }
  | { kind: "Reference" }
  | { kind: "Coding" }
  | { kind: "CodeableConcept" }
  | { kind: "Identifier" }
  | { kind: "Extension" }
  | { kind: "Narrative" }
  | { kind: "Quantity" }
  | { kind: "ContactPoint" }
  | { kind: "complex"; typeCode: string }
  | { kind: "json" };

const PRIMITIVE_MAP: Record<string, PrimitiveKind> = {
  string: "string",
  id: "string",
  markdown: "markdown",
  xhtml: "xhtml",
  boolean: "boolean",
  integer: "integer",
  positiveInt: "integer",
  unsignedInt: "integer",
  integer64: "integer",
  decimal: "decimal",
  date: "date",
  dateTime: "dateTime",
  instant: "dateTime",
  time: "time",
  code: "code",
  uri: "uri",
  url: "uri",
  canonical: "uri",
  oid: "uri",
  uuid: "uri",
  base64Binary: "base64Binary",
};

/** Complex datatypes with dedicated editors (everything else recurses generically). */
const DEDICATED_COMPLEX = new Set([
  "Reference",
  "Coding",
  "CodeableConcept",
  "Identifier",
  "Extension",
  "Narrative",
  "ContactPoint",
]);

/** Quantity and its specializations share the Quantity editor. */
const QUANTITY_TYPES = new Set([
  "Quantity",
  "SimpleQuantity",
  "Age",
  "Distance",
  "Duration",
  "Count",
  "MoneyQuantity",
]);

/**
 * Maps a FHIR type code to the renderer for it. Unknown lowercase codes fall
 * back to a string input, unknown complex codes recurse generically — the
 * JSON fallback is only used when no type information exists at all.
 */
export const resolveRenderKind = (typeCode: string | undefined): RenderKind => {
  if (!typeCode) return { kind: "json" };
  const primitive = PRIMITIVE_MAP[typeCode];
  if (primitive) return { kind: "primitive", primitive };
  if (!isUppercaseTypeCode(typeCode)) {
    // Unknown primitive: edit as plain string rather than raw JSON.
    return { kind: "primitive", primitive: "string" };
  }
  if (QUANTITY_TYPES.has(typeCode)) {
    return { kind: "Quantity" };
  }
  if (DEDICATED_COMPLEX.has(typeCode)) {
    return { kind: typeCode } as RenderKind;
  }
  return { kind: "complex", typeCode };
};
