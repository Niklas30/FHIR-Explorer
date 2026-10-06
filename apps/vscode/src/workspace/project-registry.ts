import * as vscode from "vscode";
import { discoverProjects, type WorkspaceProject } from "@/workspace/project-discovery";

/**
 * The one place that knows which projects exist.
 *
 * Commands used to read the project list off the tree view, which only holds
 * one once it has painted. Open the palette without ever expanding the view
 * and every project-aware command behaved as if the workspace were empty:
 * "Add Dependency" installed and recorded nothing, "Install Dependencies"
 * reported none declared. Nothing errored, so it looked like the commands
 * themselves were broken.
 *
 * Discovery also ran independently in four places, so a single refresh
 * scanned the workspace four times.
 */
export class ProjectRegistry {
  private cached: Promise<WorkspaceProject[]> | undefined;
  private readonly changed = new vscode.EventEmitter<void>();

  /** Fires after the project set has been invalidated. */
  readonly onDidChange = this.changed.event;

  list(): Promise<WorkspaceProject[]> {
    this.cached ??= discoverProjects();
    return this.cached;
  }

  invalidate(): void {
    this.cached = undefined;
    this.changed.fire();
  }

  /** The project a file belongs to; the closest root wins when they nest. */
  async forUri(uri: vscode.Uri): Promise<WorkspaceProject | undefined> {
    const projects = await this.list();
    return projects
      .filter((project) => uri.path.startsWith(`${project.root.path}/`))
      .sort((a, b) => b.root.path.length - a.root.path.length)[0];
  }

  dispose(): void {
    this.changed.dispose();
  }
}

type ProjectPick = vscode.QuickPickItem & {
  project?: WorkspaceProject;
  create?: true;
};

/**
 * Ask which project an action applies to.
 *
 * Always offers creating one. A picker whose only outcome is "cancel" — which
 * is what an empty workspace used to get — leaves the user stuck at exactly
 * the moment they are trying to start.
 */
export const pickProject = async (
  registry: ProjectRegistry,
  title: string,
  onCreateRequested: () => void
): Promise<WorkspaceProject | undefined> => {
  const projects = await registry.list();

  if (projects.length === 1) return projects[0];

  const items: ProjectPick[] = [
    ...projects.map((project) => ({
      label: `$(package) ${project.manifest.title ?? project.manifest.name}`,
      description: `${project.manifest.name}@${project.manifest.version}`,
      detail: project.root.fsPath,
      project,
    })),
    ...(projects.length > 0
      ? [{ label: "", kind: vscode.QuickPickItemKind.Separator } as ProjectPick]
      : []),
    {
      label: `$(new-folder) ${vscode.l10n.t("Create a new project…")}`,
      detail:
        projects.length === 0
          ? vscode.l10n.t("No FHIR project in this workspace yet")
          : vscode.l10n.t("Opens the new project form"),
      create: true,
      alwaysShow: true,
    },
  ];

  const picked = await vscode.window.showQuickPick(items, {
    title,
    placeHolder:
      projects.length === 0
        ? vscode.l10n.t("No project found — create one")
        : vscode.l10n.t("Select a FHIR project"),
  });

  if (picked?.create) {
    onCreateRequested();
    return undefined;
  }
  return picked?.project;
};
