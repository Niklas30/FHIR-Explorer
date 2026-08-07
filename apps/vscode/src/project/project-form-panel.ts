import * as vscode from "vscode";
import type { PackageManifest } from "@fhir-explorer/core/fhir-importer/types";
import { GlobalPackageStore } from "@/adapters/global-package-store";
import { resolveAndInstall } from "@/commands/add-dependency";
import { createImportSession } from "@/registry/session";
import { renderWebviewHtml } from "@/webview/html";
import { SCAFFOLDED_DIRECTORIES } from "@/workspace/layout";

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

export type ProjectFormPreset = {
  /** `id@version` entries to tick by default. */
  dependencies: string[];
  /** Canonical base to derive a suggestion from. */
  canonicalHint?: string;
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

type FromWebview =
  | { type: "ready" }
  | { type: "cancel" }
  | { type: "create"; value: CreateValue };

export class ProjectFormPanel {
  private static current: ProjectFormPanel | undefined;
  private readonly disposables: vscode.Disposable[] = [];

  private constructor(
    private readonly panel: vscode.WebviewPanel,
    private readonly context: vscode.ExtensionContext,
    private preset: ProjectFormPreset | undefined,
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
      "New FHIR project"
    );

    this.disposables.push(
      panel.webview.onDidReceiveMessage(async (message: FromWebview) => {
        if (message.type === "ready") return await this.sendInit();
        if (message.type === "cancel") return this.dispose();
        if (message.type === "create") await this.create(message.value);
      })
    );

    panel.onDidDispose(() => this.dispose(), null, this.disposables);
  }

  static show(
    context: vscode.ExtensionContext,
    preset: ProjectFormPreset | undefined,
    onCreated: () => void
  ): void {
    if (ProjectFormPanel.current) {
      ProjectFormPanel.current.preset = preset;
      ProjectFormPanel.current.panel.reveal();
      void ProjectFormPanel.current.sendInit();
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      VIEW_TYPE,
      "New FHIR project",
      vscode.ViewColumn.Active,
      { enableScripts: true, retainContextWhenHidden: true }
    );
    ProjectFormPanel.current = new ProjectFormPanel(panel, context, preset, onCreated);
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
    });
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
