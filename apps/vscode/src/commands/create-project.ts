import * as vscode from "vscode";
import type { PackageManifest } from "@fhir-explorer/core/fhir-importer/types";
import { SCAFFOLDED_DIRECTORIES } from "@/workspace/layout";

const encoder = new TextEncoder();

const PACKAGE_ID = /^[a-z0-9]+(\.[a-z0-9-]+)+$/;

/**
 * Create a project as a folder, not as a database row: a FHIR `package.json`
 * plus the IG Publisher input directories. Everything the extension does later
 * reads back out of exactly these files.
 */
export const createProjectCommand = async (onCreated: () => void): Promise<void> => {
  const folders = vscode.workspace.workspaceFolders ?? [];
  if (folders.length === 0) {
    vscode.window.showErrorMessage(
      "Open a folder before creating a FHIR project — the project lives in your workspace."
    );
    return;
  }

  const parent =
    folders.length === 1
      ? folders[0]
      : await vscode.window.showWorkspaceFolderPick({
          placeHolder: "Where should the project be created?",
        });
  if (!parent) return;

  const name = await vscode.window.showInputBox({
    title: "Create FHIR Project (1/2)",
    prompt: "Package id",
    placeHolder: "de.example.project",
    ignoreFocusOut: true,
    validateInput: (value) =>
      PACKAGE_ID.test(value.trim())
        ? undefined
        : "Lowercase, dot-separated package id (e.g. de.example.project)",
  });
  if (!name) return;

  const version = await vscode.window.showInputBox({
    title: "Create FHIR Project (2/2)",
    prompt: "Version",
    value: "0.1.0",
    ignoreFocusOut: true,
    validateInput: (value) =>
      value.trim().length === 0 ? "A version is required" : undefined,
  });
  if (!version) return;

  const root = vscode.Uri.joinPath(parent.uri, name.trim());
  const manifestUri = vscode.Uri.joinPath(root, "package.json");

  const exists = await vscode.workspace.fs.stat(manifestUri).then(
    () => true,
    () => false
  );
  if (exists) {
    vscode.window.showErrorMessage(`${manifestUri.fsPath} already exists.`);
    return;
  }

  const manifest: PackageManifest = {
    name: name.trim(),
    version: version.trim(),
    type: "fhir.ig",
    fhirVersions: ["4.0.1"],
    canonical: `http://example.org/fhir/${name.trim()}`,
    dependencies: { "hl7.fhir.r4.core": "4.0.1" },
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

  onCreated();
  await vscode.window.showTextDocument(manifestUri);
};
