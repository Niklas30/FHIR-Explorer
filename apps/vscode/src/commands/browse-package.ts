import * as vscode from "vscode";
import type { FhirIndex } from "@/language/fhir-index";
import { packageDocumentUri } from "@/language/package-documents";

/**
 * Look inside the packages you depend on.
 *
 * "Which profiles does de.basisprofil.r4 actually give me?" had no answer
 * before: hover works only if you already know the canonical to hover over.
 */

type ResourcePick = vscode.QuickPickItem & { canonical?: string; name?: string };

const KIND_ICONS: Record<string, string> = {
  StructureDefinition: "symbol-class",
  ValueSet: "symbol-enum",
  CodeSystem: "symbol-enum-member",
};

export const browsePackageCommand = async (index: FhirIndex): Promise<void> => {
  const snapshot = await index.get();
  const { registry, origins } = snapshot;

  type Entry = { canonical: string; label: string; kind: string; name: string };
  const entries: Entry[] = [];

  const push = (kind: string, url: string, resource: Record<string, unknown>) => {
    const name =
      (typeof resource.name === "string" ? resource.name : undefined) ??
      (typeof resource.id === "string" ? resource.id : undefined) ??
      url.split("/").pop() ??
      "resource";
    entries.push({
      canonical: url,
      label: (resource.title as string | undefined) ?? name,
      kind,
      name,
    });
  };

  for (const [url, resource] of registry.structureDefinitionsByUrl) {
    push("StructureDefinition", url, resource);
  }
  for (const [url, resource] of registry.valueSetsByUrl) push("ValueSet", url, resource);
  for (const [url, resource] of registry.codeSystemsByUrl) {
    push("CodeSystem", url, resource);
  }

  if (entries.length === 0) {
    vscode.window.showInformationMessage(
      "No packages imported yet. Use FHIR Explorer: Add Dependency."
    );
    return;
  }

  // Grouped by the package each resource came from, which is the question
  // being asked — the flat list would be tens of thousands of entries.
  const byOrigin = new Map<string, Entry[]>();
  for (const entry of entries) {
    const origin = origins.get(entry.canonical) ?? "Unknown origin";
    byOrigin.set(origin, [...(byOrigin.get(origin) ?? []), entry]);
  }

  const items: ResourcePick[] = [];
  for (const origin of [...byOrigin.keys()].sort()) {
    const group = (byOrigin.get(origin) ?? []).sort((a, b) =>
      a.label.localeCompare(b.label)
    );
    items.push({
      label: `${origin} — ${group.length}`,
      kind: vscode.QuickPickItemKind.Separator,
    });
    for (const entry of group) {
      items.push({
        label: `$(${KIND_ICONS[entry.kind] ?? "file"}) ${entry.label}`,
        description: entry.kind,
        detail: entry.canonical,
        canonical: entry.canonical,
        name: entry.name,
      });
    }
  }

  const picked = await vscode.window.showQuickPick(items, {
    title: "Browse imported FHIR packages",
    placeHolder: "Search by name, type or canonical url",
    matchOnDescription: true,
    matchOnDetail: true,
  });
  if (!picked?.canonical) return;

  const document = await vscode.workspace.openTextDocument(
    packageDocumentUri(
      picked.canonical,
      origins.get(picked.canonical),
      picked.name ?? "resource"
    )
  );
  await vscode.window.showTextDocument(document, { preview: true });
};
