import {
  TERMINOLOGY_SERVER_STORAGE_KEY,
  normalizeTerminologyServerUrl,
} from "@fhir-explorer/core/fhir-editor/terminology";

const listeners = new Set<() => void>();

export const getTerminologyServerUrl = (): string | null => {
  if (typeof window === "undefined") return null;
  return normalizeTerminologyServerUrl(
    window.localStorage.getItem(TERMINOLOGY_SERVER_STORAGE_KEY)
  );
};

export const setTerminologyServerUrl = (url: string | null) => {
  if (typeof window === "undefined") return;
  const trimmed = url?.trim() ?? "";
  if (trimmed.length === 0) {
    window.localStorage.removeItem(TERMINOLOGY_SERVER_STORAGE_KEY);
  } else {
    window.localStorage.setItem(TERMINOLOGY_SERVER_STORAGE_KEY, trimmed);
  }
  for (const listener of listeners) listener();
};

/**
 * Notifies when the setting changes, so a React tree holding the value can
 * re-render. Covers this tab (the settings dialog writes through the setter
 * above) and other tabs (the `storage` event).
 */
export const subscribeTerminologyServerUrl = (listener: () => void): (() => void) => {
  listeners.add(listener);

  const onStorage = (event: StorageEvent) => {
    if (event.key === null || event.key === TERMINOLOGY_SERVER_STORAGE_KEY) listener();
  };
  if (typeof window !== "undefined") {
    window.addEventListener("storage", onStorage);
  }

  return () => {
    listeners.delete(listener);
    if (typeof window !== "undefined") {
      window.removeEventListener("storage", onStorage);
    }
  };
};
