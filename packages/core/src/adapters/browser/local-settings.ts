import {
  TERMINOLOGY_SERVER_STORAGE_KEY,
  normalizeTerminologyServerUrl,
} from "@fhir-explorer/core/fhir-editor/terminology";

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
    return;
  }
  window.localStorage.setItem(TERMINOLOGY_SERVER_STORAGE_KEY, trimmed);
};
