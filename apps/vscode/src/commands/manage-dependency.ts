import * as vscode from "vscode";
import { resolveAndInstall } from "@/commands/add-dependency";
import {
  ManifestNotWritable,
  addDependencyToManifest,
  removeDependencyFromManifest,
} from "@/registry/manifest";
import { createImportSession } from "@/registry/session";
import { compareVersions, sortVersionsForPicking } from "@fhir-explorer/core/fhir-importer/version";
import type { WorkspaceProject } from "@/workspace/project-discovery";

/**
 * Changing a dependency after it has been added.
 *
 * A project manager that can only ever add is half a tool: pinning to a newer
 * release and dropping something you no longer need are the two things that
 * happen after the first install.
 */

const notWritable = (project: WorkspaceProject, error: unknown): string =>
  error instanceof ManifestNotWritable
    ? error.message
    : vscode.l10n.t(
        "could not write {0}: {1}",
        project.manifestFile.path.split("/").pop() ?? "",
        error instanceof Error ? error.message : String(error)
      );

export const removeDependencyCommand = async (
  project: WorkspaceProject,
  id: string,
  onChanged: () => void
): Promise<void> => {
  const remove = vscode.l10n.t("Remove");
  const confirmed = await vscode.window.showWarningMessage(
    vscode.l10n.t("Remove {0} from {1}?", id, project.manifest.name),
    {
      modal: true,
      detail: vscode.l10n.t(
        "The declaration is removed from the manifest. The downloaded package stays in the local cache, so other projects keep working and nothing has to be fetched again."
      ),
    },
    remove
  );
  if (confirmed !== remove) return;

  try {
    await removeDependencyFromManifest(project, id);
    onChanged();
  } catch (error) {
    vscode.window.showWarningMessage(vscode.l10n.t("Not removed: {0}", notWritable(project, error)));
  }
};

export const updateDependencyCommand = async (
  context: vscode.ExtensionContext,
  project: WorkspaceProject,
  id: string,
  current: string,
  onChanged: () => void
): Promise<void> => {
  const session = await createImportSession(context);

  let metadata;
  try {
    metadata = await vscode.window.withProgress(
      { location: vscode.ProgressLocation.Window, title: vscode.l10n.t("Checking {0} for updates", id) },
      () => session.registry.metadata(id)
    );
  } catch (error) {
    vscode.window.showErrorMessage(
      vscode.l10n.t(
        "Could not reach the package registry: {0}",
        error instanceof Error ? error.message : String(error)
      )
    );
    return;
  }

  if (!metadata || metadata.versions.length === 0) {
    vscode.window.showWarningMessage(
      vscode.l10n.t("The registry does not list any versions of {0}.", id)
    );
    return;
  }

  const versions = sortVersionsForPicking(
    metadata.versions.map((entry) => entry.version)
  );
  const newer = versions.filter((version) => compareVersions(version, current) > 0);

  if (newer.length === 0) {
    vscode.window.showInformationMessage(vscode.l10n.t("{0} is already at the newest version.", id));
    return;
  }

  const picked = await vscode.window.showQuickPick(
    // Older versions stay available — downgrading to escape a regression is a
    // legitimate move, it just should not be the default.
    versions.map((version) => ({
      label: version,
      description: [
        version === current ? vscode.l10n.t("current") : undefined,
        version === metadata.latest ? vscode.l10n.t("latest") : undefined,
        compareVersions(version, current) < 0 ? vscode.l10n.t("downgrade") : undefined,
      ]
        .filter(Boolean)
        .join(" · "),
    })),
    {
      title: vscode.l10n.t("Update {0} (currently {1})", id, current),
      placeHolder: vscode.l10n.t("Pick a version"),
    }
  );
  if (!picked || picked.label === current) return;

  const changed = await resolveAndInstall(
    session,
    [{ id, version: picked.label }],
    vscode.l10n.t("Update {0} to {1}", id, picked.label)
  );
  if (!changed) return;

  try {
    await addDependencyToManifest(project, id, picked.label);
  } catch (error) {
    vscode.window.showWarningMessage(
      vscode.l10n.t("Installed {0}, but {1}", `${id}@${picked.label}`, notWritable(project, error))
    );
  }
  onChanged();
};
