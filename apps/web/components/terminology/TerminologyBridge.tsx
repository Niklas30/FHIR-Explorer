"use client";

import { useMemo, useSyncExternalStore, type ReactNode } from "react";
import {
  fetchHttpClient,
  getTerminologyServerUrl,
  subscribeTerminologyServerUrl,
} from "@fhir-explorer/core/adapters/browser";
import { TerminologyProvider, type TerminologyContextValue } from "@fhir-explorer/ui";

/**
 * Feeds the browser's terminology settings into the shared components.
 *
 * The server url lives in localStorage and the settings dialog writes it, so
 * the value is subscribed rather than read once — otherwise a change would
 * only take effect after a reload.
 */
export const TerminologyBridge = ({ children }: { children: ReactNode }) => {
  const serverUrl = useSyncExternalStore(
    subscribeTerminologyServerUrl,
    getTerminologyServerUrl,
    () => null // no localStorage during server rendering
  );

  const value = useMemo<TerminologyContextValue>(
    () => ({ serverUrl, http: fetchHttpClient }),
    [serverUrl]
  );

  return <TerminologyProvider value={value}>{children}</TerminologyProvider>;
};
