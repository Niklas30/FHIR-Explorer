import type { SchemaContext, SchemaNode } from "@/lib/fhir-editor/schema/types";
import { getExtensionUrl } from "@/lib/fhir-editor/schema/tree";
import { isRecord, matchesPattern } from "@/lib/fhir-editor/schema/values";

/**
 * Derives the discriminating pattern of a named slice: the fixed/pattern
 * values on the slice itself and its direct children. Extension slices
 * discriminate on their url.
 */
export const getSliceDiscriminatorPattern = (
  slice: SchemaNode,
  ctx: SchemaContext
): Record<string, unknown> | null => {
  if (slice.types.some((type) => type.code === "Extension")) {
    const url = getExtensionUrl(slice, ctx);
    return url ? { url } : null;
  }

  const ownValue = slice.fixedValue ?? slice.patternValue;
  if (isRecord(ownValue)) {
    return ownValue;
  }

  const pattern: Record<string, unknown> = {};
  for (const child of slice.children) {
    const childValue = child.fixedValue ?? child.patternValue;
    if (childValue === undefined) continue;
    pattern[child.key] = childValue;
  }
  return Object.keys(pattern).length > 0 ? pattern : null;
};

export const matchesSlice = (
  slice: SchemaNode,
  item: unknown,
  ctx: SchemaContext
): boolean => {
  const pattern = getSliceDiscriminatorPattern(slice, ctx);
  if (!pattern) return false;
  return matchesPattern(item, pattern);
};

export type SlicedItems = {
  /** Items grouped per slice name, keeping their index in the source array. */
  bySlice: Map<string, Array<{ item: unknown; index: number }>>;
  /** Items not claimed by any slice. */
  rest: Array<{ item: unknown; index: number }>;
};

/**
 * Partitions the serialized items of a repeating element into the profile's
 * named slices. Items that match no slice discriminator stay in `rest`.
 */
export const partitionItemsBySlice = (
  node: SchemaNode,
  items: unknown[],
  ctx: SchemaContext
): SlicedItems => {
  const bySlice = new Map<string, Array<{ item: unknown; index: number }>>();
  for (const slice of node.slices) {
    if (slice.sliceName) bySlice.set(slice.sliceName, []);
  }
  const rest: Array<{ item: unknown; index: number }> = [];

  items.forEach((item, index) => {
    const owner = node.slices.find((slice) => matchesSlice(slice, item, ctx));
    if (owner?.sliceName) {
      bySlice.get(owner.sliceName)?.push({ item, index });
    } else {
      rest.push({ item, index });
    }
  });

  return { bySlice, rest };
};
