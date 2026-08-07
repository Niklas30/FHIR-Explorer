import * as vscode from "vscode";
import { normalizeCanonical } from "@fhir-explorer/core/fhir-editor/registry";
import type { FhirIndex } from "@/language/fhir-index";

/**
 * Resources from imported packages, as read-only editor tabs.
 *
 * Until now a canonical defined by a dependency was a dead end: hover could
 * describe it, but there was nothing to open — the file lives inside a package
 * in global storage, not in the workspace. A virtual document scheme turns it
 * into a real tab with JSON highlighting, so go-to-definition works across the
 * dependency boundary and the contents of a package can be read at all.
 *
 * Read-only by construction: the provider has no write path, so VS Code marks
 * the tab accordingly and nobody can edit a dependency by accident.
 */

export const PACKAGE_SCHEME = "fhir-package";

/**
 * `fhir-package:/<package>/<name>.json?<canonical>`
 *
 * The canonical goes in the query because it is what identifies the resource;
 * the path exists to give the tab a readable title and a `.json` extension so
 * the editor picks the right language.
 */
export const packageDocumentUri = (
  canonical: string,
  packageKey: string | undefined,
  displayName: string
): vscode.Uri =>
  vscode.Uri.from({
    scheme: PACKAGE_SCHEME,
    path: `/${packageKey ?? "package"}/${displayName}.json`,
    query: normalizeCanonical(canonical),
  });

export class PackageDocumentProvider
  implements vscode.TextDocumentContentProvider
{
  constructor(private readonly index: FhirIndex) {}

  async provideTextDocumentContent(uri: vscode.Uri): Promise<string> {
    const canonical = uri.query;
    const { registry } = await this.index.get();

    const resource =
      registry.structureDefinitionsByUrl.get(canonical) ??
      registry.valueSetsByUrl.get(canonical) ??
      registry.codeSystemsByUrl.get(canonical);

    if (!resource) {
      return `// ${canonical} is not in any imported package.\n`;
    }
    return `${JSON.stringify(resource, null, 2)}\n`;
  }
}
