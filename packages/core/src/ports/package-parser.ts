import type { ParsedPackage } from "@fhir-explorer/core/fhir-importer/types";

/**
 * Turns a package archive into its parsed form.
 *
 * Parsing a large IG blocks its thread for seconds, so the host decides where
 * it runs: the web app offloads it to a Web Worker, the VS Code extension will
 * run it in the extension host and keep the webview responsive.
 */
export type PackageParser = {
  parse: (
    buffer: ArrayBuffer,
    onProgress?: (progress: number) => void
  ) => Promise<ParsedPackage>;
};
