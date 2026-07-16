import type { CodingOption } from "@/lib/fhir-editor/registry";
import { logger } from "@/lib/logger";

/**
 * Optional terminology server integration. When configured, ValueSets that
 * cannot be expanded from the locally imported packages are expanded via
 * the server's $expand operation. Everything stays best-effort: failures
 * degrade to free-text entry, never block the editor.
 */

const STORAGE_KEY = "fhir-explorer-terminology-server";

/** Upper bound for expansion size — larger sets are searched via free text. */
const EXPANSION_COUNT = 200;

export const getTerminologyServerUrl = (): string | null => {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  const trimmed = raw.trim().replace(/\/+$/, "");
  return trimmed.length > 0 ? trimmed : null;
};

export const setTerminologyServerUrl = (url: string | null) => {
  if (typeof window === "undefined") return;
  const trimmed = url?.trim() ?? "";
  if (trimmed.length === 0) {
    window.localStorage.removeItem(STORAGE_KEY);
    return;
  }
  window.localStorage.setItem(STORAGE_KEY, trimmed);
};

type ExpansionContains = {
  system?: string;
  code?: string;
  display?: string;
  contains?: ExpansionContains[];
};

const flattenContains = (entries: ExpansionContains[], target: CodingOption[]) => {
  for (const entry of entries) {
    if (entry.code) {
      target.push({ system: entry.system, code: entry.code, display: entry.display });
    }
    if (Array.isArray(entry.contains)) {
      flattenContains(entry.contains, target);
    }
  }
  return target;
};

const expansionCache = new Map<string, Promise<CodingOption[]>>();

const fetchExpansion = async (
  serverUrl: string,
  canonical: string
): Promise<CodingOption[]> => {
  const url = new URL(`${serverUrl}/ValueSet/$expand`);
  url.searchParams.set("url", canonical);
  url.searchParams.set("count", String(EXPANSION_COUNT));

  const response = await fetch(url.toString(), {
    headers: { Accept: "application/fhir+json" },
  });
  if (!response.ok) {
    throw new Error(`$expand failed with status ${response.status}`);
  }
  const body = (await response.json()) as {
    expansion?: { contains?: ExpansionContains[] };
  };
  return flattenContains(body.expansion?.contains ?? [], []);
};

/**
 * Expands a ValueSet through the configured terminology server. Results
 * (including failures, as empty lists) are cached per server + canonical so
 * re-renders never re-issue requests.
 */
export const expandValueSet = (
  serverUrl: string,
  canonical: string
): Promise<CodingOption[]> => {
  const cacheKey = `${serverUrl}|${canonical}`;
  const cached = expansionCache.get(cacheKey);
  if (cached) return cached;

  const request = fetchExpansion(serverUrl, canonical).catch((error) => {
    logger.error("Terminology server expansion failed", { error, canonical });
    return [] as CodingOption[];
  });
  expansionCache.set(cacheKey, request);
  return request;
};

/** Test-only: reset the module-level expansion cache. */
export const clearExpansionCacheForTests = () => {
  expansionCache.clear();
};
