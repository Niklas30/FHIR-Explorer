import * as vscode from "vscode";
import type { PackageManifest } from "@fhir-explorer/core/fhir-importer/types";
import { GlobalPackageStore } from "@/adapters/global-package-store";
import { resolveAndInstall } from "@/commands/add-dependency";
import { createImportSession } from "@/registry/session";
import {
  ManifestNotWritable,
  addDependencyToManifest,
  removeDependencyFromManifest,
  updateManifestFields,
} from "@/registry/manifest";
import { renderWebviewHtml } from "@/webview/html";
import { clonePackageResources } from "@/project/clone-package";
import { SCAFFOLDED_DIRECTORIES } from "@/workspace/layout";
import type { WorkspaceProject } from "@/workspace/project-discovery";

/**
 * Project creation as a form.
 *
 * The prompt chain it replaces asked four questions blind, could not go back,
 * and showed nothing until the folder already existed. The fields of a
 * manifest belong together — the canonical only makes sense next to the id.
 */

const VIEW_TYPE = "fhirExplorer.projectForm";
const encoder = new TextEncoder();

const PACKAGE_ID = /^[a-z0-9]+(\.[a-z0-9-]+)+$/;

const titleFor = (
  editing: ProjectFormEditing | undefined,
  cloning: ProjectFormCloning | undefined
): string =>
  editing
    ? "FHIR project settings"
    : cloning
      ? `Clone ${cloning.sourceId}`
      : "New FHIR project";

/**
 * The package a new project is built on.
 *
 * Fixed, not a suggestion: the command that carries it is "create a project
 * using this package", so making it a checkbox would let the user silently
 * turn it into a different command. Its own declared dependencies come along
 * whether or not anyone ticks them — the planner resolves the closure — so
 * they are shown as consequences rather than choices.
 */
export type ProjectFormBasis = {
  key: string;
  id: string;
  version: string;
  title?: string;
  /** Drives the new project's FHIR version instead of assuming R4. */
  fhirVersion?: string;
  /** What the package itself declares, for display. */
  dependencies: Record<string, string>;
};

export type ProjectFormPreset = {
  basedOn?: ProjectFormBasis;
  /** Canonical base to derive a suggestion from. */
  canonicalHint?: string;
};

/** The same form, opened on a project that already exists. */
export type ProjectFormEditing = { project: WorkspaceProject };

/**
 * Forking an imported package into an editable project.
 *
 * Carries the source key so the resources can be copied after the folder
 * exists, and the manifest defaults the clone inherits.
 */
export type ProjectFormCloning = {
  sourceKey: string;
  sourceId: string;
  sourceVersion: string;
  sourceTitle?: string;
  defaults: {
    title?: string;
    description?: string;
    canonical?: string;
    fhirVersion?: string;
    dependencies: Record<string, string>;
  };
};

type CreateValue = {
  folder: string;
  name: string;
  version: string;
  title?: string;
  description?: string;
  canonical?: string;
  fhirVersion: string;
  dependencies: string[];
};

type SaveValue = Omit<CreateValue, "folder" | "name">;

type FromWebview =
  | { type: "ready" }
  | { type: "cancel" }
  | { type: "create"; value: CreateValue }
  | { type: "save"; value: SaveValue };

export class ProjectFormPanel {
  private static current: ProjectFormPanel | undefined;
  private readonly disposables: vscode.Disposable[] = [];

  private constructor(
    private readonly panel: vscode.WebviewPanel,
    private readonly context: vscode.ExtensionContext,
    private preset: ProjectFormPreset | undefined,
    private editing: ProjectFormEditing | undefined,
    private cloning: ProjectFormCloning | undefined,
    private readonly onCreated: () => void
  ) {
    panel.webview.options = {
      enableScripts: true,
      localResourceRoots: [vscode.Uri.joinPath(context.extensionUri, "dist")],
    };
    panel.webview.html = renderWebviewHtml(
      panel.webview,
      context.extensionUri,
      "project-form",
      titleFor(editing, cloning)
    );

    this.disposables.push(
      panel.webview.onDidReceiveMessage(async (message: FromWebview) => {
        if (message.type === "ready") return await this.sendInit();
        if (message.type === "cancel") return this.dispose();
        if (message.type === "create") await this.create(message.value);
        if (message.type === "save") await this.save(message.value);
      })
    );

    panel.onDidDispose(() => this.dispose(), null, this.disposables);
  }

  static show(
    context: vscode.ExtensionContext,
    preset: ProjectFormPreset | undefined,
    onCreated: () => void
  ): void {
    ProjectFormPanel.open(context, preset, undefined, undefined, onCreated);
  }

  /** Open the form to fork an imported package into an editable project. */
  static clone(
    context: vscode.ExtensionContext,
    cloning: ProjectFormCloning,
    onCreated: () => void
  ): void {
    ProjectFormPanel.open(context, undefined, undefined, cloning, onCreated);
  }

  /** Open the form on an existing project, to inspect and change it. */
  static edit(
    context: vscode.ExtensionContext,
    project: WorkspaceProject,
    onChanged: () => void
  ): void {
    ProjectFormPanel.open(context, undefined, { project }, undefined, onChanged);
  }

  private static open(
    context: vscode.ExtensionContext,
    preset: ProjectFormPreset | undefined,
    editing: ProjectFormEditing | undefined,
    cloning: ProjectFormCloning | undefined,
    onDone: () => void
  ): void {
    if (ProjectFormPanel.current) {
      // Reused, so the title has to follow what it is now showing.
      ProjectFormPanel.current.preset = preset;
      ProjectFormPanel.current.editing = editing;
      ProjectFormPanel.current.cloning = cloning;
      ProjectFormPanel.current.panel.title = titleFor(editing, cloning);
      ProjectFormPanel.current.panel.reveal();
      void ProjectFormPanel.current.sendInit();
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      VIEW_TYPE,
      titleFor(editing, cloning),
      vscode.ViewColumn.Active,
      { enableScripts: true, retainContextWhenHidden: true }
    );
    ProjectFormPanel.current = new ProjectFormPanel(
      panel,
      context,
      preset,
      editing,
      cloning,
      onDone
    );
  }

  private async sendInit(): Promise<void> {
    const installed = await new GlobalPackageStore(
      this.context.globalStorageUri
    ).listPackages();

    await this.panel.webview.postMessage({
      type: "init",
      folders: (vscode.workspace.workspaceFolders ?? []).map((entry) => ({
        name: entry.name,
        uri: entry.uri.toString(),
      })),
      installed: installed.map((entry) => ({
        key: entry.key,
        id: entry.id,
        version: entry.version,
        title: entry.manifest.title,
      })),
      preset: this.preset,
      editing: this.editing
        ? {
            name: this.editing.project.manifest.name,
            version: this.editing.project.manifest.version,
            title: this.editing.project.manifest.title,
            description: this.editing.project.manifest.description,
            canonical: this.editing.project.manifest.canonical,
            fhirVersion: this.editing.project.manifest.fhirVersions?.[0],
            dependencies: this.editing.project.manifest.dependencies ?? {},
            manifestFile: this.editing.project.manifestFile.path.split("/").pop(),
            root: this.editing.project.root.fsPath,
          }
        : undefined,
      cloning: this.cloning,
    });
  }

  /**
   * Apply changes to an existing project.
   *
   * Dependencies are diffed rather than rewritten: the manifest keeps its
   * formatting and comments, and only what the user actually changed moves.
   */
  private async save(value: SaveValue): Promise<void> {
    const project = this.editing?.project;
    if (!project) return;

    const wanted = new Map<string, string>();
    for (const entry of value.dependencies) {
      const separator = entry.lastIndexOf("@");
      if (separator > 0) wanted.set(entry.slice(0, separator), entry.slice(separator + 1));
    }
    const current = project.manifest.dependencies ?? {};

    try {
      const skipped = await updateManifestFields(project, {
        version: value.version,
        title: value.title,
        description: value.description,
        canonical: value.canonical,
        fhirVersion: value.fhirVersion,
      });

      for (const [id, version] of wanted) {
        if (current[id] !== version) await addDependencyToManifest(project, id, version);
      }
      for (const id of Object.keys(current)) {
        if (!wanted.has(id)) await removeDependencyFromManifest(project, id);
      }

      if (skipped.length > 0) {
        vscode.window.showWarningMessage(
          `Saved, except ${skipped.join(", ")} — ${project.manifestFile.path
            .split("/")
            .pop()} has no field for it.`
        );
      }
    } catch (error) {
      vscode.window.showErrorMessage(
        error instanceof ManifestNotWritable
          ? error.message
          : `Could not save: ${error instanceof Error ? error.message : String(error)}`
      );
      return;
    }

    this.dispose();
    this.onCreated();

    // Anything newly declared has to actually be there for validation to work.
    const added = [...wanted.entries()]
      .filter(([id, version]) => current[id] !== version)
      .map(([id, version]) => ({ id, version }));
    if (added.length > 0) {
      const session = await createImportSession(this.context);
      await resolveAndInstall(session, added, `Install new dependencies`);
      this.onCreated();
    }
  }

  /**
   * Everything the form sent is checked again here. A webview is a rendering
   * surface, not a trusted caller — and a bad id would become a folder name.
   */
  private async create(value: CreateValue): Promise<void> {
    if (!PACKAGE_ID.test(value.name) || !/^\d+\.\d+\.\d+/.test(value.version)) {
      vscode.window.showErrorMessage("The project id or version is not valid.");
      return;
    }

    const parent = (vscode.workspace.workspaceFolders ?? []).find(
      (entry) => entry.uri.toString() === value.folder
    );
    if (!parent) {
      vscode.window.showErrorMessage("Open a folder before creating a FHIR project.");
      return;
    }

    const root = vscode.Uri.joinPath(parent.uri, value.name);
    const manifestUri = vscode.Uri.joinPath(root, "package.json");
    const exists = await vscode.workspace.fs.stat(manifestUri).then(
      () => true,
      () => false
    );
    if (exists) {
      vscode.window.showErrorMessage(`${manifestUri.fsPath} already exists.`);
      return;
    }

    const dependencies: Record<string, string> = {};
    // The basis is added here rather than trusted from the form: it is the
    // premise of the command, not something the webview gets to drop.
    if (this.preset?.basedOn) {
      dependencies[this.preset.basedOn.id] = this.preset.basedOn.version;
    }
    for (const entry of value.dependencies) {
      const separator = entry.lastIndexOf("@");
      if (separator <= 0) continue;
      dependencies[entry.slice(0, separator)] = entry.slice(separator + 1);
    }

    const manifest: PackageManifest = {
      name: value.name,
      version: value.version,
      type: "fhir.ig",
      ...(value.title ? { title: value.title } : {}),
      ...(value.description ? { description: value.description } : {}),
      fhirVersions: [value.fhirVersion],
      ...(value.canonical ? { canonical: value.canonical } : {}),
      ...(Object.keys(dependencies).length > 0 ? { dependencies } : {}),
    };

    await vscode.workspace.fs.createDirectory(root);
    for (const directory of SCAFFOLDED_DIRECTORIES) {
      await vscode.workspace.fs.createDirectory(
        vscode.Uri.joinPath(root, ...directory.split("/"))
      );
    }
    await vscode.workspace.fs.writeFile(
      manifestUri,
      encoder.encode(`${JSON.stringify(manifest, null, 2)}\n`)
    );

    // Copy the source package's resources in before anything else looks at
    // the folder, so the project is never briefly an empty shell.
    if (this.cloning) {
      const store = new GlobalPackageStore(this.context.globalStorageUri);
      const payloads = await store.listResourcePayloadsByPackageKeys([
        this.cloning.sourceKey,
      ]);

      const outcome = await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: `Cloning ${this.cloning.sourceId} into ${value.name}`,
        },
        (progress) =>
          clonePackageResources(root, payloads, (completed, total) =>
            progress.report({ message: `${completed}/${total} resources` })
          )
      );

      vscode.window.showInformationMessage(
        outcome.skipped > 0
          ? `Copied ${outcome.written} resources, skipped ${outcome.skipped} that carry no resourceType.`
          : `Copied ${outcome.written} resources. Canonicals are unchanged — adjust the ones you want to own.`
      );
    }

    this.dispose();
    this.onCreated();

    // Installing right away is the difference between a project you can use
    // and an empty folder that reports "no StructureDefinition" on every file.
    const roots = Object.entries(dependencies).map(([id, version]) => ({ id, version }));
    if (roots.length > 0) {
      const session = await createImportSession(this.context);
      await resolveAndInstall(session, roots, `Install dependencies of ${value.name}`);
      this.onCreated();
    }

    await vscode.window.showTextDocument(manifestUri);
  }

  private dispose(): void {
    ProjectFormPanel.current = undefined;
    this.panel.dispose();
    for (const disposable of this.disposables) disposable.dispose();
  }
}
