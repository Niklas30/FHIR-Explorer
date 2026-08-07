import * as vscode from "vscode";
import {
  WEBVIEW_STYLESHEET,
  type WebviewEntry,
} from "@/webview/assets";

/**
 * The HTML shell every webview gets.
 *
 * Written here rather than shipped as a file because it has to carry a
 * per-load CSP nonce. The policy is deliberately strict: no origin is allowed
 * at all, so anything the page needs from the network has to go through the
 * extension host, where the user's proxy and certificate settings apply.
 */

const NONCE_ALPHABET =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

const nonce = (): string => {
  let value = "";
  for (const byte of crypto.getRandomValues(new Uint8Array(32))) {
    value += NONCE_ALPHABET[byte % NONCE_ALPHABET.length];
  }
  return value;
};

export const renderWebviewHtml = (
  webview: vscode.Webview,
  extensionUri: vscode.Uri,
  entry: WebviewEntry,
  title: string
): string => {
  const asset = (file: string) =>
    webview.asWebviewUri(
      vscode.Uri.joinPath(extensionUri, "dist", "webview", file)
    );
  const scriptNonce = nonce();

  const csp = [
    "default-src 'none'",
    `img-src ${webview.cspSource} data:`,
    `style-src ${webview.cspSource} 'unsafe-inline'`,
    `font-src ${webview.cspSource}`,
    // 'strict-dynamic' so the nonced entry module may pull in its own chunks;
    // the fhirpath engine and the shared React chunk are loaded that way.
    `script-src 'nonce-${scriptNonce}' 'strict-dynamic'`,
  ].join("; ");

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta http-equiv="Content-Security-Policy" content="${csp}" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${title}</title>
    <link rel="stylesheet" href="${asset(WEBVIEW_STYLESHEET)}" />
  </head>
  <body>
    <div id="root"></div>
    <script type="module" nonce="${scriptNonce}" src="${asset(`${entry}.js`)}"></script>
  </body>
</html>`;
};
