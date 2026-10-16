import * as vscode from "vscode";
import type { GlobalPackageStore } from "@/adapters/global-package-store";
import type { ProjectRegistry } from "@/workspace/project-registry";

/**
 * One line saying whether the extension has anything to work with.
 *
 * Importing a package used to change nothing observable when the workspace had
 * no project: the trees are project-driven, so both stayed empty and the work
 * appeared to have vanished. This is the always-visible answer to "did that do
 * anything", and it is the shortest route to the view that shows the result.
 */
export class FhirStatusBar {
  private readonly item: vscode.StatusBarItem;

  constructor(
    private readonly store: GlobalPackageStore,
    private readonly registry: ProjectRegistry
  ) {
    this.item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 90);
    this.item.command = "fhirExplorer.focusPackages";
    this.item.show();
  }

  async refresh(): Promise<void> {
    const [packages, projects] = await Promise.all([
      this.store.listPackages(),
      this.registry.list(),
    ]);

    if (packages.length === 0 && projects.length === 0) {
      this.item.text = `$(package) ${vscode.l10n.t("FHIR: nothing imported")}`;
      this.item.tooltip = vscode.l10n.t(
        "No FHIR packages and no project yet — click to get started."
      );
      this.item.command = "fhirExplorer.addDependency";
      return;
    }

    const parts = [
      packages.length === 1
        ? vscode.l10n.t("1 package")
        : vscode.l10n.t("{0} packages", packages.length),
      projects.length === 0
        ? vscode.l10n.t("no project")
        : projects.length === 1
          ? vscode.l10n.t("1 project")
          : vscode.l10n.t("{0} projects", projects.length),
    ];
    this.item.text = `$(package) FHIR: ${parts.join(", ")}`;
    this.item.command = "fhirExplorer.focusPackages";

    this.item.tooltip = new vscode.MarkdownString(
      projects.length === 0
        ? [
            vscode.l10n.t(
              "**{0} package(s) imported**, but no project in this workspace.",
              packages.length
            ),
            "",
            vscode.l10n.t(
              "Packages on their own only supply definitions. Create a project to author against them."
            ),
          ].join("\n")
        : [
            ...projects.map(
              (project) => `- ${project.manifest.name}@${project.manifest.version}`
            ),
            "",
            vscode.l10n.t("{0} package(s) imported.", packages.length),
          ].join("\n")
    );
  }

  dispose(): void {
    this.item.dispose();
  }
}
