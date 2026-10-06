import * as vscode from "vscode";
import { buildPackageKey } from "@fhir-explorer/core/fhir-importer/utils";
import { resolveAndInstall } from "@/commands/add-dependency";
import type { PlanRequest } from "@fhir-explorer/core/fhir-importer/install-plan";
import { createImportSession } from "@/registry/session";
import type { WorkspaceProject } from "@/workspace/project-discovery";

/**
 * The `npm install` of this extension: bring the workspace in line with what
 * the project manifests declare.
 *
 * This is the command that makes a fresh clone work. Nothing about the install
 * lives in extension state — the `package.json` files are the input.
 */

/**
 * The dependencies every project declares, whichever format it declares them
 * in — discovery has already normalised package.json, sushi-config.yaml and
 * the ImplementationGuide onto one manifest.
 */
const rootsOf = (projects: WorkspaceProject[]): PlanRequest[] => {
  const roots = new Map<string, string>();
  for (const project of projects) {
    for (const [id, version] of Object.entries(project.manifest.dependencies ?? {})) {
      roots.set(id, version);
    }
  }
  return [...roots.entries()].map(([id, version]) => ({ id, version }));
};

export const installDependenciesCommand = async (
  context: vscode.ExtensionContext,
  projects: WorkspaceProject[],
  onInstalled: () => void
): Promise<void> => {
  const roots = rootsOf(projects);
  if (roots.length === 0) {
    vscode.window.showInformationMessage(
      vscode.l10n.t("No dependencies declared. Use FHIR Explorer: Add Dependency to add one.")
    );
    return;
  }

  const session = await createImportSession(context);
  const changed = await resolveAndInstall(
    session,
    roots,
    vscode.l10n.t("Install declared dependencies")
  );
  if (changed) onInstalled();
};

/**
 * Offer to install on activation when a project declares dependencies that are
 * not there.
 *
 * A notification, never a modal: opening a repository should not block on a
 * download, and the command is one palette entry away if the user says no.
 */
export const offerMissingDependencies = async (
  context: vscode.ExtensionContext,
  projects: WorkspaceProject[],
  onInstalled: () => void
): Promise<void> => {
  const roots = rootsOf(projects);
  if (roots.length === 0) return;

  const session = await createImportSession(context);
  const missing = roots.filter(
    (root) => !session.available.has(buildPackageKey(root.id, root.version))
  );
  if (missing.length === 0) return;

  // Resolving first would mean network round trips before the user has shown
  // any interest, so this counts only the direct declarations.
  const install = vscode.l10n.t("Install");
  const answer = await vscode.window.showInformationMessage(
    missing.length === 1
      ? vscode.l10n.t("The FHIR dependency {0} is not installed.", missing[0].id)
      : vscode.l10n.t("{0} FHIR dependencies are not installed.", missing.length),
    install,
    vscode.l10n.t("Not now")
  );
  if (answer !== install) return;

  const changed = await resolveAndInstall(
    session,
    roots,
    vscode.l10n.t("Install declared dependencies")
  );
  if (changed) onInstalled();
};

/**
 * Install one dependency the user pointed at — a missing node in the tree or
 * the graph. Its own dependencies come along, same as anywhere else.
 */
export const installMissingDependency = async (
  context: vscode.ExtensionContext,
  id: string,
  version: string,
  onInstalled: () => void
): Promise<void> => {
  const session = await createImportSession(context);
  const changed = await resolveAndInstall(session, [{ id, version }], `Install ${id}`);
  if (changed) onInstalled();
};
