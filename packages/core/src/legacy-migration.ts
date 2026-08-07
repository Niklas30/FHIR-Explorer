import { logger } from "@/lib/logger";

/**
 * Backward-compatibility shim for the project rename (health-compose ->
 * fhir-explorer). Persisted identifiers changed with the rename; this module
 * carries data written by older builds forward so existing users keep their
 * projects, datasets and settings, and can still load legacy export files.
 *
 * The localStorage part is a one-time key rename. IndexedDB migration lives in
 * `lib/projects/content.ts` (it needs the project database handle).
 */

const LEGACY_PREFIX = "health-compose-";
const CURRENT_PREFIX = "fhir-explorer-";

/**
 * Copy every `health-compose-*` entry to its `fhir-explorer-*` counterpart
 * (never overwriting a value the current build already wrote) and drop the
 * legacy key. Operates on any Storage-like object so it is unit-testable
 * without a browser. Returns the number of values actually carried over.
 */
export const migrateLegacyStorageKeys = (storage: Storage): number => {
  // Snapshot keys first: mutating the store while iterating shifts indices.
  const legacyKeys: string[] = [];
  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index);
    if (key && key.startsWith(LEGACY_PREFIX)) legacyKeys.push(key);
  }

  let migrated = 0;
  for (const legacyKey of legacyKeys) {
    const currentKey = CURRENT_PREFIX + legacyKey.slice(LEGACY_PREFIX.length);
    const legacyValue = storage.getItem(legacyKey);
    if (legacyValue !== null && storage.getItem(currentKey) === null) {
      storage.setItem(currentKey, legacyValue);
      migrated += 1;
    }
    storage.removeItem(legacyKey);
  }
  return migrated;
};

/** Run the localStorage key migration once, guarded for non-browser envs. */
export const migrateLegacyLocalStorage = (): void => {
  if (typeof window === "undefined") return;
  try {
    migrateLegacyStorageKeys(window.localStorage);
  } catch (error) {
    logger.error("Failed to migrate legacy localStorage keys", { error });
  }
};
