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
    title: vscode.l10n.t("Import FHIR Package"),
    openLabel: vscode.l10n.t("Import"),
    canSelectMany: false,
    filters: { [vscode.l10n.t("FHIR package")]: ["tgz", "gz", "tar", "zip"] },
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
      title: vscode.l10n.t("Importing {0}", file.path.split("/").pop() ?? ""),
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
          vscode.window.showInformationMessage(vscode.l10n.t("Imported {0}.", result.packageKey));
          return;
        }

        // The archive brings no dependency closure with it, but the registry
        // can supply one — so point at the command that does.
        const addDependency = vscode.l10n.t("Add Dependency");
        const answer = await vscode.window.showWarningMessage(
          vscode.l10n.t(
            "Imported {0}. Missing dependencies: {1}",
            result.packageKey,
            missing.map((entry) => entry.id).join(", ")
          ),
          addDependency
        );
        if (answer === addDependency) {
          await vscode.commands.executeCommand("fhirExplorer.addDependency");
        }
      } catch (error) {
        vscode.window.showErrorMessage(
          vscode.l10n.t(
            "Import failed: {0}",
            error instanceof Error ? error.message : String(error)
          )
        );
      }
    }
  );
};
