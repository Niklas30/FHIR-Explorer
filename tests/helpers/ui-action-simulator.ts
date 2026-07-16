import {
  asItems,
  createDefaultFieldValue,
  getChoiceKeys,
  getNodeChildren,
  getNodeKey,
  isRecord,
  setChildValue,
  type SchemaContext,
  type SchemaNode,
  type SchemaTree,
} from "@/lib/fhir-editor/schema";

/**
 * Simulates the editor's value operations: every UI interaction boils down
 * to an immutable record update at some nesting level, exactly like
 * ElementEditor does via setChildValue.
 */

export const findChildNode = (
  children: SchemaNode[],
  key: string,
  sliceName?: string
): SchemaNode => {
  const node = children.find((child) =>
    sliceName
      ? child.key === key &&
        (child.sliceName === sliceName ||
          child.slices.some((slice) => slice.sliceName === sliceName))
      : child.key === key && !child.sliceName
  );
  if (!node) {
    throw new Error(`Schema node not found: ${key}${sliceName ? `:${sliceName}` : ""}`);
  }
  if (sliceName && node.sliceName !== sliceName) {
    const slice = node.slices.find((entry) => entry.sliceName === sliceName);
    if (!slice) throw new Error(`Slice not found: ${key}:${sliceName}`);
    return slice;
  }
  return node;
};

export const getRootChildren = (tree: SchemaTree, ctx: SchemaContext) =>
  getNodeChildren(tree.root, undefined, ctx, tree).children;

/** "Add field" — sets the node's default value on the record. */
export const addElement = (
  content: Record<string, unknown>,
  node: SchemaNode
): Record<string, unknown> =>
  setChildValue(content, getNodeKey(node), createDefaultFieldValue(node));

/** "Remove field" — clears all keys the node may occupy. */
export const removeElement = (
  content: Record<string, unknown>,
  node: SchemaNode
): Record<string, unknown> => {
  let next = content;
  const keys = node.isChoice ? getChoiceKeys(node) : [node.key];
  for (const key of keys) {
    next = setChildValue(next, key, undefined);
  }
  return next;
};

export const setElement = (
  content: Record<string, unknown>,
  key: string,
  value: unknown
): Record<string, unknown> => setChildValue(content, key, value);

/** "Add entry" on a repeating element. */
export const addItem = (
  content: Record<string, unknown>,
  key: string,
  item: unknown
): Record<string, unknown> =>
  setChildValue(content, key, [...asItems(content[key]), item]);

export const updateItem = (
  content: Record<string, unknown>,
  key: string,
  index: number,
  value: unknown
): Record<string, unknown> => {
  const items = [...asItems(content[key])];
  while (items.length <= index) items.push(undefined);
  items[index] = value;
  return setChildValue(content, key, items);
};

export const removeItemAt = (
  content: Record<string, unknown>,
  key: string,
  index: number
): Record<string, unknown> =>
  setChildValue(
    content,
    key,
    asItems(content[key]).filter((_, currentIndex) => currentIndex !== index)
  );

export const moveItem = (
  content: Record<string, unknown>,
  key: string,
  index: number,
  direction: -1 | 1
): Record<string, unknown> => {
  const items = [...asItems(content[key])];
  const target = index + direction;
  if (target < 0 || target >= items.length) return content;
  const [entry] = items.splice(index, 1);
  items.splice(target, 0, entry);
  return setChildValue(content, key, items);
};

export const duplicateItem = (
  content: Record<string, unknown>,
  key: string,
  index: number
): Record<string, unknown> => {
  const items = [...asItems(content[key])];
  items.splice(index + 1, 0, JSON.parse(JSON.stringify(items[index] ?? null)));
  return setChildValue(content, key, items);
};

/** Edits one repeating item as a record, like a nested ElementEditor does. */
export const withItem = (
  content: Record<string, unknown>,
  key: string,
  index: number,
  update: (item: Record<string, unknown>) => Record<string, unknown>
): Record<string, unknown> => {
  const items = [...asItems(content[key])];
  while (items.length <= index) items.push({});
  const current = isRecord(items[index]) ? (items[index] as Record<string, unknown>) : {};
  items[index] = update(current);
  return setChildValue(content, key, items);
};
