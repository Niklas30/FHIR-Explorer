import * as vscode from "vscode";
import { findNodeAtOffset, parseTree } from "jsonc-parser";

/** A JSON string literal under the cursor, with the range of its content. */
export type StringAtPosition = {
  value: string;
  /** Range of the text inside the quotes, so highlights do not cover them. */
  range: vscode.Range;
  /** Property name this string belongs to, when it is a property value. */
  propertyKey: string | undefined;
};

export const stringAtPosition = (
  document: vscode.TextDocument,
  position: vscode.Position
): StringAtPosition | undefined => {
  const root = parseTree(document.getText());
  if (!root) return undefined;

  const node = findNodeAtOffset(root, document.offsetAt(position));
  if (!node || node.type !== "string" || typeof node.value !== "string") return undefined;

  // The key half of a property is not a value we resolve.
  const parent = node.parent;
  if (parent?.type === "property" && parent.children?.[0] === node) return undefined;

  const propertyKey =
    parent?.type === "property" && typeof parent.children?.[0]?.value === "string"
      ? (parent.children[0].value as string)
      : parent?.type === "array" &&
          parent.parent?.type === "property" &&
          typeof parent.parent.children?.[0]?.value === "string"
        ? (parent.parent.children[0].value as string)
        : undefined;

  return {
    value: node.value,
    range: new vscode.Range(
      document.positionAt(node.offset + 1),
      document.positionAt(node.offset + node.length - 1)
    ),
    propertyKey,
  };
};
