import { openDB, type IDBPDatabase } from "idb";
import { logger } from "@fhir-explorer/core/logger";
import type { ResourceStore } from "@fhir-explorer/core/ports";
import type { AuthoredResource } from "@fhir-explorer/core/projects/types";

const DB_NAME = "fhir-explorer-projects";
// Database written by pre-rename builds. Its resources are copied into DB_NAME
// once, on first open, so existing authored projects survive the rename.
const LEGACY_DB_NAME = "health-compose-projects";
const DB_VERSION = 1;
const STORE = "resources";

type IDBFactoryWithDatabases = IDBFactory & {
  databases?: () => Promise<{ name?: string }[]>;
};

/**
 * Whether the legacy project database is present. Uses `indexedDB.databases()`
 * where available; when the API is missing we return true and let the
 * store-presence check in {@link migrateLegacyProjectDb} decide (at worst this
 * creates an empty, harmless legacy database).
 */
const legacyDbExists = async (): Promise<boolean> => {
  const factory = indexedDB as IDBFactoryWithDatabases;
  if (typeof factory.databases !== "function") return true;
  try {
    const databases = await factory.databases();
    return databases.some((entry) => entry.name === LEGACY_DB_NAME);
  } catch {
    return true;
  }
};

/** Copy resources from the legacy database into the target when it is empty. */
const migrateLegacyProjectDb = async (
  target: IDBPDatabase<unknown>
): Promise<void> => {
  try {
    const existingKeys = await target.getAllKeys(STORE);
    if (existingKeys.length > 0) return; // already populated — nothing to carry over
    if (!(await legacyDbExists())) return;

    const legacy = await openDB(LEGACY_DB_NAME);
    try {
      if (!legacy.objectStoreNames.contains(STORE)) return;
      const keys = await legacy.getAllKeys(STORE);
      for (const key of keys) {
        const value = await legacy.get(STORE, key);
        if (value !== undefined) await target.put(STORE, value, key);
      }
    } finally {
      legacy.close();
    }
  } catch (error) {
    logger.error("Failed to migrate legacy project resources", { error });
  }
};

let legacyMigration: Promise<void> | null = null;

const openProjectDb = async (): Promise<IDBPDatabase<unknown>> => {
  if (typeof indexedDB === "undefined") {
    throw new Error("IndexedDB is not available in this environment.");
  }
  const db = await openDB(DB_NAME, DB_VERSION, {
    upgrade(database) {
      if (!database.objectStoreNames.contains(STORE)) {
        // One entry per project key, value is the AuthoredResource[] array.
        database.createObjectStore(STORE);
      }
    },
  });
  // Run the one-time legacy import before the first read/write completes.
  if (!legacyMigration) legacyMigration = migrateLegacyProjectDb(db);
  await legacyMigration;
  return db;
};

export const loadProjectResources = async (
  projectKey: string
): Promise<AuthoredResource[]> => {
  if (typeof indexedDB === "undefined") return [];
  try {
    const db = await openProjectDb();
    const value = (await db.get(STORE, projectKey)) as AuthoredResource[] | undefined;
    return Array.isArray(value) ? value : [];
  } catch (error) {
    logger.error("Failed to load project resources", { error, projectKey });
    return [];
  }
};

export const saveProjectResources = async (
  projectKey: string,
  resources: AuthoredResource[]
): Promise<void> => {
  if (typeof indexedDB === "undefined") return;
  try {
    const db = await openProjectDb();
    await db.put(STORE, resources, projectKey);
  } catch (error) {
    logger.error("Failed to save project resources", { error, projectKey });
  }
};

export const clearProjectResources = async (projectKey: string): Promise<void> => {
  if (typeof indexedDB === "undefined") return;
  try {
    const db = await openProjectDb();
    await db.delete(STORE, projectKey);
  } catch (error) {
    logger.error("Failed to clear project resources", { error, projectKey });
  }
};

/** IndexedDB-backed {@link ResourceStore} for authored project resources. */
export const idbProjectResourceStore: ResourceStore<AuthoredResource> = {
  load: loadProjectResources,
  save: saveProjectResources,
  clear: clearProjectResources,
};
