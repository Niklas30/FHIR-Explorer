import { modify, type JSONPath, type FormattingOptions } from "jsonc-parser";

/**
 * Turns "the resource now looks like this" into the smallest set of text
 * edits that make it so.
 *
 * Replacing the whole document on every keystroke would work and be much
 * simpler — and would also reformat the file, destroy the user's own layout
 * and turn a one-field change into a whole-file diff in git. Since the files
 * are the deliverable here, that is not acceptable.
 */

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  Boolean(value && typeof value === "object" && !Array.isArray(value));

const deepEqual = (a: unknown, b: unknown): boolean => {
  if (a === b) return true;
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
    return a.every((entry, index) => deepEqual(entry, b[index]));
  }
  if (isPlainObject(a) && isPlainObject(b)) {
    const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
    for (const key of keys) if (!deepEqual(a[key], b[key])) return false;
    return true;
  }
  return false;
};

export type JsonChange = { path: JSONPath; value: unknown };

/**
 * Objects are compared key by key so an untouched sibling keeps its exact
 * bytes. Arrays are replaced wholesale — element-wise edits would have to
 * reason about insertions and removals shifting every later index, and FHIR
 * arrays are short enough that the difference does not matter.
 */
export const collectChanges = (
  previous: unknown,
  next: unknown,
  path: JSONPath = []
): JsonChange[] => {
  if (deepEqual(previous, next)) return [];

  if (isPlainObject(previous) && isPlainObject(next)) {
    const changes: JsonChange[] = [];
    for (const key of new Set([...Object.keys(previous), ...Object.keys(next)])) {
      changes.push(...collectChanges(previous[key], next[key], [...path, key]));
    }
    return changes;
  }

  // `undefined` tells jsonc-parser to remove the property.
  return [{ path, value: next }];
};

/**
 * Apply the changes to `text`, one after another, so later edits see the
 * offsets the earlier ones produced.
 */
export const applyChanges = (
  text: string,
  changes: JsonChange[],
  formatting: FormattingOptions
): string => {
  let result = text;
  for (const change of changes) {
    const edits = modify(result, change.path, change.value, {
      formattingOptions: formatting,
    });
    for (const edit of edits) {
      result =
        result.slice(0, edit.offset) +
        edit.content +
        result.slice(edit.offset + edit.length);
    }
  }
  return result;
};

export type TextReplacement = { start: number; end: number; text: string };

/**
 * The single span in which two texts differ.
 *
 * The edit is applied to the document as one replacement, and replacing the
 * whole file would move every cursor and selection in an open text editor
 * split — including the user's, while they are looking at it. Trimming the
 * shared prefix and suffix keeps the replacement over the bytes that actually
 * changed.
 */
export const narrowReplacement = (
  previous: string,
  next: string
): TextReplacement | null => {
  if (previous === next) return null;

  let start = 0;
  const maxStart = Math.min(previous.length, next.length);
  while (start < maxStart && previous[start] === next[start]) start += 1;

  let fromEnd = 0;
  const maxEnd = Math.min(previous.length - start, next.length - start);
  while (
    fromEnd < maxEnd &&
    previous[previous.length - 1 - fromEnd] === next[next.length - 1 - fromEnd]
  ) {
    fromEnd += 1;
  }

  return {
    start,
    end: previous.length - fromEnd,
    text: next.slice(start, next.length - fromEnd),
  };
};
