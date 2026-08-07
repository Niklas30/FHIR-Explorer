import type { CodingOption } from "@fhir-explorer/core/fhir-editor/registry";
import { logger } from "@fhir-explorer/core/logger";
import type { HttpClient } from "@fhir-explorer/core/ports";

/**
 * Optional terminology server integration. When configured, ValueSets that
 * cannot be expanded from the locally imported packages are expanded via
 * the server's $expand operation. Everything stays best-effort: failures
 * degrade to free-text entry, never block the editor.
 */

export const TERMINOLOGY_SERVER_STORAGE_KEY = "fhir-explorer-terminology-server";

/** Upper bound for expansion size — larger sets are searched via free text. */
const EXPANSION_COUNT = 200;

/** Trim a user-entered server url down to its canonical form, or null. */
export const normalizeTerminologyServerUrl = (
  raw: string | null | undefined
): string | null => {
  if (!raw) return null;
  const trimmed = raw.trim().replace(/\/+$/, "");
  return trimmed.length > 0 ? trimmed : null;
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
  http: HttpClient,
  serverUrl: string,
  canonical: string
): Promise<CodingOption[]> => {
  const url = new URL(`${serverUrl}/ValueSet/$expand`);
  url.searchParams.set("url", canonical);
  url.searchParams.set("count", String(EXPANSION_COUNT));

  const body = await http.getJson<{
    expansion?: { contains?: ExpansionContains[] };
  }>(url.toString(), { Accept: "application/fhir+json" });

  return flattenContains(body.expansion?.contains ?? [], []);
};

/**
 * Expands a ValueSet through the configured terminology server. Results
 * (including failures, as empty lists) are cached per server + canonical so
 * re-renders never re-issue requests.
 */
export const expandValueSet = (
  http: HttpClient,
  serverUrl: string,
  canonical: string
): Promise<CodingOption[]> => {
  const cacheKey = `${serverUrl}|${canonical}`;
  const cached = expansionCache.get(cacheKey);
  if (cached) return cached;

  const request = fetchExpansion(http, serverUrl, canonical).catch((error) => {
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
