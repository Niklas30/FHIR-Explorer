import type {
  ImportState,
  PackageRecord,
  ResourceIndexEntry,
  ResourcePayload,
} from "@fhir-explorer/core/fhir-importer/types";

/**
 * Persistence for imported FHIR packages: the importer's own state, the
 * package records, the canonical-url index and the raw resource payloads.
 *
 * The web app backs this with IndexedDB. The VS Code extension will back it
 * with the extension's global storage plus the shared `~/.fhir/packages`
 * cache that the IG Publisher and Firely tooling already populate.
 */
export type PackageStore = {
  loadState: () => Promise<ImportState>;
  saveState: (state: ImportState) => Promise<void>;

  listPackages: () => Promise<PackageRecord[]>;
  getPackage: (key: string) => Promise<PackageRecord | undefined>;
  putPackage: (record: PackageRecord) => Promise<void>;
  deletePackage: (key: string) => Promise<void>;
  deletePackages: (keys: string[]) => Promise<void>;

  putResourceIndex: (entries: ResourceIndexEntry[]) => Promise<void>;
  deleteResourceIndexByPackageKeys: (packageKeys: string[]) => Promise<void>;
  getResourceIndexCount: () => Promise<number>;

  putResourcePayloads: (entries: ResourcePayload[]) => Promise<void>;
  deleteResourcePayloadsByPackageKeys: (packageKeys: string[]) => Promise<void>;
  listResourcePayloadsByPackageKeys: (
    packageKeys: string[]
  ) => Promise<ResourcePayload[]>;

  clearAll: () => Promise<void>;
};
