import * as vscode from "vscode";
import { parseTree, type Node, type ParseError } from "jsonc-parser";
import { resolveProfileForResource } from "@fhir-explorer/core/fhir-editor/profiles/resolve";
import {
  buildSchemaTree,
  evaluateInvariants,
  validateResource,
  type ValidationIssue,
} from "@fhir-explorer/core/fhir-editor/schema";
import type { FhirIndex, FhirIndexSnapshot } from "@/language/fhir-index";
import { rangeForPath } from "@/language/json-path";
import { hostLocale } from "@/l10n/locale";
import { isProjectResource, projectForUri } from "@/workspace/project-discovery";

/**
 * Live validation into the Problems panel.
 *
 * This is the same `validateResource` the web app runs behind its form, plus
 * the profile's FHIRPath invariants the form shows next to it — the
 * difference is only where the result goes. Here every issue gets a real file
 * and range, so it participates in Problems, the editor gutter, `F8` and the
 * file decorations, none of which a web app can offer.
 */

const DEBOUNCE_MS = 300;

const severityOf = (issue: ValidationIssue): vscode.DiagnosticSeverity =>
  issue.severity === "error"
    ? vscode.DiagnosticSeverity.Error
    : vscode.DiagnosticSeverity.Warning;

/**
 * Only files inside a project's resource directories are FHIR resources.
 *
 * Which directories those are depends on the project: a Sushi repo also keeps
 * generated resources under `fsh-generated/`. Those are validated too — a
 * broken generated resource is still broken — they just cannot be edited.
 */
export const isResourceDocument = (
  snapshot: FhirIndexSnapshot,
  uri: vscode.Uri
): boolean => {
  if (!uri.path.endsWith(".json")) return false;
  const project = projectForUri(snapshot.projects, uri);
  return project ? isProjectResource(project, uri) : false;
};

const syntaxDiagnostics = (
  document: vscode.TextDocument,
  errors: ParseError[]
): vscode.Diagnostic[] =>
  errors.map((error) => {
    const range = new vscode.Range(
      document.positionAt(error.offset),
      document.positionAt(error.offset + Math.max(error.length, 1))
    );
    const diagnostic = new vscode.Diagnostic(
      range,
      vscode.l10n.t("Invalid JSON — the resource cannot be validated until it parses."),
      vscode.DiagnosticSeverity.Error
    );
    diagnostic.source = "FHIR Explorer";
    diagnostic.code = "json-parse";
    return diagnostic;
  });

const validationDiagnostics = async (
  document: vscode.TextDocument,
  root: Node | undefined,
  snapshot: FhirIndexSnapshot,
  content: Record<string, unknown>
): Promise<vscode.Diagnostic[]> => {
  const profile = resolveProfileForResource(content, snapshot.registry);
  if (!profile) {
    // Without the defining package there is nothing to validate against.
    // Saying so beats silently reporting a clean file.
    const diagnostic = new vscode.Diagnostic(
      rangeForPath(document, root, "resourceType"),
      typeof content.resourceType === "string"
        ? vscode.l10n.t(
            "No StructureDefinition found for {0}. Import the package that defines it.",
            content.resourceType
          )
        : vscode.l10n.t(
            "No StructureDefinition found for this resource. Import the package that defines it."
          ),
      vscode.DiagnosticSeverity.Information
    );
    diagnostic.source = "FHIR Explorer";
    diagnostic.code = "profile-missing";
    return [diagnostic];
  }

  const tree = buildSchemaTree(profile, snapshot.ctx);
  if (!tree) return [];

  const issues = [
    ...validateResource(content, tree, snapshot.ctx, {
      existingReferences: snapshot.references,
      locale: hostLocale(),
    }),
    // Async because the fhirpath engine is loaded on first use. An expression
    // the engine cannot evaluate is skipped rather than reported.
    ...(await evaluateInvariants(content, tree)),
  ];

  return issues.map((issue) => {
    const diagnostic = new vscode.Diagnostic(
      rangeForPath(document, root, issue.path),
      issue.message,
      severityOf(issue)
    );
    diagnostic.source = "FHIR Explorer";
    diagnostic.code = issue.code;
    return diagnostic;
  });
};

export class FhirDiagnostics {
  private readonly collection =
    vscode.languages.createDiagnosticCollection("fhirExplorer");
  private readonly pending = new Map<string, NodeJS.Timeout>();

  constructor(private readonly index: FhirIndex) {}

  dispose(): void {
    for (const timer of this.pending.values()) clearTimeout(timer);
    this.pending.clear();
    this.collection.dispose();
  }

  /** Re-validate after a keystroke, coalescing bursts of edits. */
  scheduleValidate(document: vscode.TextDocument): void {
    const key = document.uri.toString();
    const existing = this.pending.get(key);
    if (existing) clearTimeout(existing);
    this.pending.set(
      key,
      setTimeout(() => {
        this.pending.delete(key);
        void this.validate(document);
      }, DEBOUNCE_MS)
    );
  }

  async validate(document: vscode.TextDocument): Promise<void> {
    const snapshot = await this.index.get();
    if (!isResourceDocument(snapshot, document.uri)) {
      this.collection.delete(document.uri);
      return;
    }

    const errors: ParseError[] = [];
    const root = parseTree(document.getText(), errors, {
      allowTrailingComma: false,
    });

    if (errors.length > 0) {
      this.collection.set(document.uri, syntaxDiagnostics(document, errors));
      return;
    }

    if (!root || root.type !== "object") {
      this.collection.set(document.uri, []);
      return;
    }

    let content: Record<string, unknown>;
    try {
      content = JSON.parse(document.getText()) as Record<string, unknown>;
    } catch {
      this.collection.set(document.uri, []);
      return;
    }

    try {
      const version = document.version;
      const diagnostics = await validationDiagnostics(document, root, snapshot, content);
      // Invariants resolve asynchronously; a pass started for an older edit
      // must not overwrite the result of the one started after it.
      if (document.version !== version) return;
      this.collection.set(document.uri, diagnostics);
    } catch (error) {
      // A schema we cannot resolve must not take down the whole pass.
      const diagnostic = new vscode.Diagnostic(
        new vscode.Range(0, 0, 0, 0),
        vscode.l10n.t(
          "Validation failed: {0}",
          error instanceof Error ? error.message : String(error)
        ),
        vscode.DiagnosticSeverity.Warning
      );
      diagnostic.source = "FHIR Explorer";
      this.collection.set(document.uri, [diagnostic]);
    }
  }

  /**
   * Validate every resource in the workspace, not just the open ones, so the
   * Problems panel answers "is my IG consistent" and not merely "is this tab".
   */
  async validateWorkspace(): Promise<void> {
    const snapshot = await this.index.get();
    this.collection.clear();

    for (const project of snapshot.projects) {
      for (const directory of [
        ...project.resourceDirectories,
        ...project.generatedDirectories,
      ]) {
        const pattern = new vscode.RelativePattern(
          vscode.Uri.joinPath(project.root, ...directory.split("/")),
          "*.json"
        );
        for (const uri of await vscode.workspace.findFiles(pattern)) {
          const document = await vscode.workspace.openTextDocument(uri);
          await this.validate(document);
        }
      }
    }
  }

  forget(uri: vscode.Uri): void {
    this.collection.delete(uri);
  }
}
