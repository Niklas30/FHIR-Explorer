import * as vscode from "vscode";
import { findNodeAtLocation, type Node } from "jsonc-parser";
import { toJsonSegments } from "@/language/fhir-path";

/**
 * Turns the validator's element paths into ranges in the open document.
 *
 * The validator reports `name[0].given` because that is how FHIR talks about
 * elements. The Problems panel needs a character range.
 */

const rangeOfNode = (document: vscode.TextDocument, node: Node): vscode.Range =>
  new vscode.Range(
    document.positionAt(node.offset),
    document.positionAt(node.offset + node.length)
  );

/**
 * Range of the property *name* rather than its value, so a diagnostic about a
 * field underlines the field instead of a possibly huge object literal.
 */
const rangeOfProperty = (
  document: vscode.TextDocument,
  node: Node
): vscode.Range => {
  const key = node.parent?.type === "property" ? node.parent.children?.[0] : undefined;
  return rangeOfNode(document, key ?? node);
};

/**
 * Where to report an issue at `path`.
 *
 * A missing required element has no node of its own, so we walk up to the
 * closest ancestor that does exist — the user is pointed at the object that
 * should have contained it, which is where the fix goes.
 */
export const rangeForPath = (
  document: vscode.TextDocument,
  root: Node | undefined,
  path: string
): vscode.Range => {
  if (!root) return new vscode.Range(0, 0, 0, 0);

  const segments = toJsonSegments(path);
  for (let length = segments.length; length > 0; length -= 1) {
    const node = findNodeAtLocation(root, segments.slice(0, length));
    if (!node) continue;
    return length === segments.length
      ? rangeOfProperty(document, node)
      : rangeOfNode(document, node);
  }

  // Nothing on the path exists: point at the root object, but only its first
  // line so the whole file is not highlighted.
  return document.lineAt(document.positionAt(root.offset).line).range;
};
