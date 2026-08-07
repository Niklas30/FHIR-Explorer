import * as vscode from "vscode";
import type { PackageRecord } from "@fhir-explorer/core/fhir-importer/types";
import type { GlobalPackageStore } from "@/adapters/global-package-store";
import type { FhirIndex } from "@/language/fhir-index";
import { packageDocumentUri } from "@/language/package-documents";

/**
 * Everything that has been imported, whether or not a project uses it.
 *
 * Both other views are driven by workspace projects, so importing a package
 * into a folder that has no project produced no visible change anywhere — the
 * package was in the store, doing nothing observable. This view is the answer
 * to "I imported something, now what?".
 */

type PackageNode = { type: "package"; record: PackageRecord };
type KindNode = {
  type: "kind";
  packageKey: string;
  kind: ResourceKind;
  entries: PackageEntry[];
};
type EntryNode = { type: "entry"; packageKey: string; entry: PackageEntry };

export type PackageTreeNode = PackageNode | KindNode | EntryNode;

type ResourceKind = "StructureDefinition" | "ValueSet" | "CodeSystem";

type PackageEntry = { canonical: string; label: string; name: string };

const KIND_ORDER: ResourceKind[] = ["StructureDefinition", "ValueSet", "CodeSystem"];

const KIND_LABELS: Record<ResourceKind, string> = {
  StructureDefinition: "Profiles & types",
  ValueSet: "ValueSets",
  CodeSystem: "CodeSystems",
};

const KIND_ICONS: Record<ResourceKind, string> = {
  StructureDefinition: "symbol-class",
  ValueSet: "symbol-enum",
  CodeSystem: "symbol-enum-member",
};

const labelOf = (resource: Record<string, unknown>, url: string): PackageEntry => {
  const name =
    (typeof resource.name === "string" ? resource.name : undefined) ??
    (typeof resource.id === "string" ? resource.id : undefined) ??
    url.split("/").pop() ??
    "resource";
  return {
    canonical: url,
    label: (resource.title as string | undefined) ?? name,
    name,
  };
};

export class PackageTreeProvider implements vscode.TreeDataProvider<PackageTreeNode> {
  private readonly changed = new vscode.EventEmitter<PackageTreeNode | undefined>();
  readonly onDidChangeTreeData = this.changed.event;

  /** `packageKey -> kind -> entries`, built once per index generation. */
  private contents = new Map<string, Map<ResourceKind, PackageEntry[]>>();

  constructor(
    private readonly store: GlobalPackageStore,
    private readonly index: FhirIndex
  ) {}

  refresh(): void {
    this.contents.clear();
    this.changed.fire(undefined);
  }

  getTreeItem(node: PackageTreeNode): vscode.TreeItem {
    if (node.type === "package") {
      const { record } = node;
      const item = new vscode.TreeItem(
        record.manifest.title ?? record.id,
        vscode.TreeItemCollapsibleState.Collapsed
      );
      item.description = `${record.version} · ${record.resourceCount} resources`;
      item.tooltip = new vscode.MarkdownString(
        [
          `**${record.manifest.title ?? record.id}**`,
          record.manifest.description ?? "",
          "",
          `\`${record.key}\``,
          record.manifest.canonical ? `Canonical: ${record.manifest.canonical}` : "",
        ]
          .filter(Boolean)
          .join("\n\n")
      );
      item.iconPath = new vscode.ThemeIcon("package");
      item.contextValue = "fhirExplorer.installedPackage";
      return item;
    }

    if (node.type === "kind") {
      const item = new vscode.TreeItem(
        KIND_LABELS[node.kind],
        vscode.TreeItemCollapsibleState.Collapsed
      );
      item.description = String(node.entries.length);
      item.iconPath = new vscode.ThemeIcon(KIND_ICONS[node.kind]);
      return item;
    }

    const item = new vscode.TreeItem(node.entry.label, vscode.TreeItemCollapsibleState.None);
    item.description = node.entry.name !== node.entry.label ? node.entry.name : undefined;
    item.tooltip = node.entry.canonical;
    item.iconPath = new vscode.ThemeIcon("file-code");
    item.contextValue = "fhirExplorer.packageResource";
    // Opens the read-only virtual document, the same one go-to-definition uses.
    item.command = {
      command: "vscode.open",
      title: "Open",
      arguments: [
        packageDocumentUri(node.entry.canonical, node.packageKey, node.entry.name),
      ],
    };
    return item;
  }

  async getChildren(node?: PackageTreeNode): Promise<PackageTreeNode[]> {
    if (!node) {
      const packages = await this.store.listPackages();
      await vscode.commands.executeCommand(
        "setContext",
        "fhirExplorer.hasPackages",
        packages.length > 0
      );
      return packages
        .sort((a, b) => a.id.localeCompare(b.id) || a.version.localeCompare(b.version))
        .map((record) => ({ type: "package", record }));
    }

    if (node.type === "package") {
      const byKind = await this.contentsOf(node.record.key);
      return KIND_ORDER.filter((kind) => (byKind.get(kind)?.length ?? 0) > 0).map(
        (kind) => ({
          type: "kind",
          packageKey: node.record.key,
          kind,
          entries: byKind.get(kind) ?? [],
        })
      );
    }

    if (node.type === "kind") {
      return node.entries.map((entry) => ({
        type: "entry",
        packageKey: node.packageKey,
        entry,
      }));
    }

    return [];
  }

  /**
   * Group the registry by originating package.
   *
   * Built from the index rather than by re-reading payloads: the index already
   * knows which package every canonical came from.
   */
  private async contentsOf(
    packageKey: string
  ): Promise<Map<ResourceKind, PackageEntry[]>> {
    if (this.contents.size === 0) {
      const { registry, origins } = await this.index.get();

      const add = (kind: ResourceKind, url: string, resource: Record<string, unknown>) => {
        const origin = origins.get(url);
        if (!origin) return;
        const byKind =
          this.contents.get(origin) ?? new Map<ResourceKind, PackageEntry[]>();
        byKind.set(kind, [...(byKind.get(kind) ?? []), labelOf(resource, url)]);
        this.contents.set(origin, byKind);
      };

      for (const [url, resource] of registry.structureDefinitionsByUrl) {
        add("StructureDefinition", url, resource);
      }
      for (const [url, resource] of registry.valueSetsByUrl) add("ValueSet", url, resource);
      for (const [url, resource] of registry.codeSystemsByUrl) {
        add("CodeSystem", url, resource);
      }

      for (const byKind of this.contents.values()) {
        for (const entries of byKind.values()) {
          entries.sort((a, b) => a.label.localeCompare(b.label));
        }
      }
    }

    return this.contents.get(packageKey) ?? new Map();
  }
}

/** The package record behind a node, for the commands acting on it. */
export const packageOf = (node: PackageTreeNode): PackageRecord | undefined =>
  node.type === "package" ? node.record : undefined;
