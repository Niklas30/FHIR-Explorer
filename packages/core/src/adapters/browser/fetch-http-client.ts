import type { HttpClient } from "@fhir-explorer/core/ports";

/**
 * {@link HttpClient} on the platform `fetch`. Subject to CORS — the extension
 * host is not, which is why this is an adapter and not the port itself.
 */
export const fetchHttpClient: HttpClient = {
  getArrayBuffer: async (url) => {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Request failed with status ${response.status}`);
    }
    return await response.arrayBuffer();
  },
  getJson: async <T>(url: string, headers?: Record<string, string>) => {
    const response = await fetch(url, { headers });
    if (!response.ok) {
      throw new Error(`Request failed with status ${response.status}`);
    }
    return (await response.json()) as T;
  },
};
