/**
 * Names of the files the webview bundle emits.
 *
 * Deliberately free of any `vscode` import so the build test can check them
 * against the real output. A mismatch here renders a webview unstyled or blank
 * with nothing in any log to explain it.
 */

/** Fixed in vite.config.ts. Both entries share one stylesheet. */
export const WEBVIEW_STYLESHEET = "styles.css";

/** Entry bundles, matching the Vite input keys. */
export const WEBVIEW_ENTRIES = ["main", "graph"] as const;

export type WebviewEntry = (typeof WEBVIEW_ENTRIES)[number];
