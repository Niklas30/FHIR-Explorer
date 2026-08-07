import * as vscode from "vscode";
import { ImporterClient } from "@fhir-explorer/core/fhir-importer/client";
import { hostPackageParser } from "@/adapters/host-package-parser";
import { GlobalPackageStore } from "@/adapters/global-package-store";

/**
 * Import a package archive from disk.
 *
 * The registry path covers published packages; this covers the one it cannot —
 * an IG the user just built locally, or a package shared as a file.
 */
export const importPackageFileCommand = async (
  context: vscode.ExtensionContext,
  onImported: () => void
): Promise<void> => {
  const picked = await vscode.window.showOpenDialog({
    title: "Import FHIR Package",
    openLabel: "Import",
    canSelectMany: false,
    filters: { "FHIR package": ["tgz", "gz", "tar", "zip"] },
  });
  const file = picked?.[0];
  if (!file) return;

  const client = new ImporterClient({
    store: new GlobalPackageStore(context.globalStorageUri),
    parser: hostPackageParser,
  });

  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: `Importing ${file.path.split("/").pop()}`,
    },
    async (progress) => {
      try {
        const bytes = await vscode.workspace.fs.readFile(file);
        const buffer = bytes.buffer.slice(
          bytes.byteOffset,
          bytes.byteOffset + bytes.byteLength
        ) as ArrayBuffer;

        const result = await client.importPackageBuffer(buffer, (update) =>
          progress.report({ message: update.message ?? update.phase })
        );
        await client.addImportHistory(result.packageKey);
        onImported();

        const { missing } = (await client.loadSnapshot()).dependencyState;
        if (missing.length === 0) {
          vscode.window.showInformationMessage(`Imported ${result.packageKey}.`);
          return;
        }

        // The archive brings no dependency closure with it, but the registry
        // can supply one — so point at the command that does.
        const answer = await vscode.window.showWarningMessage(
          `Imported ${result.packageKey}. Missing ${missing.length} ${
            missing.length === 1 ? "dependency" : "dependencies"
          }: ${missing.map((entry) => entry.id).join(", ")}`,
          "Add Dependency"
        );
        if (answer === "Add Dependency") {
          await vscode.commands.executeCommand("fhirExplorer.addDependency");
        }
      } catch (error) {
        vscode.window.showErrorMessage(
          `Import failed: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }
  );
};
