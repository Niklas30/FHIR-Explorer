import { describe, expect, it } from "vitest";
import { migrateLegacyStorageKeys } from "@/lib/legacy-migration";
import {
  isComposeProjectArchive,
  isComposeProjectExport,
} from "@/lib/fhir-importer/compose";

/** Minimal in-memory Storage for exercising the migration without a browser. */
const createStorage = (initial: Record<string, string> = {}): Storage => {
  const map = new Map<string, string>(Object.entries(initial));
  return {
    get length() {
      return map.size;
    },
    key: (index: number) => Array.from(map.keys())[index] ?? null,
    getItem: (key: string) => (map.has(key) ? map.get(key)! : null),
    setItem: (key: string, value: string) => {
      map.set(key, value);
    },
    removeItem: (key: string) => {
      map.delete(key);
    },
    clear: () => map.clear(),
  } as Storage;
};

describe("migrateLegacyStorageKeys", () => {
  it("renames health-compose-* keys to fhir-explorer-* and drops the old key", () => {
    const storage = createStorage({
      "health-compose-projects": "[1]",
      "health-compose-locale": "de",
      unrelated: "keep",
    });

    const migrated = migrateLegacyStorageKeys(storage);

    expect(migrated).toBe(2);
    expect(storage.getItem("fhir-explorer-projects")).toBe("[1]");
    expect(storage.getItem("fhir-explorer-locale")).toBe("de");
    expect(storage.getItem("health-compose-projects")).toBeNull();
    expect(storage.getItem("health-compose-locale")).toBeNull();
    expect(storage.getItem("unrelated")).toBe("keep");
  });

  it("never overwrites an existing fhir-explorer-* value but still drops the legacy key", () => {
    const storage = createStorage({
      "health-compose-projects": "[legacy]",
      "fhir-explorer-projects": "[current]",
    });

    const migrated = migrateLegacyStorageKeys(storage);

    expect(migrated).toBe(0);
    expect(storage.getItem("fhir-explorer-projects")).toBe("[current]");
    expect(storage.getItem("health-compose-projects")).toBeNull();
  });

  it("is a no-op when there is nothing to migrate", () => {
    const storage = createStorage({ "fhir-explorer-datasets": "[]" });
    expect(migrateLegacyStorageKeys(storage)).toBe(0);
    expect(storage.getItem("fhir-explorer-datasets")).toBe("[]");
  });
});

describe("legacy export type acceptance", () => {
  const base = { version: 1 as const, exportedAt: "2026-01-01", packages: [] };

  it("accepts both current and legacy project export types", () => {
    expect(isComposeProjectExport({ ...base, type: "fhir-explorer-project" })).toBe(true);
    expect(isComposeProjectExport({ ...base, type: "health-compose-project" })).toBe(true);
    expect(isComposeProjectExport({ ...base, type: "something-else" })).toBe(false);
  });

  it("accepts both current and legacy project archive types", () => {
    expect(
      isComposeProjectArchive({ ...base, type: "fhir-explorer-project-archive" })
    ).toBe(true);
    expect(
      isComposeProjectArchive({ ...base, type: "health-compose-project-archive" })
    ).toBe(true);
    expect(isComposeProjectArchive({ ...base, type: "fhir-explorer-project" })).toBe(false);
  });
});
