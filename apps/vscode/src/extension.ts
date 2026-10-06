import * as vscode from "vscode";
import { createFsResourceStore } from "@/adapters/fs-resource-store";
import { GlobalPackageStore } from "@/adapters/global-package-store";
import { addDependencyCommand } from "@/commands/add-dependency";
import { importPackageFileCommand } from "@/commands/import-package-file";
import {
  installDependenciesCommand,
  installMissingDependency,
  offerMissingDependencies,
} from "@/commands/install-dependencies";
import { browsePackageCommand } from "@/commands/browse-package";
import { ProjectFormPanel } from "@/project/project-form-panel";
import { cloneDefaultsFrom } from "@/project/clone-package";
import { PackageTreeProvider, packageOf, type PackageTreeNode } from "@/tree/package-tree";
import { FhirStatusBar } from "@/status-bar";
import { ProjectRegistry, pickProject } from "@/workspace/project-registry";
import type { WorkspaceProject } from "@/workspace/project-discovery";
import {
  removeDependencyCommand,
  updateDependencyCommand,
} from "@/commands/manage-dependency";
import { DependencyGraphPanel } from "@/graph/dependency-graph-panel";
import {
  PACKAGE_SCHEME,
  PackageDocumentProvider,
} from "@/language/package-documents";
import {
  DependencyTreeProvider,
  declaredDependency,
  missingRequirement,
  type DependencyTreeNode,
} from "@/tree/dependency-tree";
import { newResourceCommand } from "@/commands/new-resource";
import { FormEditorProvider } from "@/editor/form-editor";
import { createCompletionProvider } from "@/language/completion";
import { createDefinitionProvider } from "@/language/definition";
import { FhirDiagnostics } from "@/language/diagnostics";
import { ProjectDiagnostics } from "@/language/project-diagnostics";
import { FhirIndex } from "@/language/fhir-index";
import { createHoverProvider } from "@/language/hover";
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
  const projects = new ProjectRegistry();
  const store = createFsResourceStore();
  const packageStore = new GlobalPackageStore(context.globalStorageUri);
  const index = new FhirIndex(packageStore, store, projects);
  const diagnostics = new FhirDiagnostics(index);
  const projectDiagnostics = new ProjectDiagnostics(index);

  const tree = new ProjectTreeProvider(store, projects);
  const refresh = () => {
    projects.invalidate();
    tree.refresh();
    index.invalidateWorkspace();
    void statusBar.refresh();
  };

  const dependencyTree = new DependencyTreeProvider(packageStore, projects);
  const packageTree = new PackageTreeProvider(packageStore, index);
  const statusBar = new FhirStatusBar(packageStore, projects);
  void statusBar.refresh();

  const view = vscode.window.createTreeView("fhirExplorer.projects", {
    treeDataProvider: tree,
    showCollapseAll: true,
  });
  const dependencyView = vscode.window.createTreeView("fhirExplorer.dependencies", {
    treeDataProvider: dependencyTree,
    showCollapseAll: true,
  });
  const packageView = vscode.window.createTreeView("fhirExplorer.packages", {
    treeDataProvider: packageTree,
    showCollapseAll: true,
  });

  // The file system is the source of truth, so anything that changes it —
  // a text edit, a git checkout, the IG Publisher — has to repaint the tree
  // and re-run validation.
  const watcher = vscode.workspace.createFileSystemWatcher("**/*.json");
  watcher.onDidCreate(refresh);
  watcher.onDidChange((uri) => {
    refresh();
    // A manifest edit changes the declared dependencies.
    if (uri.path.endsWith("/package.json")) dependencyTree.refresh();
  });
  watcher.onDidDelete((uri) => {
    diagnostics.forget(uri);
    refresh();
  });

  // Validate while typing, off the saved file — waiting for a save would make
  // the Problems panel lag behind what the user is looking at.
  const documentSelector: vscode.DocumentSelector = { language: "json", scheme: "file" };
  const revalidateOpen = () => {
    for (const document of vscode.workspace.textDocuments) {
      if (document.languageId === "json") diagnostics.scheduleValidate(document);
    }
  };
  index.onDidChange(revalidateOpen);

  const afterPackagesChanged = () => {
    projects.invalidate();
    tree.refresh();
    dependencyTree.refresh();
    packageTree.refresh();
    void statusBar.refresh();
    DependencyGraphPanel.refresh();
    // New packages change what every resource validates against.
    index.invalidatePackages();
    void diagnostics.validateWorkspace();
  };

  const openProjectForm = () =>
    ProjectFormPanel.show(context, undefined, afterPackagesChanged);

  /** A node's own project, otherwise ask — with creating one always on offer. */
  const requireProject = async (node: TreeNode | undefined, title: string) =>
    node?.project ?? (await pickProject(projects, title, openProjectForm));

  context.subscriptions.push(
    view,
    watcher,
    projects,
    diagnostics,
    projectDiagnostics,
    vscode.window.registerCustomEditorProvider(
      FormEditorProvider.viewType,
      new FormEditorProvider(context, index),
      // The document is shared with any text editor showing the same file, and
      // keeping the webview alive preserves scroll position between tab switches.
      { webviewOptions: { retainContextWhenHidden: true }, supportsMultipleEditorsPerDocument: true }
    ),
    vscode.commands.registerCommand(
      "fhirExplorer.openInFormEditor",
      async (target?: ResourceNode | vscode.Uri) => {
        const uri =
          target instanceof vscode.Uri
            ? target
            : target
              ? resourceUri(target)
              : vscode.window.activeTextEditor?.document.uri;
        if (!uri) return;
        await vscode.commands.executeCommand(
          "vscode.openWith",
          uri,
          FormEditorProvider.viewType
        );
      }
    ),
    vscode.languages.registerHoverProvider(documentSelector, createHoverProvider(index)),
    vscode.languages.registerDefinitionProvider(
      documentSelector,
      createDefinitionProvider(index)
    ),
    vscode.languages.registerCompletionItemProvider(
      documentSelector,
      createCompletionProvider(index),
      '"'
    ),
    vscode.workspace.onDidOpenTextDocument((document) =>
      diagnostics.scheduleValidate(document)
    ),
    vscode.workspace.onDidChangeTextDocument((event) =>
      diagnostics.scheduleValidate(event.document)
    ),
    vscode.workspace.onDidCloseTextDocument((document) => {
      // Keep the diagnostics of files that still exist: the Problems panel is
      // about the project, not about which tabs happen to be open.
      if (document.isUntitled) diagnostics.forget(document.uri);
    }),
    vscode.commands.registerCommand("fhirExplorer.refresh", () => {
      refresh();
      void diagnostics.validateWorkspace();
    }),
    vscode.commands.registerCommand("fhirExplorer.createProject", () =>
      ProjectFormPanel.show(context, undefined, afterPackagesChanged)
    ),
    packageView,
    statusBar,
    vscode.commands.registerCommand("fhirExplorer.focusPackages", () =>
      vscode.commands.executeCommand("fhirExplorer.packages.focus")
    ),
    vscode.commands.registerCommand(
      "fhirExplorer.clonePackageAsProject",
      (node: PackageTreeNode) => {
        const record = packageOf(node);
        if (!record) return;
        ProjectFormPanel.clone(
          context,
          {
            sourceKey: record.key,
            sourceId: record.id,
            sourceVersion: record.version,
            sourceTitle: record.manifest.title,
            defaults: cloneDefaultsFrom(record),
          },
          afterPackagesChanged
        );
      }
    ),
    vscode.commands.registerCommand(
      "fhirExplorer.createProjectFromPackage",
      (node: PackageTreeNode) => {
        const record = packageOf(node);
        if (!record) return;
        // The package is the premise of this command, and everything derived
        // from it — the FHIR version, the dependencies it brings — comes from
        // its own manifest rather than from an assumption about R4.
        ProjectFormPanel.show(
          context,
          {
            basedOn: {
              key: record.key,
              id: record.id,
              version: record.version,
              title: record.manifest.title,
              fhirVersion: record.manifest.fhirVersions?.[0],
              dependencies: record.manifest.dependencies ?? {},
            },
            canonicalHint: record.manifest.canonical,
          },
          afterPackagesChanged
        );
      }
    ),
    vscode.commands.registerCommand("fhirExplorer.addDependency", async () => {
      const project = await requireProject(
        undefined,
        "Which project should declare the dependency?"
      );
      if (!project) return;
      await addDependencyCommand(context, project, afterPackagesChanged);
    }),
    vscode.commands.registerCommand(
      "fhirExplorer.projectSettings",
      async (node?: { project?: WorkspaceProject }) => {
        const project =
          node?.project ??
          (await pickProject(projects, "Settings of which project?", openProjectForm));
        if (!project) return;
        ProjectFormPanel.edit(context, project, afterPackagesChanged);
      }
    ),
    vscode.commands.registerCommand("fhirExplorer.installDependencies", async () =>
      installDependenciesCommand(context, await projects.list(), afterPackagesChanged)
    ),
    vscode.commands.registerCommand("fhirExplorer.importPackageFile", () =>
      importPackageFileCommand(context, afterPackagesChanged)
    ),
    dependencyView,
    vscode.workspace.registerTextDocumentContentProvider(
      PACKAGE_SCHEME,
      new PackageDocumentProvider(index)
    ),
    vscode.commands.registerCommand("fhirExplorer.browsePackages", () =>
      browsePackageCommand(index)
    ),
    vscode.commands.registerCommand(
      "fhirExplorer.removeDependency",
      async (node: DependencyTreeNode) => {
        const declared = declaredDependency(node);
        if (!declared) return;
        await removeDependencyCommand(declared.project, declared.id, afterPackagesChanged);
      }
    ),
    vscode.commands.registerCommand(
      "fhirExplorer.updateDependency",
      async (node: DependencyTreeNode) => {
        const declared = declaredDependency(node);
        if (!declared) return;
        await updateDependencyCommand(
          context,
          declared.project,
          declared.id,
          declared.version,
          afterPackagesChanged
        );
      }
    ),
    vscode.commands.registerCommand(
      "fhirExplorer.showDependencyGraph",
      async (node?: DependencyTreeNode) => {
        const project =
          node?.project ??
          (await pickProject(projects, "Which project?", openProjectForm));
        if (!project) return;
        DependencyGraphPanel.show(context, project, (id, requirement) =>
          void installMissingDependency(context, id, requirement, afterPackagesChanged)
        );
      }
    ),
    vscode.commands.registerCommand(
      "fhirExplorer.installMissingDependency",
      async (node: DependencyTreeNode) => {
        const missing = missingRequirement(node);
        if (!missing) return;
        await installMissingDependency(
          context,
          missing.id,
          missing.version,
          afterPackagesChanged
        );
      }
    ),
    vscode.commands.registerCommand(
      "fhirExplorer.newResource",
      async (node?: CategoryNode) => {
        const project = await requireProject(node, "Add a resource to which project?");
        if (!project) return;
        await newResourceCommand(project, node?.kind, index, refresh);
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

  // First pass over the whole workspace, so Problems is populated before the
  // user opens anything.
  void diagnostics.validateWorkspace();
  void projectDiagnostics.analyze();

  // A fresh clone declares dependencies it does not have yet.
  void (async () => {
    await offerMissingDependencies(context, await projects.list(), afterPackagesChanged);
  })();
};

export const deactivate = (): void => {
  // Nothing to tear down: every subscription is owned by the context.
};
