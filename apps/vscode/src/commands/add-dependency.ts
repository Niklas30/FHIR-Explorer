import * as vscode from "vscode";
import { buildPackageKey } from "@fhir-explorer/core/fhir-importer/utils";
import { addDependencyToManifest } from "@/registry/manifest";
import { planInstall, type InstallPlan, type PlanRequest } from "@/registry/plan";
import { createImportSession, type ImportSession } from "@/registry/session";
import type { RegistryClient } from "@/registry/registry-client";
import { sortVersionsForPicking } from "@/registry/version";
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
const pickPackageId = async (registry: RegistryClient): Promise<string | undefined> => {
  const quickPick = vscode.window.createQuickPick<PackagePick>();
  quickPick.title = "Add FHIR Dependency";
  quickPick.placeholder = "Search the registry, or type a package id";
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
                label: `$(arrow-right) Use "${query}"`,
                detail: "Install this package id even though the search did not list it",
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
  registry: RegistryClient,
  id: string
): Promise<string | undefined> => {
  const metadata = await vscode.window.withProgress(
    { location: vscode.ProgressLocation.Window, title: `Loading versions of ${id}` },
    () => registry.metadata(id)
  );

  if (!metadata || metadata.versions.length === 0) {
    const typed = await vscode.window.showInputBox({
      title: `Version of ${id}`,
      prompt: "The registry did not list any versions — enter one manually",
      ignoreFocusOut: true,
    });
    return typed?.trim() || undefined;
  }

  const byVersion = new Map(metadata.versions.map((entry) => [entry.version, entry]));
  const items = sortVersionsForPicking(metadata.versions.map((entry) => entry.version)).map(
    (version) => {
      const entry = byVersion.get(version);
      const tags = [
        version === metadata.latest ? "latest" : undefined,
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
    title: `Version of ${id}`,
    placeHolder: metadata.latest ? `latest is ${metadata.latest}` : "Pick a version",
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
        description: entry.version === conflict.chosen ? "newest — default" : undefined,
        detail: `Required by ${entry.requestedBy.join(", ") || "your project"}`,
      })),
      {
        title: `Version conflict: ${conflict.id}`,
        placeHolder: "Two packages disagree — pick the version to install",
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
      ? "1 package will be installed:"
      : `${toInstall.length} packages will be installed:`,
    ...toInstall.map((entry) => `  ${entry.key}${entry.direct ? "" : "  (dependency)"}`),
  ];
  if (present > 0) lines.push(`${present} already available and will be reused.`);
  if (plan.unresolved.length > 0) {
    lines.push(
      "",
      "Not found in the registry:",
      ...plan.unresolved.map(
        (entry) =>
          `  ${entry.id}@${entry.range}${
            entry.requestedBy.length ? ` (required by ${entry.requestedBy.join(", ")})` : ""
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
      { location: vscode.ProgressLocation.Window, title: "Resolving dependencies" },
      () => resolve()
    );
  } catch (error) {
    // A registry that cannot be reached must not turn into a plan that claims
    // the packages do not exist.
    vscode.window.showErrorMessage(
      `Could not reach the package registry: ${
        error instanceof Error ? error.message : String(error)
      }`
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
    vscode.window.showInformationMessage("Everything is already installed.");
    return true;
  }

  const confirmed = await vscode.window.showInformationMessage(
    title,
    { modal: true, detail: describePlan(plan) },
    "Install"
  );
  if (confirmed !== "Install") return false;

  const outcome = await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: "Installing FHIR packages",
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
      `Installed ${total} package${total === 1 ? "" : "s"}, ${outcome.failed.length} failed: ${outcome.failed
        .map((entry) => `${entry.key} (${entry.message})`)
        .join(", ")}`
    );
  } else {
    vscode.window.showInformationMessage(
      `Installed ${total} package${total === 1 ? "" : "s"}.`
    );
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
    `Add ${buildPackageKey(id, version)}`
  );
  if (!changed) return;

  // The manifest records what the user asked for, so a fresh checkout can
  // reproduce the install without any extension state.
  if (project) {
    try {
      await addDependencyToManifest(
        vscode.Uri.joinPath(project.root, "package.json"),
        id,
        version
      );
    } catch (error) {
      vscode.window.showWarningMessage(
        `Installed ${id}, but could not record it in package.json: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  onInstalled();
};
