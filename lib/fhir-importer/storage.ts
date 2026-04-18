import { openDB, type IDBPDatabase } from "idb";
import type {
  ImportState,
  PackageRecord,
  ResourceIndexEntry,
  ResourcePayload,
} from "./types";

const DB_NAME = "fhir-importer";
const DB_VERSION = 1;
const STATE_KEY = "state";

type ImporterDb = IDBPDatabase<unknown>;

const openImporterDb = () => {
  if (typeof indexedDB === "undefined") {
    throw new Error("IndexedDB is not available in this environment.");
  }
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains("state")) {
        db.createObjectStore("state");
      }
      if (!db.objectStoreNames.contains("packages")) {
        db.createObjectStore("packages", { keyPath: "key" });
      }
      if (!db.objectStoreNames.contains("resourceIndex")) {
        db.createObjectStore("resourceIndex", { keyPath: "key" });
      }
      if (!db.objectStoreNames.contains("resourcePayloads")) {
        db.createObjectStore("resourcePayloads", { keyPath: "key" });
      }
    },
  });
};

export class ImporterStorage {
  private dbPromise: Promise<ImporterDb>;

  constructor() {
    this.dbPromise = openImporterDb();
  }

  async loadState(): Promise<ImportState> {
    const db = await this.dbPromise;
    const state = (await db.get("state", STATE_KEY)) as ImportState | undefined;
    return state ?? { versionSelections: {} };
  }

  async saveState(state: ImportState) {
    const db = await this.dbPromise;
    await db.put("state", state, STATE_KEY);
  }

  async listPackages(): Promise<PackageRecord[]> {
    const db = await this.dbPromise;
    return (await db.getAll("packages")) as PackageRecord[];
  }

  async getPackage(key: string): Promise<PackageRecord | undefined> {
    const db = await this.dbPromise;
    return (await db.get("packages", key)) as PackageRecord | undefined;
  }

  async deletePackages(keys: string[]) {
    if (keys.length === 0) return;
    const db = await this.dbPromise;
    const tx = db.transaction("packages", "readwrite");
    for (const key of keys) {
      await tx.store.delete(key);
    }
    await tx.done;
  }

  async putPackage(record: PackageRecord) {
    const db = await this.dbPromise;
    await db.put("packages", record);
  }

  async putResourceIndex(entries: ResourceIndexEntry[]) {
    const db = await this.dbPromise;
    const tx = db.transaction("resourceIndex", "readwrite");

    for (const entry of entries) {
      await tx.store.put(entry);
    }

    await tx.done;
  }

  async deleteResourceIndexByPackageKeys(packageKeys: string[]) {
    if (packageKeys.length === 0) return;
    const db = await this.dbPromise;
    const tx = db.transaction("resourceIndex", "readwrite");
    let cursor = await tx.store.openCursor();

    while (cursor) {
      const value = cursor.value as ResourceIndexEntry;
      if (packageKeys.includes(value.packageKey)) {
        await cursor.delete();
      }
      cursor = await cursor.continue();
    }

    await tx.done;
  }

  async putResourcePayloads(entries: ResourcePayload[]) {
    const db = await this.dbPromise;
    const tx = db.transaction("resourcePayloads", "readwrite");

    for (const entry of entries) {
      await tx.store.put(entry);
    }

    await tx.done;
  }

  async deleteResourcePayloadsByPackageKeys(packageKeys: string[]) {
    if (packageKeys.length === 0) return;
    const db = await this.dbPromise;
    const tx = db.transaction("resourcePayloads", "readwrite");
    let cursor = await tx.store.openCursor();

    while (cursor) {
      const value = cursor.value as ResourcePayload;
      if (packageKeys.includes(value.packageKey)) {
        await cursor.delete();
      }
      cursor = await cursor.continue();
    }

    await tx.done;
  }

  async getResourceIndexCount(): Promise<number> {
    const db = await this.dbPromise;
    return await db.count("resourceIndex");
  }
}
