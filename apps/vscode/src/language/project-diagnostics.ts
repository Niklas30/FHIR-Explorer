import * as vscode from "vscode";
import { parseTree } from "jsonc-parser";
import {
  analyzeProject,
  createCanonicalResolvers,
  type ProjectIssue,
} from "@fhir-explorer/core/projects/analysis";
import { formatProjectIssue } from "@fhir-explorer/core/projects/issue-text";
import { hostLocale } from "@/l10n/locale";
import type { FhirIndex, FhirIndexSnapshot } from "@/language/fhir-index";
import { rangeForPath } from "@/language/json-path";
import { issueTargets } from "@/language/issue-targets";

/**
 * The project consistency analysis the web editor shows, in the Problems
 * panel: a profile whose base cannot be resolved, a binding to an unknown
 * value set, a canonical outside the project's base, two resources claiming
 * one url, a project without hl7.fhir.r4.core.
 *
 * Unlike per-file validation these are about how the files relate, so they
 * are recomputed for the whole project whenever the index changes, and kept
 * in a collection of their own so neither pass clears the other's findings.
 */

const DEBOUNCE_MS = 500;
const SOURCE = "FHIR Explorer";

const severityOf = (issue: ProjectIssue): vscode.DiagnosticSeverity =>
  issue.severity === "error"
    ? vscode.DiagnosticSeverity.Error
    : vscode.DiagnosticSeverity.Warning;

const rangeIn = async (uri: vscode.Uri, path: string | undefined): Promise<vscode.Range> => {
  try {
    const document = await vscode.workspace.openTextDocument(uri);
    if (!path || !uri.path.endsWith(".json")) return document.lineAt(0).range;
    return rangeForPath(document, parseTree(document.getText()), path);
  } catch {
    return new vscode.Range(0, 0, 0, 0);
  }
};

export const projectDiagnostics = async (
  snapshot: FhirIndexSnapshot
): Promise<Map<string, vscode.Diagnostic[]>> => {
  const locale = hostLocale();
  const byFile = new Map<string, vscode.Diagnostic[]>();

  for (const project of snapshot.projects) {
    const resources = snapshot.projectResources.get(project.root.toString()) ?? [];
    const analysis = analyzeProject({
      manifest: project.manifest,
      resources,
      resolvers: createCanonicalResolvers(snapshot.registry, project.manifest),
    });

    for (const issue of analysis.issues) {
      for (const { resourceId, path } of issueTargets(issue, resources)) {
        const uri = resourceId
          ? vscode.Uri.joinPath(project.root, ...resourceId.split("/"))
          : project.manifestFile;
        const diagnostic = new vscode.Diagnostic(
          await rangeIn(uri, path),
          formatProjectIssue(issue, locale),
          severityOf(issue)
        );
        diagnostic.source = SOURCE;
        diagnostic.code = issue.code;
        const key = uri.toString();
        byFile.set(key, [...(byFile.get(key) ?? []), diagnostic]);
      }
    }
  }
  return byFile;
};

export class ProjectDiagnostics implements vscode.Disposable {
  private readonly collection =
    vscode.languages.createDiagnosticCollection("fhirExplorerProject");
  private readonly subscription: vscode.Disposable;
  private timer: NodeJS.Timeout | undefined;
  private generation = 0;

  constructor(private readonly index: FhirIndex) {
    this.subscription = index.onDidChange(() => this.schedule());
  }

  schedule(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.timer = undefined;
      void this.analyze();
    }, DEBOUNCE_MS);
  }

  async analyze(): Promise<void> {
    // A newer pass may start while this one awaits files; only the latest
    // one gets to write, so a slow pass never resurrects fixed issues.
    const generation = ++this.generation;
    let byFile: Map<string, vscode.Diagnostic[]>;
    try {
      byFile = await projectDiagnostics(await this.index.get());
    } catch {
      // An index that cannot be built is already reported by the per-file
      // pass; keeping the last findings beats clearing them on a hiccup.
      return;
    }
    if (generation !== this.generation) return;

    this.collection.clear();
    for (const [uri, diagnostics] of byFile) {
      this.collection.set(vscode.Uri.parse(uri), diagnostics);
    }
  }

  dispose(): void {
    if (this.timer) clearTimeout(this.timer);
    this.subscription.dispose();
    this.collection.dispose();
  }
}
