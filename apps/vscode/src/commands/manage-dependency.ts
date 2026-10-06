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
    : `could not write ${project.manifestFile.path.split("/").pop()}: ${
        error instanceof Error ? error.message : String(error)
      }`;

export const removeDependencyCommand = async (
  project: WorkspaceProject,
  id: string,
  onChanged: () => void
): Promise<void> => {
  const confirmed = await vscode.window.showWarningMessage(
    `Remove ${id} from ${project.manifest.name}?`,
    {
      modal: true,
      detail:
        "The declaration is removed from the manifest. The downloaded package stays in the local cache, so other projects keep working and nothing has to be fetched again.",
    },
    "Remove"
  );
  if (confirmed !== "Remove") return;

  try {
    await removeDependencyFromManifest(project, id);
    onChanged();
  } catch (error) {
    vscode.window.showWarningMessage(`Not removed: ${notWritable(project, error)}`);
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
      { location: vscode.ProgressLocation.Window, title: `Checking ${id} for updates` },
      () => session.registry.metadata(id)
    );
  } catch (error) {
    vscode.window.showErrorMessage(
      `Could not reach the package registry: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
    return;
  }

  if (!metadata || metadata.versions.length === 0) {
    vscode.window.showWarningMessage(`The registry does not list any versions of ${id}.`);
    return;
  }

  const versions = sortVersionsForPicking(
    metadata.versions.map((entry) => entry.version)
  );
  const newer = versions.filter((version) => compareVersions(version, current) > 0);

  if (newer.length === 0) {
    vscode.window.showInformationMessage(`${id} is already at the newest version.`);
    return;
  }

  const picked = await vscode.window.showQuickPick(
    // Older versions stay available — downgrading to escape a regression is a
    // legitimate move, it just should not be the default.
    versions.map((version) => ({
      label: version,
      description: [
        version === current ? "current" : undefined,
        version === metadata.latest ? "latest" : undefined,
        compareVersions(version, current) < 0 ? "downgrade" : undefined,
      ]
        .filter(Boolean)
        .join(" · "),
    })),
    { title: `Update ${id} (currently ${current})`, placeHolder: "Pick a version" }
  );
  if (!picked || picked.label === current) return;

  const changed = await resolveAndInstall(
    session,
    [{ id, version: picked.label }],
    `Update ${id} to ${picked.label}`
  );
  if (!changed) return;

  try {
    await addDependencyToManifest(project, id, picked.label);
  } catch (error) {
    vscode.window.showWarningMessage(
      `Installed ${id}@${picked.label}, but ${notWritable(project, error)}`
    );
  }
  onChanged();
};
