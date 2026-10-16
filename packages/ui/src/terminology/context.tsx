"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { HttpClient } from "@fhir-explorer/core/ports";

/**
 * Access to an optional terminology server.
 *
 * The form used to read the server url straight out of localStorage and call
 * `fetch`. Neither exists on the terms the VS Code webview needs: the setting
 * lives in the extension's configuration, and requests are better made by the
 * extension host, where there is no CORS and the proxy applies. So the host
 * hands both in.
 */

export type TerminologyContextValue = {
  /** Configured server, or null when the feature is off. */
  serverUrl: string | null;
  http: HttpClient;
};

const TerminologyReactContext = createContext<TerminologyContextValue | null>(null);

export const TerminologyProvider = ({
  value,
  children,
}: {
  value: TerminologyContextValue;
  children: ReactNode;
}) => (
  <TerminologyReactContext.Provider value={value}>
    {children}
  </TerminologyReactContext.Provider>
);

/**
 * Null when no provider is mounted — terminology is optional everywhere, and
 * a missing server degrades to free-text entry rather than to an error.
 */
export const useTerminology = (): TerminologyContextValue | null =>
  useContext(TerminologyReactContext);
