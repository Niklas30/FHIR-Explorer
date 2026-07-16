import type { StructureDefinition } from "@/lib/fhir-editor/registry";
import { getStructureDefinitionByCanonical } from "@/lib/fhir-editor/registry";
import type { SchemaContext, SchemaElementDefinition } from "@/lib/fhir-editor/schema/types";

/**
 * Snapshot resolution.
 *
 * Many published profiles only ship a differential. To build a complete
 * editor model we need the full element list, so this module generates a
 * snapshot by resolving the baseDefinition chain and applying each
 * differential on top of the inherited snapshot:
 *
 * - property-level merge (differential wins per property)
 * - choice renames (diff "Patient.deceasedBoolean" matches base
 *   "Patient.deceased[x]")
 * - slices are inserted as new elements after their base element
 * - new child paths (e.g. "HealthcareService.meta.tag") are inserted in
 *   differential order after their parent region
 * - `base` cardinality is propagated so the JSON shape (array vs single)
 *   stays derivable after profiles constrain max
 */

const CHOICE_SUFFIX = "[x]";

const NON_INHERITED_KEYS = new Set([
  "id",
  "path",
  "sliceName",
  "slicing",
  "base",
  "condition",
  "constraint",
  "mapping",
  "extension",
  "example",
]);

const cloneElement = (element: SchemaElementDefinition): SchemaElementDefinition =>
  JSON.parse(JSON.stringify(element)) as SchemaElementDefinition;

const elementIdOf = (element: SchemaElementDefinition) => element.id ?? element.path ?? "";

const lastSegment = (path: string) => {
  const index = path.lastIndexOf(".");
  return index === -1 ? path : path.slice(index + 1);
};

const parentPathOf = (path: string) => {
  const index = path.lastIndexOf(".");
  return index === -1 ? "" : path.slice(0, index);
};

const capitalize = (value: string) =>
  value.length > 0 ? value[0].toUpperCase() + value.slice(1) : value;

/**
 * Matches a concrete choice key like "deceasedBoolean" against a choice
 * element name like "deceased[x]" and returns the selected type code.
 */
export const matchChoiceRename = (
  concreteName: string,
  choiceName: string
): string | undefined => {
  if (!choiceName.endsWith(CHOICE_SUFFIX)) return undefined;
  const stem = choiceName.slice(0, -CHOICE_SUFFIX.length);
  if (!concreteName.startsWith(stem) || concreteName.length <= stem.length) {
    return undefined;
  }
  const typePart = concreteName.slice(stem.length);
  if (typePart[0] !== typePart[0].toUpperCase()) return undefined;
  // Primitive type codes are lowercase ("boolean"), complex codes keep casing.
  return typePart;
};

const typeMatchesChoiceRename = (
  element: SchemaElementDefinition,
  renamedType: string
) => {
  const types = element.type ?? [];
  if (types.length === 0) return true;
  return types.some((entry) => {
    if (!entry.code) return false;
    return (
      capitalize(entry.code) === renamedType ||
      entry.code === renamedType
    );
  });
};

/**
 * Merges a differential element onto its matched base element.
 * Differential properties win; structural metadata stays from the base.
 */
const mergeDifferentialElement = (
  base: SchemaElementDefinition,
  diff: SchemaElementDefinition
): SchemaElementDefinition => {
  const merged: SchemaElementDefinition = cloneElement(base);
  for (const [key, value] of Object.entries(diff)) {
    if (value === undefined) continue;
    if (key === "base") continue;
    merged[key] = value;
  }
  merged.id = diff.id ?? base.id;
  merged.path = diff.path ?? base.path;
  if (!Array.isArray(diff.type) || diff.type.length === 0) {
    merged.type = base.type;
  }
  merged.min = diff.min ?? base.min;
  merged.max = diff.max ?? base.max;
  merged.binding = diff.binding ?? base.binding;
  // Propagate structural cardinality for JSON-shape decisions downstream.
  merged.base = base.base ?? {
    path: base.path,
    min: base.min,
    max: base.max,
  };
  return merged;
};

/** Creates a slice element inheriting structure from its sliced base element. */
const createSliceElement = (
  base: SchemaElementDefinition | undefined,
  diff: SchemaElementDefinition
): SchemaElementDefinition => {
  if (!base) {
    const clone = cloneElement(diff);
    clone.base = clone.base ?? { path: clone.path, min: clone.min, max: clone.max };
    return clone;
  }
  const inherited = cloneElement(base);
  for (const key of Object.keys(inherited)) {
    if (NON_INHERITED_KEYS.has(key)) delete inherited[key];
  }
  const merged = mergeDifferentialElement(
    { ...inherited, id: diff.id, path: diff.path },
    diff
  );
  merged.base = base.base ?? { path: base.path, min: base.min, max: base.max };
  return merged;
};

const reRootElements = (
  elements: SchemaElementDefinition[],
  fromRoot: string,
  toRoot: string
): SchemaElementDefinition[] => {
  if (fromRoot === toRoot) return elements.map(cloneElement);
  return elements.map((element) => {
    const clone = cloneElement(element);
    if (clone.path === fromRoot) {
      clone.path = toRoot;
      clone.id = toRoot;
    } else if (clone.path?.startsWith(`${fromRoot}.`)) {
      clone.path = `${toRoot}${clone.path.slice(fromRoot.length)}`;
      if (clone.id?.startsWith(`${fromRoot}.`) || clone.id === fromRoot) {
        clone.id = `${toRoot}${(clone.id ?? "").slice(fromRoot.length)}`;
      }
    }
    return clone;
  });
};

type WorkingList = {
  elements: SchemaElementDefinition[];
  /** Index of the element an id maps to. Rebuilt lazily after inserts. */
  findById: (id: string) => number;
  findByPath: (path: string) => number;
};

const createWorkingList = (elements: SchemaElementDefinition[]): WorkingList => {
  return {
    elements,
    findById: (id: string) =>
      elements.findIndex((entry) => elementIdOf(entry) === id),
    // The unsliced element for a path: neither a named slice nor inside one.
    findByPath: (path: string) =>
      elements.findIndex(
        (entry) =>
          entry.path === path &&
          !entry.sliceName &&
          !elementIdOf(entry).includes(":")
      ),
  };
};

/** True for slice roots AND their descendants ("a.b:slice", "a.b:slice.c"). */
const isSliceDiff = (diff: SchemaElementDefinition) => {
  if (diff.sliceName) return true;
  const id = diff.id;
  if (!id || !diff.path) return false;
  return id.includes(":");
};

/** Finds the end of the subtree region that starts at `index` (element + descendants + slices). */
const findRegionEnd = (
  elements: SchemaElementDefinition[],
  index: number
): number => {
  const start = elements[index];
  const startPath = start.path ?? "";
  const startId = elementIdOf(start);
  let end = index + 1;
  while (end < elements.length) {
    const candidate = elements[end];
    const candidatePath = candidate.path ?? "";
    const candidateId = elementIdOf(candidate);
    const isDescendantPath = candidatePath.startsWith(`${startPath}.`);
    const isSliceOfStart =
      candidatePath === startPath && Boolean(candidate.sliceName);
    const isDescendantId = candidateId.startsWith(`${startId}.`) || candidateId.startsWith(`${startId}:`);
    if (!isDescendantPath && !isSliceOfStart && !isDescendantId) break;
    end += 1;
  }
  return end;
};

const parentIdOf = (id: string) => {
  const index = id.lastIndexOf(".");
  return index === -1 ? "" : id.slice(0, index);
};

const applyDifferential = (
  baseElements: SchemaElementDefinition[],
  diffElements: SchemaElementDefinition[]
): SchemaElementDefinition[] => {
  const working = createWorkingList(baseElements.map(cloneElement));
  const elements = working.elements;

  /**
   * Inserts a new element at the end of its anchor region so that
   * depth-first order stays intact: slices land after the sliced base
   * element (and previous slices), new children land inside their parent
   * region.
   */
  const insertAtAnchor = (
    diff: SchemaElementDefinition,
    anchorIndex: number
  ) => {
    const insertAt =
      anchorIndex !== -1 ? findRegionEnd(elements, anchorIndex) : elements.length;
    elements.splice(insertAt, 0, diff);
  };

  for (const rawDiff of diffElements) {
    const diff = cloneElement(rawDiff);
    if (!diff.path) continue;
    const diffId = diff.id ?? diff.path;

    // Re-applied constraint on an element that already exists (by id).
    const existingIndex = working.findById(diffId);
    if (existingIndex !== -1) {
      elements[existingIndex] = mergeDifferentialElement(elements[existingIndex], diff);
      continue;
    }

    if (isSliceDiff(diff)) {
      const idTail = diffId.split(".").pop() ?? "";
      const isSliceRoot = idTail.includes(":");
      if (isSliceRoot) {
        // New named slice: inherit from the unsliced base element, insert
        // after the base element region (which includes earlier slices).
        const baseIndex = working.findByPath(diff.path);
        const template = baseIndex !== -1 ? elements[baseIndex] : undefined;
        insertAtAnchor(createSliceElement(template, diff), baseIndex);
        continue;
      }
      // Child of a slice ("identifier:TelematikID.system"): anchor at the
      // slice parent by id; inherit structure from the unsliced base child.
      const parentIndex = working.findById(parentIdOf(diffId));
      const baseChildIndex = working.findByPath(diff.path);
      const template = baseChildIndex !== -1 ? elements[baseChildIndex] : undefined;
      const child = template
        ? mergeDifferentialElement({ ...cloneElement(template), id: diffId }, diff)
        : (() => {
            diff.base = diff.base ?? { path: diff.path, min: diff.min, max: diff.max };
            return diff;
          })();
      child.id = diffId;
      insertAtAnchor(child, parentIndex);
      continue;
    }

    // Direct match by path.
    const directIndex = working.findByPath(diff.path);
    if (directIndex !== -1) {
      elements[directIndex] = mergeDifferentialElement(elements[directIndex], diff);
      continue;
    }

    // Choice rename: diff "X.valueString" onto base "X.value[x]".
    const diffName = lastSegment(diff.path);
    const diffParent = parentPathOf(diff.path);
    const choiceIndex = elements.findIndex((entry) => {
      if (!entry.path || entry.sliceName) return false;
      if (parentPathOf(entry.path) !== diffParent) return false;
      const renamedType = matchChoiceRename(diffName, lastSegment(entry.path));
      return Boolean(renamedType) && typeMatchesChoiceRename(entry, renamedType as string);
    });
    if (choiceIndex !== -1) {
      const choiceBase = elements[choiceIndex];
      const renamedType = matchChoiceRename(
        diffName,
        lastSegment(choiceBase.path ?? "")
      ) as string;
      const constrained = mergeDifferentialElement(choiceBase, diff);
      if (!Array.isArray(diff.type) || diff.type.length === 0) {
        const narrowed = (choiceBase.type ?? []).filter(
          (entry) =>
            entry.code && (capitalize(entry.code) === renamedType || entry.code === renamedType)
        );
        if (narrowed.length > 0) constrained.type = narrowed;
      }
      elements[choiceIndex] = constrained;
      continue;
    }

    // New child path (e.g. datatype sub-element not expanded in the base
    // snapshot, like "HealthcareService.meta.tag"): anchor inside the parent.
    diff.base = diff.base ?? { path: diff.path, min: diff.min, max: diff.max };
    const parentIndex = (() => {
      const byId = working.findById(parentIdOf(diffId));
      if (byId !== -1) return byId;
      return working.findByPath(diffParent);
    })();
    insertAtAnchor(diff, parentIndex);
  }

  return elements;
};

/**
 * Returns the complete snapshot element list for a StructureDefinition,
 * generating it from the differential and the baseDefinition chain when the
 * package did not ship a snapshot.
 */
export const resolveSnapshotElements = (
  definition: StructureDefinition,
  ctx: SchemaContext
): SchemaElementDefinition[] => {
  const cached = ctx.snapshotCache.get(definition);
  if (cached) return cached;

  const snapshotElements = (definition.snapshot?.element ?? []) as SchemaElementDefinition[];
  if (snapshotElements.length > 0) {
    ctx.snapshotCache.set(definition, snapshotElements);
    return snapshotElements;
  }

  const differentialElements = (definition.differential?.element ??
    []) as SchemaElementDefinition[];

  if (ctx.inProgress.has(definition)) {
    return differentialElements;
  }

  const base = definition.baseDefinition
    ? getStructureDefinitionByCanonical(ctx.registry, definition.baseDefinition)
    : undefined;
  if (!base || base === definition) {
    ctx.snapshotCache.set(definition, differentialElements);
    return differentialElements;
  }

  ctx.inProgress.add(definition);
  try {
    const baseSnapshot = resolveSnapshotElements(base, ctx);
    const baseRoot = baseSnapshot[0]?.path ?? base.type ?? "";
    const targetRoot =
      definition.type ??
      differentialElements[0]?.path?.split(".")[0] ??
      baseRoot;
    const reRooted = reRootElements(baseSnapshot, baseRoot, targetRoot);
    const generated = applyDifferential(reRooted, differentialElements);
    ctx.snapshotCache.set(definition, generated);
    return generated;
  } finally {
    ctx.inProgress.delete(definition);
  }
};
