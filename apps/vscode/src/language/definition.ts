import * as vscode from "vscode";
import { normalizeCanonical } from "@fhir-explorer/core/fhir-editor/registry";
import type { FhirIndex } from "@/language/fhir-index";
import { stringAtPosition } from "@/language/string-at-position";

/**
 * Ctrl+click on a canonical url or a local reference.
 *
 * Only workspace files can be jumped to — a canonical that resolves inside an
 * imported package has no file to open, and the hover already says where it
 * comes from.
 */
export const createDefinitionProvider = (
  index: FhirIndex
): vscode.DefinitionProvider => ({
  provideDefinition: async (document, position) => {
    const found = stringAtPosition(document, position);
    if (!found) return undefined;

    const snapshot = await index.get();

    const definition = snapshot.definitions.get(normalizeCanonical(found.value));
    if (definition) {
      return new vscode.Location(definition.uri, new vscode.Position(0, 0));
    }

    const instance = snapshot.instances.get(found.value);
    if (instance) {
      return new vscode.Location(instance, new vscode.Position(0, 0));
    }

    return undefined;
  },
});
