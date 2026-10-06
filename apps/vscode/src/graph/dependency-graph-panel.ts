import * as vscode from "vscode";
import { GlobalPackageStore } from "@/adapters/global-package-store";
import { projectAsPackageRecord } from "@/registry/dependency-view";
import { renderWebviewHtml } from "@/webview/html";
import type { WorkspaceProject } from "@/workspace/project-discovery";

/**
 * The dependency closure as a panel.
 *
 * A single panel, reused: opening the graph twice should focus the one that is
 * already there rather than pile up tabs. It refreshes itself whenever
 * packages change, so it stays correct while the user installs from it.
 */

const VIEW_TYPE = "fhirExplorer.dependencyGraph";

type FromWebview =
  | { type: "ready" }
  | { type: "resolveMissing"; dependencyId: string; requirement: string };

export class DependencyGraphPanel {
  private static current: DependencyGraphPanel | undefined;

  private readonly disposables: vscode.Disposable[] = [];

  private constructor(
    private readonly panel: vscode.WebviewPanel,
    private readonly context: vscode.ExtensionContext,
    private project: WorkspaceProject,
    private readonly onInstallRequested: (id: string, requirement: string) => void
  ) {
    panel.webview.options = {
      enableScripts: true,
      localResourceRoots: [vscode.Uri.joinPath(context.extensionUri, "dist")],
    };
    panel.webview.html = renderWebviewHtml(
      panel.webview,
      context.extensionUri,
      "graph",
      "FHIR Dependencies"
    );

    this.disposables.push(
      panel.webview.onDidReceiveMessage((message: FromWebview) => {
        if (message.type === "ready") {
          void this.send();
          return;
        }
        if (message.type === "resolveMissing") {
          this.onInstallRequested(message.dependencyId, message.requirement);
        }
      })
    );

    panel.onDidDispose(() => this.dispose(), null, this.disposables);
  }

  static show(
    context: vscode.ExtensionContext,
    project: WorkspaceProject,
    onInstallRequested: (id: string, requirement: string) => void
  ): DependencyGraphPanel {
    const column = vscode.window.activeTextEditor?.viewColumn ?? vscode.ViewColumn.One;

    if (DependencyGraphPanel.current) {
      DependencyGraphPanel.current.project = project;
      DependencyGraphPanel.current.panel.reveal(column);
      void DependencyGraphPanel.current.send();
      return DependencyGraphPanel.current;
    }

    const panel = vscode.window.createWebviewPanel(
      VIEW_TYPE,
      vscode.l10n.t("FHIR Dependencies"),
      column,
      { enableScripts: true, retainContextWhenHidden: true }
    );

    DependencyGraphPanel.current = new DependencyGraphPanel(
      panel,
      context,
      project,
      onInstallRequested
    );
    return DependencyGraphPanel.current;
  }

  /** Repaint after an install, so the graph the user acted on stays truthful. */
  static refresh(): void {
    void DependencyGraphPanel.current?.send();
  }

  private async send(): Promise<void> {
    const installed = await new GlobalPackageStore(
      this.context.globalStorageUri
    ).listPackages();

    // Maps cannot cross the message channel, so the records go over plain and
    // the webview rebuilds the graph with the same core function.
    await this.panel.webview.postMessage({
      type: "graph",
      packages: [
        projectAsPackageRecord(this.project),
        ...installed.filter((entry) => entry.key !== this.project.key),
      ],
      rootKey: this.project.key,
      rootLabel: `${this.project.manifest.title ?? this.project.manifest.name} · ${this.project.key}`,
    });
  }

  private dispose(): void {
    DependencyGraphPanel.current = undefined;
    this.panel.dispose();
    for (const disposable of this.disposables) disposable.dispose();
  }
}
