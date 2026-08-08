import * as vscode from "vscode";
import type { DependencyGraph } from "@fhir-explorer/core/fhir-importer/dependency-graph";
import type { PackageRecord } from "@fhir-explorer/core/fhir-importer/types";
import { GlobalPackageStore } from "@/adapters/global-package-store";
import {
  buildProjectDependencyGraph,
  childrenOf,
  type DependencyNode,
} from "@/registry/dependency-view";
import type { WorkspaceProject } from "@/workspace/project-discovery";
import type { ProjectRegistry } from "@/workspace/project-registry";

/**
 * The dependency closure as a native tree.
 *
 * A tree answers "what pulls this in, and what is missing" better than a
 * picture does, it is keyboard-navigable, and it is always visible without
 * opening anything. The graph panel is for the shape of the whole thing.
 */

type ProjectRoot = { type: "project"; project: WorkspaceProject; graph: DependencyGraph };
type DependencyItem = {
  type: "dependency";
  project: WorkspaceProject;
  graph: DependencyGraph;
  node: DependencyNode;
  /** Keys on the path from the root, so a cycle stops rather than recurses. */
  ancestors: Set<string>;
};

export type DependencyTreeNode = ProjectRoot | DependencyItem;

export class DependencyTreeProvider
  implements vscode.TreeDataProvider<DependencyTreeNode>
{
  private readonly changed = new vscode.EventEmitter<DependencyTreeNode | undefined>();
  readonly onDidChangeTreeData = this.changed.event;

  private installed: PackageRecord[] = [];

  constructor(
    private readonly store: GlobalPackageStore,
    private readonly registry: ProjectRegistry
  ) {}

  refresh(): void {
    this.changed.fire(undefined);
  }

  getTreeItem(node: DependencyTreeNode): vscode.TreeItem {
    if (node.type === "project") {
      const item = new vscode.TreeItem(
        node.project.manifest.name,
        vscode.TreeItemCollapsibleState.Expanded
      );
      item.description = node.project.manifest.version;
      item.iconPath = new vscode.ThemeIcon("package");
      item.contextValue = "fhirExplorer.dependencyRoot";
      return item;
    }

    const { node: dependency } = node;
    const hasChildren =
      dependency.resolved &&
      !dependency.repeated &&
      (node.graph.adjacency.get(dependency.key)?.length ?? 0) > 0;

    const item = new vscode.TreeItem(
      dependency.id,
      hasChildren
        ? vscode.TreeItemCollapsibleState.Collapsed
        : vscode.TreeItemCollapsibleState.None
    );
    item.description = dependency.resolved
      ? dependency.version
      : `${dependency.version} — not installed`;
    item.tooltip = dependency.resolved
      ? `${dependency.title}\n${dependency.key}`
      : `${dependency.id} ${dependency.version} is required but not installed`;
    item.iconPath = dependency.resolved
      ? new vscode.ThemeIcon("library")
      : new vscode.ThemeIcon(
          "warning",
          new vscode.ThemeColor("list.warningForeground")
        );
    // The context value decides which actions the item offers: install for an
    // unmet one, update and remove only for a dependency the project declares
    // itself — a transitive version is not ours to change.
    item.contextValue = !dependency.resolved
      ? "fhirExplorer.missingDependency"
      : dependency.direct
        ? "fhirExplorer.directDependency"
        : "fhirExplorer.dependency";
    return item;
  }

  async getChildren(node?: DependencyTreeNode): Promise<DependencyTreeNode[]> {
    if (!node) {
      this.installed = await this.store.listPackages();
      const projects = await this.registry.list();
      const roots: ProjectRoot[] = projects.map((project) => ({
        type: "project",
        project,
        graph: buildProjectDependencyGraph(project, this.installed),
      }));

      // One project is the common case; skip the redundant level.
      if (roots.length === 1) return this.childrenOfKey(roots[0], roots[0].project.key);
      return roots;
    }

    if (node.type === "project") {
      return this.childrenOfKey(node, node.project.key);
    }

    if (!node.node.resolved || node.node.repeated) return [];
    return this.childrenOfKey(node, node.node.key, node.ancestors);
  }

  private childrenOfKey(
    parent: DependencyTreeNode,
    key: string,
    ancestors = new Set<string>()
  ): DependencyItem[] {
    const graph = parent.graph;
    const project = parent.type === "project" ? parent.project : parent.project;
    const path = new Set([...ancestors, key]);

    return childrenOf(graph, key, path, parent.type === "project").map((dependency) => ({
      type: "dependency",
      project,
      graph,
      node: dependency,
      ancestors: path,
    }));
  }
}

/** The `id` and requirement of a missing node, for the install command. */
export const missingRequirement = (
  node: DependencyTreeNode
): { id: string; version: string } | undefined =>
  node.type === "dependency" && !node.node.resolved
    ? { id: node.node.id, version: node.node.version }
    : undefined;

/** The declared dependency behind a node, for update and remove. */
export const declaredDependency = (
  node: DependencyTreeNode
): { project: WorkspaceProject; id: string; version: string } | undefined =>
  node.type === "dependency" && node.node.direct
    ? { project: node.project, id: node.node.id, version: node.node.version }
    : undefined;
