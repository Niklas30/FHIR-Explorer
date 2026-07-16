export const IDENTIFIER_USE_OPTIONS = ["usual", "official", "temp", "secondary", "old"] as const;

export const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value && typeof value === "object" && !Array.isArray(value));

export type CodingKind = "Coding" | "CodeableConcept";

/**
 * Reads the coding being edited. A Coding element IS the coding itself;
 * a CodeableConcept carries it in coding[0]. Coding values that were
 * corrupted into CodeableConcept shape by earlier editor versions are
 * still read from coding[0] so their content stays visible.
 */
export const readCoding = (kind: CodingKind, value: unknown): Record<string, unknown> => {
  if (!isRecord(value)) return {};
  const nested = value.coding;
  if (Array.isArray(nested) && nested.length > 0 && isRecord(nested[0])) {
    return nested[0];
  }
  return kind === "Coding" ? value : {};
};

/**
 * Writes the coding back in the shape the element type requires. Coding
 * elements are written flat (system/code/display on the value itself) —
 * never wrapped in a coding array; a stray coding key from earlier corrupt
 * edits is dropped on write, which self-heals the data.
 */
export const writeCoding = (
  kind: CodingKind,
  value: Record<string, unknown>,
  coding: Record<string, unknown>
): Record<string, unknown> => {
  if (kind === "Coding") {
    const rest = { ...value };
    delete rest.coding;
    delete rest.text;
    return { ...rest, ...coding };
  }
  return { ...value, coding: [coding] };
};
