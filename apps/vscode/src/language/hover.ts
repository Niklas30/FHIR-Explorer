import * as vscode from "vscode";
import { normalizeCanonical } from "@fhir-explorer/core/fhir-editor/registry";
import type { FhirIndexSnapshot } from "@/language/fhir-index";
import type { FhirIndex } from "@/language/fhir-index";
import { stringAtPosition } from "@/language/string-at-position";

/**
 * Hover over a canonical url.
 *
 * A FHIR file is full of urls that mean something the reader cannot see:
 * `meta.profile`, extension urls, value set bindings. Resolving them in place
 * removes the constant round trip to a registry website.
 */

type Resolved = {
  resourceType: string;
  title: string;
  description?: string;
  detail?: string;
};

const asString = (value: unknown): string | undefined =>
  typeof value === "string" && value.trim() ? value.trim() : undefined;

const resolveCanonical = (
  snapshot: FhirIndexSnapshot,
  canonical: string
): Resolved | undefined => {
  const definition = snapshot.registry.structureDefinitionsByUrl.get(canonical);
  if (definition) {
    return {
      resourceType: "StructureDefinition",
      title: asString(definition.title) ?? asString(definition.name) ?? canonical,
      description: asString(definition.description),
      detail: [
        definition.type ? `type \`${definition.type}\`` : undefined,
        definition.baseDefinition
          ? `derived from \`${normalizeCanonical(String(definition.baseDefinition))}\``
          : undefined,
      ]
        .filter(Boolean)
        .join(" · "),
    };
  }

  const valueSet = snapshot.registry.valueSetsByUrl.get(canonical);
  if (valueSet) {
    return {
      resourceType: "ValueSet",
      title: asString(valueSet.title) ?? asString(valueSet.name) ?? canonical,
      description: asString(valueSet.description),
    };
  }

  const codeSystem = snapshot.registry.codeSystemsByUrl.get(canonical);
  if (codeSystem) {
    return {
      resourceType: "CodeSystem",
      title: asString(codeSystem.title) ?? asString(codeSystem.name) ?? canonical,
      description: asString(codeSystem.description),
    };
  }

  return undefined;
};

const renderHover = (
  snapshot: FhirIndexSnapshot,
  canonical: string,
  resolved: Resolved
): vscode.MarkdownString => {
  const markdown = new vscode.MarkdownString();
  markdown.appendMarkdown(`**${resolved.title}** — \`${resolved.resourceType}\`\n\n`);
  if (resolved.detail) markdown.appendMarkdown(`${resolved.detail}\n\n`);
  if (resolved.description) markdown.appendMarkdown(`${resolved.description}\n\n`);

  const origin = snapshot.origins.get(canonical);
  const isLocal = snapshot.definitions.has(canonical);
  markdown.appendMarkdown(
    isLocal
      ? `_Defined in this workspace_`
      : origin
        ? `_From \`${origin}\`_`
        : `_Source unknown_`
  );
  return markdown;
};

export const createHoverProvider = (index: FhirIndex): vscode.HoverProvider => ({
  provideHover: async (document, position) => {
    const found = stringAtPosition(document, position);
    if (!found) return undefined;

    const snapshot = await index.get();
    const canonical = normalizeCanonical(found.value);

    const resolved = resolveCanonical(snapshot, canonical);
    if (resolved) {
      return new vscode.Hover(renderHover(snapshot, canonical, resolved), found.range);
    }

    // A local reference such as `Patient/example`.
    const target = snapshot.instances.get(found.value);
    if (target) {
      const markdown = new vscode.MarkdownString();
      markdown.appendMarkdown(
        `**${found.value}**\n\n_Instance in this workspace_\n\n${vscode.workspace.asRelativePath(target)}`
      );
      return new vscode.Hover(markdown, found.range);
    }

    // An unresolvable canonical is worth saying out loud — it usually means a
    // package is missing, which is exactly what the validator will flag too.
    if (found.value.startsWith("http://") || found.value.startsWith("https://")) {
      const markdown = new vscode.MarkdownString();
      markdown.appendMarkdown(
        `\`${canonical}\`\n\n_Not found in the imported packages or this workspace._`
      );
      return new vscode.Hover(markdown, found.range);
    }

    return undefined;
  },
});
