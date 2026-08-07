import type { HttpClient } from "@fhir-explorer/core/ports";

/**
 * {@link HttpClient} in the extension host.
 *
 * Unlike the web app this is not subject to CORS, which is the whole reason
 * the extension can download a package the browser build has to ask the user
 * to fetch by hand.
 *
 * No proxy handling here on purpose: VS Code's proxy resolver already routes
 * the host's `fetch` through the user's `http.proxy` and certificate settings,
 * so re-implementing it would only add a second, divergent code path.
 */

const failed = (url: string, status: number) =>
  new Error(`Request to ${url} failed with status ${status}`);

export const nodeHttpClient: HttpClient = {
  getArrayBuffer: async (url) => {
    const response = await fetch(url);
    if (!response.ok) throw failed(url, response.status);
    return await response.arrayBuffer();
  },
  getJson: async <T>(url: string, headers?: Record<string, string>) => {
    const response = await fetch(url, { headers });
    if (!response.ok) throw failed(url, response.status);
    return (await response.json()) as T;
  },
};
