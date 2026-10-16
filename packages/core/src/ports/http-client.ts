/**
 * Outbound HTTP used by the importer and the terminology integration.
 *
 * The web app satisfies this with `fetch`; the VS Code extension will satisfy
 * it from the extension host, where there is no CORS and the user's configured
 * proxy applies.
 */
export type HttpClient = {
  /** Download a binary body. Rejects on a non-2xx response. */
  getArrayBuffer: (url: string) => Promise<ArrayBuffer>;
  /** Download a JSON body. Rejects on a non-2xx response. */
  getJson: <T>(url: string, headers?: Record<string, string>) => Promise<T>;
};

/**
 * Carries the response status, so callers can tell "the server said no such
 * thing" from "the request never got there".
 *
 * Without the distinction a dropped connection looks exactly like a missing
 * package, and the user is told their dependency does not exist.
 */
export class HttpError extends Error {
  constructor(
    message: string,
    /** Undefined when the request failed before a response arrived. */
    readonly status?: number
  ) {
    super(message);
    this.name = "HttpError";
  }
}
