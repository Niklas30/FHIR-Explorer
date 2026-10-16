import * as vscode from "vscode";
import { ImporterClient } from "@fhir-explorer/core/fhir-importer/client";
import { hostPackageParser } from "@/adapters/host-package-parser";
import type { GlobalPackageStore } from "@/adapters/global-package-store";
import type { PackageTreeNode } from "@/tree/package-tree";

/** Remove one imported version, leaving authored files and the shared cache alone. */
export const deletePackageCommand = async (
  store: GlobalPackageStore,
  onDeleted: () => void,
  node?: PackageTreeNode
): Promise<void> => {
  try {
    let record = node?.type === "package" ? node.record : undefined;
    if (node && !record) return;
    if (!record) {
      const packages = await store.listPackages();
      if (packages.length === 0) {
        await vscode.window.showInformationMessage(vscode.l10n.t("No imported packages to delete."));
        return;
      }
      const picked = await vscode.window.showQuickPick(
        packages.sort((a, b) => a.key.localeCompare(b.key)).map((entry) => ({
          label: entry.manifest.title ?? entry.id,
          description: entry.key,
          record: entry,
        })),
        { title: vscode.l10n.t("Delete Imported Package"), matchOnDescription: true }
      );
      record = picked?.record;
    }
    if (!record) return;

    const remove = vscode.l10n.t("Delete Package");
    const answer = await vscode.window.showWarningMessage(
      vscode.l10n.t("Delete imported package {0}?", record.key),
      {
        modal: true,
        detail: vscode.l10n.t(
          "This removes this version from FHIR Explorer in all workspaces. Projects that depend on it will report a missing dependency until you import or install it again. Project files, other packages and the shared FHIR cache are kept."
        ),
      },
      remove
    );
    if (answer !== remove) return;

    const client = new ImporterClient({ store, parser: hostPackageParser });
    await client.deletePackage(record.key);
    onDeleted();
    await vscode.window.showInformationMessage(vscode.l10n.t("Deleted imported package {0}.", record.key));
  } catch (error) {
    await vscode.window.showErrorMessage(vscode.l10n.t(
      "Could not delete package: {0}",
      error instanceof Error ? error.message : String(error)
    ));
  }
};
