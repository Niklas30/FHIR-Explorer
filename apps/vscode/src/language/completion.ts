import * as vscode from "vscode";
import { getLocation } from "jsonc-parser";
import { resolveProfileForResource } from "@fhir-explorer/core/fhir-editor/profiles/resolve";
import { resolveValueSetOptions } from "@fhir-explorer/core/fhir-editor/registry";
import {
  buildSchemaTree,
  getChoiceKeys,
  getNodeChildren,
  type SchemaContext,
  type SchemaNode,
  type SchemaTree,
} from "@fhir-explorer/core/fhir-editor/schema";
import type { FhirIndex } from "@/language/fhir-index";

/**
 * Code completion for coded elements.
 *
 * The bound value set is already known to the schema engine — surfacing it at
 * the cursor is what turns "look the code up in the IG" into typing. This is
 * the one language feature the web app has no equivalent for at all: there it
 * is a dropdown inside the form, here it works in plain JSON.
 */

/** Property names whose value is a code from the element's binding. */
const CODE_KEYS = new Set(["code"]);

/** Walk the schema by the JSON path at the cursor. Array indices are skipped. */
const nodeAtPath = (
  tree: SchemaTree,
  ctx: SchemaContext,
  path: (string | number)[]
): SchemaNode | undefined => {
  let children = getNodeChildren(tree.root, undefined, ctx, tree).children;
  let current: SchemaNode | undefined;

  for (const segment of path) {
    if (typeof segment === "number") continue;
    const match =
      children.find((child) => !child.sliceName && child.key === segment) ??
      // Choice elements are serialized as `value` + type, e.g. `valueQuantity`.
      children.find(
        (child) => !child.sliceName && child.isChoice && getChoiceKeys(child).includes(segment)
      );
    if (!match) return undefined;
    current = match;
    children = getNodeChildren(match, undefined, ctx, tree).children;
  }

  return current;
};

/**
 * The element whose binding applies at the cursor.
 *
 * `Patient.gender` binds on the element itself; `…code.coding[0].code` binds on
 * the CodeableConcept two levels up, because that is where the binding sits in
 * the profile. Walking outwards covers both without special-casing types.
 */
const bindingAtPath = (
  tree: SchemaTree,
  ctx: SchemaContext,
  path: (string | number)[]
): string | undefined => {
  for (let length = path.length; length > 0; length -= 1) {
    const node = nodeAtPath(tree, ctx, path.slice(0, length));
    const valueSet = node?.binding?.valueSet;
    if (valueSet) return valueSet;
  }
  return undefined;
};

export const createCompletionProvider = (
  index: FhirIndex
): vscode.CompletionItemProvider => ({
  provideCompletionItems: async (document, position) => {
    const text = document.getText();
    const location = getLocation(text, document.offsetAt(position));
    if (location.isAtPropertyKey) return undefined;

    const last = location.path.at(-1);
    if (typeof last !== "string" || !CODE_KEYS.has(last)) return undefined;

    let content: Record<string, unknown>;
    try {
      content = JSON.parse(text) as Record<string, unknown>;
    } catch {
      // Mid-edit the document rarely parses; completion simply stays quiet
      // rather than guessing at a half-written resource.
      return undefined;
    }

    const snapshot = await index.get();
    const profile = resolveProfileForResource(content, snapshot.registry);
    if (!profile) return undefined;

    const tree = buildSchemaTree(profile, snapshot.ctx);
    if (!tree) return undefined;

    const valueSet = bindingAtPath(tree, snapshot.ctx, location.path);
    if (!valueSet) return undefined;

    const options = resolveValueSetOptions(valueSet, snapshot.registry);
    if (options.length === 0) return undefined;

    return options.map((option, rank) => {
      const item = new vscode.CompletionItem(
        option.code,
        vscode.CompletionItemKind.EnumMember
      );
      item.detail = option.display;
      item.documentation = option.system;
      // Preserve the value set's own order instead of falling back to
      // alphabetical, which is meaningless for codes.
      item.sortText = String(rank).padStart(5, "0");
      return item;
    });
  },
});
