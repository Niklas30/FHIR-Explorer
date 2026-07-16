import type { StructureDefinition } from "@/lib/fhir-editor/registry";
import { getStructureDefinitionByCanonical } from "@/lib/fhir-editor/registry";
import { resolveSnapshotElements } from "@/lib/fhir-editor/schema/snapshot";
import {
  FHIR_CORE_URL_PREFIX,
  getFixedValue,
  getPatternValue,
  isInlineType,
  isUppercaseTypeCode,
  type SchemaContext,
  type SchemaElementDefinition,
  type SchemaNode,
  type SchemaTree,
} from "@/lib/fhir-editor/schema/types";

const CHOICE_SUFFIX = "[x]";

const humanize = (value: string) =>
  value
    .replace(/[-_]/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^\w/, (char) => char.toUpperCase());

const lastIdSegment = (id: string) => {
  const segment = id.split(".").pop() ?? id;
  return segment;
};

const buildNodeFromElement = (element: SchemaElementDefinition): SchemaNode => {
  const path = element.path ?? "";
  const rawName = path.split(".").pop() ?? path;
  const isChoice = rawName.endsWith(CHOICE_SUFFIX);
  const key = isChoice ? rawName.slice(0, -CHOICE_SUFFIX.length) : rawName;
  const sliceName =
    element.sliceName ??
    (() => {
      const idTail = element.id ? lastIdSegment(element.id) : "";
      const colonIndex = idTail.indexOf(":");
      return colonIndex !== -1 ? idTail.slice(colonIndex + 1) : undefined;
    })();

  const baseMax = element.base?.max ?? element.max;

  return {
    key,
    elementId: element.id ?? path,
    path,
    label: sliceName ? `${humanize(key)} (${sliceName})` : humanize(key),
    short: element.short,
    definition: element.definition,
    min: element.min ?? 0,
    max: element.max ?? (baseMax === "1" ? "1" : "*"),
    baseMax,
    isArray: baseMax !== "1" && baseMax !== "0",
    types: element.type ?? [],
    isChoice,
    binding: element.binding,
    fixedValue: getFixedValue(element),
    patternValue: getPatternValue(element),
    mustSupport: element.mustSupport,
    isModifier: element.isModifier,
    sliceName,
    slices: [],
    contentReference: element.contentReference,
    children: [],
  };
};

/**
 * Builds the node hierarchy from a flat snapshot element list using element
 * ids: the parent of "A.b:slice.c" is "A.b:slice", the parent of "A.b" is
 * "A". Slices (id tail contains ":") attach to the base node of the same
 * path via `slices` instead of `children`.
 */
export const buildTreeFromElements = (
  elements: SchemaElementDefinition[]
): SchemaNode | null => {
  if (elements.length === 0) return null;

  const rootElement = elements[0];
  const rootNode = buildNodeFromElement(rootElement);
  const nodesById = new Map<string, SchemaNode>();
  nodesById.set(rootNode.elementId, rootNode);

  for (let index = 1; index < elements.length; index += 1) {
    const element = elements[index];
    if (!element.path) continue;
    const node = buildNodeFromElement(element);
    if (node.max === "0") continue;

    const id = node.elementId;
    const dotIndex = id.lastIndexOf(".");
    const parentId = dotIndex === -1 ? "" : id.slice(0, dotIndex);
    const parent = nodesById.get(parentId) ?? rootNode;

    const idTail = lastIdSegment(id);
    if (idTail.includes(":")) {
      // Named slice: attach to the unsliced sibling with the same path.
      const sliceBase = parent.children.find(
        (child) => child.path === node.path && !child.sliceName
      );
      if (sliceBase) {
        sliceBase.slices.push(node);
      } else {
        parent.children.push(node);
      }
    } else {
      parent.children.push(node);
    }
    nodesById.set(id, node);
  }

  return rootNode;
};

const resolveTypeCanonicals = (node: SchemaNode, typeCode: string): string[] => {
  const canonicals: string[] = [];
  for (const type of node.types) {
    if (type.code !== typeCode) continue;
    for (const profile of type.profile ?? []) {
      if (profile) canonicals.push(profile);
    }
  }
  canonicals.push(`${FHIR_CORE_URL_PREFIX}${typeCode}`);
  return canonicals;
};

/**
 * Builds (and caches) the schema tree for a datatype / profile canonical.
 */
export const getSchemaTreeByCanonical = (
  canonical: string,
  ctx: SchemaContext
): SchemaTree | null => {
  if (ctx.treeCache.has(canonical)) {
    return ctx.treeCache.get(canonical) ?? null;
  }
  // Reserve the slot to break recursion cycles (Extension.extension → Extension).
  ctx.treeCache.set(canonical, null);

  const definition = getStructureDefinitionByCanonical(ctx.registry, canonical);
  if (!definition) return null;

  const tree = buildSchemaTree(definition, ctx);
  ctx.treeCache.set(canonical, tree);
  return tree;
};

export const buildSchemaTree = (
  definition: StructureDefinition,
  ctx: SchemaContext
): SchemaTree | null => {
  const elements = resolveSnapshotElements(definition, ctx);
  const root = buildTreeFromElements(elements);
  if (!root) return null;
  return {
    rootType: root.path,
    definition,
    root,
  };
};

const mergeConstraintOverType = (
  typeChild: SchemaNode,
  constraint: SchemaNode
): SchemaNode => ({
  ...typeChild,
  ...constraint,
  types: constraint.types.length > 0 ? constraint.types : typeChild.types,
  binding: constraint.binding ?? typeChild.binding,
  short: constraint.short ?? typeChild.short,
  definition: constraint.definition ?? typeChild.definition,
  fixedValue: constraint.fixedValue ?? typeChild.fixedValue,
  patternValue: constraint.patternValue ?? typeChild.patternValue,
  baseMax: typeChild.baseMax ?? constraint.baseMax,
  isArray: typeChild.isArray,
  slices: constraint.slices.length > 0 ? constraint.slices : typeChild.slices,
  children:
    constraint.children.length > 0 ? constraint.children : typeChild.children,
});

const findNodeByPath = (root: SchemaNode, path: string): SchemaNode | null => {
  if (root.path === path) return root;
  const queue: SchemaNode[] = [...root.children];
  while (queue.length > 0) {
    const current = queue.shift() as SchemaNode;
    if (current.path === path) return current;
    for (const child of current.children) queue.push(child);
    for (const slice of current.slices) queue.push(slice);
  }
  return null;
};

export type ResolvedChildren = {
  children: SchemaNode[];
  /** Where the children came from — useful for tests and debugging. */
  source: "inline" | "datatype" | "content-reference" | "none";
};

/**
 * Resolves the editable children of a node for a concrete type code.
 *
 * - BackboneElement/Element children are defined inline in the snapshot.
 * - Complex datatype children come from the datatype's own
 *   StructureDefinition; inline constraint children are merged on top.
 * - contentReference points at another node in the same tree (recursion).
 */
export const getNodeChildren = (
  node: SchemaNode,
  typeCode: string | undefined,
  ctx: SchemaContext,
  ownerTree?: SchemaTree
): ResolvedChildren => {
  if (node.contentReference && ownerTree) {
    const referencedPath = node.contentReference.startsWith("#")
      ? node.contentReference.slice(1)
      : node.contentReference;
    const referenced = findNodeByPath(ownerTree.root, referencedPath);
    if (referenced) {
      return {
        children: referenced.children,
        source: "content-reference",
      };
    }
  }

  if (!typeCode || !isUppercaseTypeCode(typeCode) || isInlineType(typeCode)) {
    return node.children.length > 0
      ? { children: node.children, source: "inline" }
      : { children: [], source: "none" };
  }

  // Complex datatype: expand from the datatype definition.
  let datatypeChildren: SchemaNode[] = [];
  for (const canonical of resolveTypeCanonicals(node, typeCode)) {
    const tree = getSchemaTreeByCanonical(canonical, ctx);
    if (tree && tree.root.children.length > 0) {
      datatypeChildren = tree.root.children;
      break;
    }
  }

  if (datatypeChildren.length === 0) {
    return node.children.length > 0
      ? { children: node.children, source: "inline" }
      : { children: [], source: "none" };
  }

  if (node.children.length === 0) {
    return { children: datatypeChildren, source: "datatype" };
  }

  // Merge profile constraints over the datatype children, keeping datatype order.
  const constraintsByKey = new Map(node.children.map((child) => [child.key, child]));
  const merged: SchemaNode[] = datatypeChildren.map((typeChild) => {
    const constraint = constraintsByKey.get(typeChild.key);
    if (!constraint) return typeChild;
    constraintsByKey.delete(typeChild.key);
    return mergeConstraintOverType(typeChild, constraint);
  });
  for (const leftover of constraintsByKey.values()) {
    merged.push(leftover);
  }
  return { children: merged, source: "datatype" };
};

/**
 * Resolves the resource types a Reference element may point to, mapping
 * custom profiles back to their resource type.
 */
export const getReferenceTargetTypes = (
  node: SchemaNode,
  ctx: SchemaContext
): Set<string> => {
  const targets = new Set<string>();
  for (const type of node.types) {
    if (type.code !== "Reference") continue;
    const profiles = type.targetProfile ?? [];
    if (profiles.length === 0) {
      targets.add("*");
      continue;
    }
    for (const canonical of profiles) {
      if (!canonical) continue;
      const definition = getStructureDefinitionByCanonical(ctx.registry, canonical);
      const resolved = definition?.type ?? canonical.split("/").pop();
      if (resolved === "Resource") {
        targets.add("*");
      } else if (resolved) {
        targets.add(resolved);
      }
    }
  }
  return targets;
};

/** Resolves the schema tree describing a profiled extension. */
export const getExtensionDefinitionTree = (
  node: SchemaNode,
  ctx: SchemaContext
): SchemaTree | null => {
  for (const type of node.types) {
    if (type.code !== "Extension") continue;
    for (const profile of type.profile ?? []) {
      if (!profile) continue;
      const tree = getSchemaTreeByCanonical(profile, ctx);
      if (tree) return tree;
    }
  }
  return null;
};

/** Fixed/pattern url declared on an extension slice (Extension.url). */
export const getExtensionUrl = (node: SchemaNode, ctx: SchemaContext): string | undefined => {
  for (const type of node.types) {
    if (type.code !== "Extension") continue;
    const profile = (type.profile ?? []).find(Boolean);
    if (profile) return profile.split("|")[0];
  }
  const urlChild = node.children.find((child) => child.key === "url");
  const fixed = urlChild?.fixedValue ?? urlChild?.patternValue;
  if (typeof fixed === "string") return fixed;
  const tree = getExtensionDefinitionTree(node, ctx);
  return tree?.definition.url;
};
