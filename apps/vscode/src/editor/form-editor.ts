import * as vscode from "vscode";
import { collectProfileClosure } from "@fhir-explorer/core/fhir-editor/closure";
import { resolveProfileForResource } from "@fhir-explorer/core/fhir-editor/profiles/resolve";
import { isLocale, type Locale } from "@fhir-explorer/core/i18n/types";
import { nodeHttpClient } from "@/adapters/node-http-client";
import type { FhirIndex } from "@/language/fhir-index";
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

const hostLocale = (): Locale => {
  const language = vscode.env.language.split("-")[0];
  return isLocale(language) ? language : "en";
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

const nonce = (): string => {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let value = "";
  for (const byte of crypto.getRandomValues(new Uint8Array(32))) {
    value += alphabet[byte % alphabet.length];
  }
  return value;
};

export class FormEditorProvider implements vscode.CustomTextEditorProvider {
  static readonly viewType = VIEW_TYPE;

  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly index: FhirIndex
  ) {}

  private html(webview: vscode.Webview): string {
    const asset = (...parts: string[]) =>
      webview.asWebviewUri(
        vscode.Uri.joinPath(this.context.extensionUri, "dist", "webview", ...parts)
      );
    const scriptNonce = nonce();

    // No remote origins at all: styles and scripts come from the bundle, and
    // the only network access the form needs goes through the host.
    const csp = [
      "default-src 'none'",
      `img-src ${webview.cspSource} data:`,
      `style-src ${webview.cspSource} 'unsafe-inline'`,
      `font-src ${webview.cspSource}`,
      // 'strict-dynamic' so the nonced entry module may pull in its own
      // chunks — the fhirpath engine used for invariants is loaded lazily.
      `script-src 'nonce-${scriptNonce}' 'strict-dynamic'`,
    ].join("; ");

    return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta http-equiv="Content-Security-Policy" content="${csp}" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <link rel="stylesheet" href="${asset("main.css")}" />
  </head>
  <body>
    <div id="root"></div>
    <script type="module" nonce="${scriptNonce}" src="${asset("main.js")}"></script>
  </body>
</html>`;
  }

  async resolveCustomTextEditor(
    document: vscode.TextDocument,
    panel: vscode.WebviewPanel
  ): Promise<void> {
    panel.webview.options = {
      enableScripts: true,
      localResourceRoots: [vscode.Uri.joinPath(this.context.extensionUri, "dist")],
    };
    panel.webview.html = this.html(panel.webview);

    const sendInit = async () => {
      const snapshot = await this.index.get();
      const content = parseResource(document.getText());
      const profile = content
        ? resolveProfileForResource(content, snapshot.registry)
        : null;

      // Only the closure of this one profile — the full registry would be
      // tens of megabytes across the message channel.
      const payloads = profile?.url
        ? collectProfileClosure(profile.url, snapshot.registry)
        : [];

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
          vscode.window.showErrorMessage(`FHIR form editor: ${message.message}`);
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
        "The file is not valid JSON right now — the form change was not applied."
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
