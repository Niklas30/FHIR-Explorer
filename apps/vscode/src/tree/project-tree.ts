import * as vscode from "vscode";
import type { ResourceStore } from "@fhir-explorer/core/ports";
import type {
  AuthoredResource,
  AuthoredResourceKind,
} from "@fhir-explorer/core/projects/types";
import {
  discoverProjects,
  type WorkspaceProject,
} from "@/workspace/project-discovery";

/**
 * The project structure as a native tree.
 *
 * This replaces the web app's ProjectExplorerPanel rather than porting it:
 * context menus, icons, keyboard navigation, reveal and theming all come from
 * VS Code, and every leaf is a real file the user can also open as text.
 */

const CATEGORIES: { kind: AuthoredResourceKind; label: string; icon: string }[] = [
  { kind: "profile", label: "Profiles", icon: "symbol-class" },
  { kind: "extension", label: "Extensions", icon: "symbol-interface" },
  { kind: "valueset", label: "ValueSets", icon: "symbol-enum" },
  { kind: "codesystem", label: "CodeSystems", icon: "symbol-enum-member" },
  { kind: "example", label: "Examples", icon: "beaker" },
];

export type ProjectNode = { type: "project"; project: WorkspaceProject };
export type CategoryNode = {
  type: "category";
  project: WorkspaceProject;
  kind: AuthoredResourceKind;
  label: string;
  icon: string;
};
export type ResourceNode = {
  type: "resource";
  project: WorkspaceProject;
  resource: AuthoredResource;
};

export type TreeNode = ProjectNode | CategoryNode | ResourceNode;

/** URI of the file backing a resource node. */
export const resourceUri = (node: ResourceNode): vscode.Uri =>
  vscode.Uri.joinPath(node.project.root, ...node.resource.id.split("/"));

export class ProjectTreeProvider implements vscode.TreeDataProvider<TreeNode> {
  private readonly changed = new vscode.EventEmitter<TreeNode | undefined>();
  readonly onDidChangeTreeData = this.changed.event;

  private projects: WorkspaceProject[] = [];
  private readonly resources = new Map<string, AuthoredResource[]>();

  constructor(private readonly store: ResourceStore<AuthoredResource>) {}

  /** Drop all caches and repaint. Cheap — the file system is the truth. */
  refresh(): void {
    this.resources.clear();
    this.changed.fire(undefined);
  }

  /** The projects found on the last paint, for commands that need them. */
  knownProjects(): WorkspaceProject[] {
    return this.projects;
  }

  private async resourcesOf(project: WorkspaceProject): Promise<AuthoredResource[]> {
    const key = project.root.toString();
    const cached = this.resources.get(key);
    if (cached) return cached;
    const loaded = await this.store.load(key);
    this.resources.set(key, loaded);
    return loaded;
  }

  getTreeItem(node: TreeNode): vscode.TreeItem {
    if (node.type === "project") {
      const item = new vscode.TreeItem(
        node.project.manifest.title ?? node.project.manifest.name,
        vscode.TreeItemCollapsibleState.Expanded
      );
      item.description = `${node.project.manifest.name}@${node.project.manifest.version}`;
      item.tooltip = node.project.root.fsPath;
      item.iconPath = new vscode.ThemeIcon("package");
      item.contextValue = "fhirExplorer.project";
      item.resourceUri = node.project.root;
      return item;
    }

    if (node.type === "category") {
      const item = new vscode.TreeItem(
        node.label,
        vscode.TreeItemCollapsibleState.Collapsed
      );
      item.iconPath = new vscode.ThemeIcon(node.icon);
      item.contextValue = "fhirExplorer.category";
      return item;
    }

    const { resource } = node;
    const item = new vscode.TreeItem(
      resource.title ?? resource.content.id?.toString() ?? resource.resourceType,
      vscode.TreeItemCollapsibleState.None
    );
    item.description = resource.resourceType;
    item.contextValue = "fhirExplorer.resource";
    // A real file URI gives the item the theme's file icon, decorations and
    // the standard reveal behaviour.
    item.resourceUri = resourceUri(node);
    item.command = {
      command: "vscode.open",
      title: "Open Resource",
      arguments: [item.resourceUri],
    };
    return item;
  }

  async getChildren(node?: TreeNode): Promise<TreeNode[]> {
    if (!node) {
      this.projects = await discoverProjects();
      await vscode.commands.executeCommand(
        "setContext",
        "fhirExplorer.hasProjects",
        this.projects.length > 0
      );
      // A single project is the common case; skip the redundant top level.
      if (this.projects.length === 1) {
        return this.categoriesOf(this.projects[0]);
      }
      return this.projects.map((project) => ({ type: "project", project }));
    }

    if (node.type === "project") return this.categoriesOf(node.project);

    if (node.type === "category") {
      const all = await this.resourcesOf(node.project);
      return all
        .filter((resource) => resource.kind === node.kind)
        .map((resource) => ({ type: "resource", project: node.project, resource }));
    }

    return [];
  }

  private categoriesOf(project: WorkspaceProject): CategoryNode[] {
    return CATEGORIES.map(({ kind, label, icon }) => ({
      type: "category",
      project,
      kind,
      label,
      icon,
    }));
  }
}
