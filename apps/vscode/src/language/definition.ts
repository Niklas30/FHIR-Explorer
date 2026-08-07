import * as vscode from "vscode";
import { normalizeCanonical } from "@fhir-explorer/core/fhir-editor/registry";
import type { FhirIndex } from "@/language/fhir-index";
import { packageDocumentUri } from "@/language/package-documents";
import { stringAtPosition } from "@/language/string-at-position";

/**
 * Ctrl+click on a canonical url or a local reference.
 *
 * Workspace files win: when a canonical is defined by a file the user has, that
 * is what they want to open. Anything else defined by a dependency opens as a
 * read-only virtual document, so the jump works across the package boundary
 * instead of doing nothing.
 */
export const createDefinitionProvider = (
  index: FhirIndex
): vscode.DefinitionProvider => ({
  provideDefinition: async (document, position) => {
    const found = stringAtPosition(document, position);
    if (!found) return undefined;

    const snapshot = await index.get();
    const canonical = normalizeCanonical(found.value);

    const definition = snapshot.definitions.get(canonical);
    if (definition) {
      return new vscode.Location(definition.uri, new vscode.Position(0, 0));
    }

    const instance = snapshot.instances.get(found.value);
    if (instance) {
      return new vscode.Location(instance, new vscode.Position(0, 0));
    }

    const fromPackage =
      snapshot.registry.structureDefinitionsByUrl.get(canonical) ??
      snapshot.registry.valueSetsByUrl.get(canonical) ??
      snapshot.registry.codeSystemsByUrl.get(canonical);
    if (fromPackage) {
      const name =
        (typeof fromPackage.id === "string" ? fromPackage.id : undefined) ??
        (typeof fromPackage.name === "string" ? fromPackage.name : undefined) ??
        canonical.split("/").pop() ??
        "resource";
      return new vscode.Location(
        packageDocumentUri(canonical, snapshot.origins.get(canonical), name),
        new vscode.Position(0, 0)
      );
    }

    return undefined;
  },
});
