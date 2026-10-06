import * as vscode from "vscode";
import { buildPackageKey } from "@fhir-explorer/core/fhir-importer/utils";
import {
  ManifestNotWritable,
  addDependencyToManifest,
} from "@/registry/manifest";
import { planInstall, type InstallPlan, type PlanRequest } from "@fhir-explorer/core/fhir-importer/install-plan";
import { createImportSession, type ImportSession } from "@/registry/session";
import type { PackageRegistryApi } from "@fhir-explorer/core/fhir-importer/registry-api";
import { sortVersionsForPicking } from "@fhir-explorer/core/fhir-importer/version";
import type { WorkspaceProject } from "@/workspace/project-discovery";

/**
 * Add a package by name, with its dependencies resolved for you.
 *
 * The browser build could not do this: CORS stops it downloading, so it had to
 * send the user out to fetch each tarball by hand and discover missing
 * dependencies one at a time. In the host there is no such limit, and the
 * registry publishes each version's dependencies — so the whole tree is
 * resolved from metadata first and the user confirms one plan.
 */

const SEARCH_DEBOUNCE_MS = 250;

type PackagePick = vscode.QuickPickItem & { packageId?: string };

/** Live search against the registry catalogue, with manual entry as a fallback. */
const pickPackageId = async (registry: PackageRegistryApi): Promise<string | undefined> => {
  const quickPick = vscode.window.createQuickPick<PackagePick>();
  quickPick.title = vscode.l10n.t("Add FHIR Dependency");
  quickPick.placeholder = vscode.l10n.t("Search the registry, or type a package id");
  quickPick.matchOnDescription = true;
  // Results come from the registry, already filtered — filtering them again
  // locally would hide hits whose relevance the registry judged differently.
  quickPick.ignoreFocusOut = true;

  let timer: NodeJS.Timeout | undefined;
  let generation = 0;

  const runSearch = (value: string) => {
    const current = ++generation;
    const query = value.trim();

    if (query.length < 2) {
      quickPick.items = [];
      quickPick.busy = false;
      return;
    }

    quickPick.busy = true;
    void registry.search(query).then((hits) => {
      // A slower earlier search must not overwrite a newer result.
      if (current !== generation) return;
      quickPick.busy = false;
      quickPick.items = [
        ...hits.map((hit) => ({
          label: hit.name,
          description: hit.fhirVersion,
          detail: hit.description?.replace(/\s+/g, " ").trim(),
          packageId: hit.name,
        })),
        ...(hits.some((hit) => hit.name === query)
          ? []
          : [
              {
                label: `$(arrow-right) ${vscode.l10n.t('Use "{0}"', query)}`,
                detail: vscode.l10n.t("Install this package id even though the search did not list it"),
                packageId: query,
                alwaysShow: true,
              },
            ]),
      ];
    });
  };

  quickPick.onDidChangeValue((value) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => runSearch(value), SEARCH_DEBOUNCE_MS);
  });

  const picked = await new Promise<PackagePick | undefined>((resolve) => {
    quickPick.onDidAccept(() => resolve(quickPick.selectedItems[0]));
    quickPick.onDidHide(() => resolve(undefined));
    quickPick.show();
  });

  if (timer) clearTimeout(timer);
  quickPick.dispose();
  return picked?.packageId;
};

const pickVersion = async (
  registry: PackageRegistryApi,
  id: string
): Promise<string | undefined> => {
  const metadata = await vscode.window.withProgress(
    { location: vscode.ProgressLocation.Window, title: vscode.l10n.t("Loading versions of {0}", id) },
    () => registry.metadata(id)
  );

  if (!metadata || metadata.versions.length === 0) {
    const typed = await vscode.window.showInputBox({
      title: vscode.l10n.t("Version of {0}", id),
      prompt: vscode.l10n.t("The registry did not list any versions — enter one manually"),
      ignoreFocusOut: true,
    });
    return typed?.trim() || undefined;
  }

  const byVersion = new Map(metadata.versions.map((entry) => [entry.version, entry]));
  const items = sortVersionsForPicking(metadata.versions.map((entry) => entry.version)).map(
    (version) => {
      const entry = byVersion.get(version);
      const tags = [
        version === metadata.latest ? vscode.l10n.t("latest") : undefined,
        entry?.fhirVersion ? `FHIR ${entry.fhirVersion}` : undefined,
      ].filter(Boolean);
      return {
        label: version,
        description: tags.join(" · "),
        detail: entry?.date?.slice(0, 10),
      };
    }
  );

  const picked = await vscode.window.showQuickPick(items, {
    title: vscode.l10n.t("Version of {0}", id),
    placeHolder: metadata.latest
      ? vscode.l10n.t("latest is {0}", metadata.latest)
      : vscode.l10n.t("Pick a version"),
  });
  return picked?.label;
};

/** Let the user override a version the planner picked for them. */
const resolveConflicts = async (
  plan: InstallPlan
): Promise<Record<string, string> | undefined> => {
  const overrides: Record<string, string> = {};

  for (const conflict of plan.conflicts) {
    const picked = await vscode.window.showQuickPick(
      conflict.requested.map((entry) => ({
        label: entry.version,
        description:
          entry.version === conflict.chosen ? vscode.l10n.t("newest — default") : undefined,
        detail: vscode.l10n.t(
          "Required by {0}",
          entry.requestedBy.join(", ") || vscode.l10n.t("your project")
        ),
      })),
      {
        title: vscode.l10n.t("Version conflict: {0}", conflict.id),
        placeHolder: vscode.l10n.t("Two packages disagree — pick the version to install"),
      }
    );
    if (!picked) return undefined; // cancelled
    if (picked.label !== conflict.chosen) overrides[conflict.id] = picked.label;
  }

  return overrides;
};

const describePlan = (plan: InstallPlan): string => {
  const toInstall = plan.packages.filter((entry) => !entry.satisfied);
  const present = plan.packages.length - toInstall.length;

  const lines = [
    toInstall.length === 1
      ? vscode.l10n.t("1 package will be installed:")
      : vscode.l10n.t("{0} packages will be installed:", toInstall.length),
    ...toInstall.map(
      (entry) => `  ${entry.key}${entry.direct ? "" : `  (${vscode.l10n.t("dependency")})`}`
    ),
  ];
  if (present > 0) {
    lines.push(vscode.l10n.t("{0} already available and will be reused.", present));
  }
  if (plan.unresolved.length > 0) {
    lines.push(
      "",
      vscode.l10n.t("Not found in the registry:"),
      ...plan.unresolved.map(
        (entry) =>
          `  ${entry.id}@${entry.range}${
            entry.requestedBy.length
              ? ` (${vscode.l10n.t("required by {0}", entry.requestedBy.join(", "))})`
              : ""
          }`
      )
    );
  }
  return lines.join("\n");
};

/** Resolve, let the user confirm, then download. Shared by both commands. */
export const resolveAndInstall = async (
  session: ImportSession,
  roots: PlanRequest[],
  title: string
): Promise<boolean> => {
  const resolve = (overrides?: Record<string, string>) =>
    planInstall(roots, session.registry, {
      isSatisfied: (id, version) => session.available.has(buildPackageKey(id, version)),
      overrides,
    });

  let plan: InstallPlan;
  try {
    plan = await vscode.window.withProgress(
      { location: vscode.ProgressLocation.Window, title: vscode.l10n.t("Resolving dependencies") },
      () => resolve()
    );
  } catch (error) {
    // A registry that cannot be reached must not turn into a plan that claims
    // the packages do not exist.
    vscode.window.showErrorMessage(
      vscode.l10n.t(
        "Could not reach the package registry: {0}",
        error instanceof Error ? error.message : String(error)
      )
    );
    return false;
  }

  if (plan.conflicts.length > 0) {
    const overrides = await resolveConflicts(plan);
    if (!overrides) return false;
    if (Object.keys(overrides).length > 0) plan = await resolve(overrides);
  }

  const pending = plan.packages.filter((entry) => !entry.satisfied);
  if (pending.length === 0 && plan.unresolved.length === 0) {
    vscode.window.showInformationMessage(vscode.l10n.t("Everything is already installed."));
    return true;
  }

  const install = vscode.l10n.t("Install");
  const confirmed = await vscode.window.showInformationMessage(
    title,
    { modal: true, detail: describePlan(plan) },
    install
  );
  if (confirmed !== install) return false;

  const outcome = await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: vscode.l10n.t("Installing FHIR packages"),
      cancellable: true,
    },
    (progress, token) =>
      session.installer.install(
        plan.packages,
        (message, completed, total) =>
          progress.report({
            message: `${message} (${completed}/${total})`,
            increment: 100 / Math.max(total, 1),
          }),
        token
      )
  );

  const total = outcome.installed.length + outcome.reused.length;
  if (outcome.failed.length > 0) {
    vscode.window.showWarningMessage(
      vscode.l10n.t(
        "Installed {0} package(s), {1} failed: {2}",
        total,
        outcome.failed.length,
        outcome.failed.map((entry) => `${entry.key} (${entry.message})`).join(", ")
      )
    );
  } else {
    vscode.window.showInformationMessage(vscode.l10n.t("Installed {0} package(s).", total));
  }

  return outcome.installed.length > 0 || outcome.reused.length > 0;
};

export const addDependencyCommand = async (
  context: vscode.ExtensionContext,
  project: WorkspaceProject | undefined,
  onInstalled: () => void
): Promise<void> => {
  const session = await createImportSession(context);

  const id = await pickPackageId(session.registry);
  if (!id) return;

  const version = await pickVersion(session.registry, id);
  if (!version) return;

  const changed = await resolveAndInstall(
    session,
    [{ id, version }],
    vscode.l10n.t("Add {0}", buildPackageKey(id, version))
  );
  if (!changed) return;

  // The manifest records what the user asked for, so a fresh checkout can
  // reproduce the install without any extension state.
  if (project) {
    try {
      await addDependencyToManifest(project, id, version);
    } catch (error) {
      const detail =
        error instanceof ManifestNotWritable
          ? error.message
          : vscode.l10n.t(
              "could not write {0}: {1}",
              project.manifestFile.path.split("/").pop() ?? "",
              error instanceof Error ? error.message : String(error)
            );
      vscode.window.showWarningMessage(vscode.l10n.t("Installed {0}, but {1}", id, detail));
    }
  }

  onInstalled();
};
