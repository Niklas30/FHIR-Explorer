import * as vscode from "vscode";
import { collectProfileClosure } from "@fhir-explorer/core/fhir-editor/closure";
import { resolveProfileForResource } from "@fhir-explorer/core/fhir-editor/profiles/resolve";
import type { ResourcePayload } from "@fhir-explorer/core/fhir-importer/types";
import { nodeHttpClient } from "@/adapters/node-http-client";
import { hostLocale } from "@/l10n/locale";
import type { FhirIndex, FhirIndexSnapshot } from "@/language/fhir-index";
import { renderWebviewHtml } from "@/webview/html";
import {
  isGeneratedResource,
  projectForUri,
} from "@/workspace/project-discovery";
import { applyChanges, collectChanges, narrowReplacement } from "@/editor/json-diff";

/**
 * The profile-driven form as an editor tab over the resource file.
 *
 * A `CustomTextEditorProvider`, not a `CustomEditorProvider`: the document
 * stays a plain text document that VS Code owns. Undo, redo, dirty state, hot
 * exit, "Reopen with… Text Editor" and a live text editor in a split pane all
 * come from that and need no code here. The webview is a projection of the
 * document, never a second copy of it.
 */

const VIEW_TYPE = "fhirExplorer.formEditor";

type WebviewToHost =
  | { type: "ready" }
  | { type: "edit"; content: Record<string, unknown>; documentVersion: number }
  | { type: "expandValueSet"; requestId: string; url: string }
  | { type: "error"; message: string };

const parseResource = (text: string): Record<string, unknown> | null => {
  try {
    const value: unknown = JSON.parse(text);
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
};

/**
 * A profile the constraints view can edit: a StructureDefinition that
 * constrains a base. Specialisations and logical models define elements of
 * their own, which the constraints view has no tree for.
 */
const constrainedBase = (content: Record<string, unknown> | null): string | undefined =>
  content?.resourceType === "StructureDefinition" &&
  content.derivation !== "specialization" &&
  typeof content.baseDefinition === "string"
    ? content.baseDefinition
    : undefined;

/**
 * Value sets a binding in this project can point at: the ones the project
 * authors itself, as in the web editor. Every value set of every dependency
 * would make a list nobody can pick from.
 */
const projectValueSets = (
  snapshot: FhirIndexSnapshot,
  uri: vscode.Uri
): { url: string; label: string }[] => {
  const project = projectForUri(snapshot.projects, uri);
  if (!project) return [];
  return [...snapshot.definitions.values()]
    .filter(
      (definition) =>
        definition.resourceType === "ValueSet" &&
        projectForUri(snapshot.projects, definition.uri) === project
    )
    .map((definition) => {
      const valueSet = snapshot.registry.valueSetsByUrl.get(definition.canonical);
      const label =
        (typeof valueSet?.title === "string" && valueSet.title) ||
        (typeof valueSet?.name === "string" && valueSet.name) ||
        definition.canonical;
      return { url: definition.canonical, label };
    })
    .sort((a, b) => a.label.localeCompare(b.label));
};

const mergePayloads = (...lists: ResourcePayload[][]): ResourcePayload[] => {
  const byKey = new Map<string, ResourcePayload>();
  for (const payload of lists.flat()) byKey.set(payload.key, payload);
  return [...byKey.values()];
};

/** Match the file's own indentation instead of imposing ours. */
const formattingFor = (document: vscode.TextDocument) => {
  const editor = vscode.window.visibleTextEditors.find(
    (candidate) => candidate.document.uri.toString() === document.uri.toString()
  );
  const tabSize = Number(editor?.options.tabSize ?? 2);
  const insertSpaces = editor?.options.insertSpaces ?? true;
  return {
    tabSize: Number.isFinite(tabSize) ? tabSize : 2,
    insertSpaces: insertSpaces !== false,
    eol: document.eol === vscode.EndOfLine.CRLF ? "\r\n" : "\n",
  };
};

export class FormEditorProvider implements vscode.CustomTextEditorProvider {
  static readonly viewType = VIEW_TYPE;

  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly index: FhirIndex
  ) {}

  async resolveCustomTextEditor(
    document: vscode.TextDocument,
    panel: vscode.WebviewPanel
  ): Promise<void> {
    // Resources under fsh-generated/ are build output: the next Sushi run
    // overwrites them, so editing one silently loses the work. Validation and
    // navigation still apply to them — only editing does not.
    const snapshot = await this.index.get();
    const project = projectForUri(snapshot.projects, document.uri);
    if (project && isGeneratedResource(project, document.uri)) {
      panel.webview.options = { enableScripts: false };
      panel.webview.html = generatedNotice(document.uri);
      return;
    }

    panel.webview.options = {
      enableScripts: true,
      localResourceRoots: [vscode.Uri.joinPath(this.context.extensionUri, "dist")],
    };
    panel.webview.html = renderWebviewHtml(
      panel.webview,
      this.context.extensionUri,
      "main",
      "FHIR Form Editor"
    );

    const sendInit = async () => {
      const snapshot = await this.index.get();
      const content = parseResource(document.getText());
      const profile = content
        ? resolveProfileForResource(content, snapshot.registry)
        : null;

      // Only the closure of this one profile — the full registry would be
      // tens of megabytes across the message channel.
      const base = constrainedBase(content);
      const payloads = mergePayloads(
        profile?.url ? collectProfileClosure(profile.url, snapshot.registry) : [],
        // A profile is edited against its base, so that closure travels too.
        base ? collectProfileClosure(base, snapshot.registry) : []
      );

      await panel.webview.postMessage({
        type: "init",
        payloads,
        text: document.getText(),
        documentVersion: document.version,
        locale: hostLocale(),
        terminologyServerUrl:
          vscode.workspace
            .getConfiguration("fhirExplorer")
            .get<string>("terminologyServer.url")
            ?.trim() || null,
        references: [...snapshot.references],
        valueSetOptions: base ? projectValueSets(snapshot, document.uri) : [],
      });
    };

    const changeSubscription = vscode.workspace.onDidChangeTextDocument((event) => {
      if (event.document.uri.toString() !== document.uri.toString()) return;
      void panel.webview.postMessage({
        type: "documentChanged",
        text: event.document.getText(),
        documentVersion: event.document.version,
      });
    });

    const messageSubscription = panel.webview.onDidReceiveMessage(
      async (message: WebviewToHost) => {
        if (message.type === "ready") {
          await sendInit();
          return;
        }

        if (message.type === "edit") {
          await this.applyEdit(document, message.content);
          return;
        }

        if (message.type === "expandValueSet") {
          try {
            const body = await nodeHttpClient.getJson<unknown>(message.url, {
              Accept: "application/fhir+json",
            });
            await panel.webview.postMessage({
              type: "terminologyExpansion",
              requestId: message.requestId,
              body,
            });
          } catch (error) {
            await panel.webview.postMessage({
              type: "terminologyExpansion",
              requestId: message.requestId,
              error: error instanceof Error ? error.message : String(error),
            });
          }
          return;
        }

        if (message.type === "error") {
          vscode.window.showErrorMessage(vscode.l10n.t("FHIR form editor: {0}", message.message));
        }
      }
    );

    // A newly imported package changes what the form can resolve.
    const indexSubscription = this.index.onDidChange(() => void sendInit());

    panel.onDidDispose(() => {
      changeSubscription.dispose();
      messageSubscription.dispose();
      indexSubscription.dispose();
    });
  }

  /**
   * Write the form's value back as minimal edits.
   *
   * One `WorkspaceEdit` per change set, so the whole change is a single undo
   * step even when it touches several properties.
   */
  private async applyEdit(
    document: vscode.TextDocument,
    content: Record<string, unknown>
  ): Promise<void> {
    const current = parseResource(document.getText());
    if (!current) {
      // The file does not parse; a structural edit would destroy whatever the
      // user is in the middle of typing in the text editor.
      vscode.window.showWarningMessage(
        vscode.l10n.t("The file is not valid JSON right now — the form change was not applied.")
      );
      return;
    }

    const changes = collectChanges(current, content);
    if (changes.length === 0) return;

    const before = document.getText();
    const next = applyChanges(before, changes, formattingFor(document));
    const replacement = narrowReplacement(before, next);
    if (!replacement) return;

    const edit = new vscode.WorkspaceEdit();
    edit.replace(
      document.uri,
      new vscode.Range(
        document.positionAt(replacement.start),
        document.positionAt(replacement.end)
      ),
      replacement.text
    );
    await vscode.workspace.applyEdit(edit);
  }
}

/**
 * Shown instead of the form for generated resources.
 *
 * Plain HTML with no script: there is nothing to interact with, and the point
 * is to send the user to the file that is actually the source.
 */
const escapeHtml = (value: string): string =>
  value.replace(/[&<>"']/g, (char) => `&#${char.charCodeAt(0)};`);

const generatedNotice = (uri: vscode.Uri): string => {
  const name = escapeHtml(uri.path.split("/").pop() ?? "");
  const code = (value: string) => `<code>${value}</code>`;
  return `<!DOCTYPE html>
<html lang="${escapeHtml(vscode.env.language)}">
  <head>
    <meta charset="UTF-8" />
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'" />
    <style>
      body { font-family: var(--vscode-font-family); color: var(--vscode-foreground);
             padding: 2rem; line-height: 1.6; }
      code { background: var(--vscode-textCodeBlock-background); padding: 0.1em 0.35em;
             border-radius: 3px; }
    </style>
  </head>
  <body>
    <h2>${vscode.l10n.t("{0} is generated", name)}</h2>
    <p>${vscode.l10n.t(
      "It sits under {0}, which Sushi rewrites on every build. Editing it here would lose the change on the next run.",
      code("fsh-generated/")
    )}</p>
    <p>${vscode.l10n.t("Edit the {0} source under {1} instead.", code(".fsh"), code("input/fsh/"))}</p>
    <p>${vscode.l10n.t("Validation, hover and go-to-definition still work on this file.")}</p>
  </body>
</html>`;
};
