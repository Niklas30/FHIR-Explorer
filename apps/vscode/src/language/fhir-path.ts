/**
 * Translation between the validator's element paths and JSON locations.
 *
 * Deliberately free of any `vscode` import: this is the piece with the fiddly
 * parsing rules, so it has to stay unit-testable outside the extension host.
 */

export type JsonSegment = string | number;

/**
 * `contact[1].name.given` -> `["contact", 1, "name", "given"]`.
 *
 * Keys are taken verbatim apart from the bracket suffixes, so an element name
 * containing a dot would split wrongly — FHIR element names cannot contain
 * one, so that case does not arise.
 */
export const toJsonSegments = (path: string): JsonSegment[] => {
  const segments: JsonSegment[] = [];
  for (const part of path.split(".")) {
    if (!part) continue;
    const bracket = part.indexOf("[");
    if (bracket === -1) {
      segments.push(part);
      continue;
    }
    const key = part.slice(0, bracket);
    if (key) segments.push(key);
    for (const index of part.slice(bracket).matchAll(/\[(\d+)\]/g)) {
      segments.push(Number(index[1]));
    }
  }
  return segments;
};
