/**
 * Outbound HTTP used by the package importer.
 *
 * The web app satisfies this with `fetch`; the VS Code extension will satisfy
 * it from the extension host, where there is no CORS and the user's configured
 * proxy applies.
 */
export type HttpClient = {
  /** Download a binary body. Rejects on a non-2xx response. */
  getArrayBuffer: (url: string) => Promise<ArrayBuffer>;
};
