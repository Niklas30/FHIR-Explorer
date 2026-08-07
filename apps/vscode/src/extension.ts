import * as vscode from "vscode";
import { createFsResourceStore } from "@/adapters/fs-resource-store";
import { createProjectCommand } from "@/commands/create-project";
import { importPackageCommand } from "@/commands/import-package";
import { newResourceCommand } from "@/commands/new-resource";
import {
  ProjectTreeProvider,
  resourceUri,
  type CategoryNode,
  type ResourceNode,
  type TreeNode,
} from "@/tree/project-tree";

/**
 * Extension entry point.
 *
 * All the FHIR knowledge lives in @fhir-explorer/core, shared verbatim with
 * the web app. What is assembled here is only the wiring: which adapter
 * satisfies which port, and which VS Code surface drives it.
 */

export const activate = (context: vscode.ExtensionContext): void => {
  const store = createFsResourceStore();
  const tree = new ProjectTreeProvider(store);
  const refresh = () => tree.refresh();

  const view = vscode.window.createTreeView("fhirExplorer.projects", {
    treeDataProvider: tree,
    showCollapseAll: true,
  });

  // The file system is the source of truth, so anything that changes it —
  // a text edit, a git checkout, the IG Publisher — has to repaint the tree.
  const watcher = vscode.workspace.createFileSystemWatcher("**/*.json");
  watcher.onDidCreate(refresh);
  watcher.onDidChange(refresh);
  watcher.onDidDelete(refresh);

  const projectOf = (node: TreeNode | undefined) => {
    if (node) return node.project;
    const projects = tree.knownProjects();
    return projects.length === 1 ? projects[0] : undefined;
  };

  const requireProject = async (node: TreeNode | undefined) => {
    const known = projectOf(node);
    if (known) return known;

    const projects = tree.knownProjects();
    if (projects.length === 0) {
      vscode.window.showErrorMessage("No FHIR project found in this workspace.");
      return undefined;
    }
    const picked = await vscode.window.showQuickPick(
      projects.map((project) => ({
        label: project.manifest.name,
        description: project.manifest.version,
        project,
      })),
      { title: "Which project?", placeHolder: "Select a FHIR project" }
    );
    return picked?.project;
  };

  context.subscriptions.push(
    view,
    watcher,
    vscode.commands.registerCommand("fhirExplorer.refresh", refresh),
    vscode.commands.registerCommand("fhirExplorer.createProject", () =>
      createProjectCommand(refresh)
    ),
    vscode.commands.registerCommand("fhirExplorer.importPackage", () =>
      importPackageCommand(context, refresh)
    ),
    vscode.commands.registerCommand(
      "fhirExplorer.newResource",
      async (node?: CategoryNode) => {
        const project = await requireProject(node);
        if (!project) return;
        await newResourceCommand(project, node?.kind, refresh);
      }
    ),
    vscode.commands.registerCommand("fhirExplorer.openResource", (node: ResourceNode) =>
      vscode.window.showTextDocument(resourceUri(node))
    ),
    vscode.commands.registerCommand("fhirExplorer.revealInExplorer", (node: ResourceNode) =>
      vscode.commands.executeCommand("revealInExplorer", resourceUri(node))
    ),
    vscode.commands.registerCommand(
      "fhirExplorer.deleteResource",
      async (node: ResourceNode) => {
        const uri = resourceUri(node);
        const answer = await vscode.window.showWarningMessage(
          `Delete ${node.resource.title ?? node.resource.id}?`,
          { modal: true, detail: uri.fsPath },
          "Move to Trash"
        );
        if (answer !== "Move to Trash") return;
        await vscode.workspace.fs.delete(uri, { useTrash: true });
        refresh();
      }
    )
  );

  // Adding or removing a workspace folder changes the set of projects.
  context.subscriptions.push(vscode.workspace.onDidChangeWorkspaceFolders(refresh));
};

export const deactivate = (): void => {
  // Nothing to tear down: every subscription is owned by the context.
};
