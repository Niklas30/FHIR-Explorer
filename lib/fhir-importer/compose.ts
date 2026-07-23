import type { PackageManifest } from "./types";

/**
 * Discriminator strings for exported project files. The current build writes
 * the `fhir-explorer-*` variants; the `health-compose-*` variants are accepted
 * on import so files exported by pre-rename builds still load.
 */
export const PROJECT_EXPORT_TYPE = "fhir-explorer-project";
export const PROJECT_ARCHIVE_TYPE = "fhir-explorer-project-archive";
const LEGACY_PROJECT_EXPORT_TYPE = "health-compose-project";
const LEGACY_PROJECT_ARCHIVE_TYPE = "health-compose-project-archive";

export type ComposeResourceExport = {
  resourceType?: string;
  id?: string;
  url?: string;
  content: unknown;
};

export type ComposePackageExport = {
  key: string;
  id: string;
  version: string;
  manifest: PackageManifest;
  resources: ComposeResourceExport[];
};

export type ComposeDatasetExport = {
  id?: string;
  name: string;
  projectKey?: string;
  resources: unknown[];
};

export type ComposeProjectExport = {
  type: "fhir-explorer-project";
  version: 1;
  targetKey?: string;
  exportedAt: string;
  packages: ComposePackageExport[];
  datasets: ComposeDatasetExport[];
};

export const isComposeProjectExport = (value: unknown): value is ComposeProjectExport => {
  if (!value || typeof value !== "object") return false;
  const candidate = value as { type?: unknown; version?: unknown; packages?: unknown };
  return (
    (candidate.type === PROJECT_EXPORT_TYPE ||
      candidate.type === LEGACY_PROJECT_EXPORT_TYPE) &&
    candidate.version === 1 &&
    Array.isArray(candidate.packages)
  );
};

export type ComposeProjectArchiveManifest = {
  type: "fhir-explorer-project-archive";
  version: 1;
  targetKey?: string;
  exportedAt: string;
  packages: Array<{
    key: string;
    id: string;
    version: string;
    manifest: PackageManifest;
    file: string;
  }>;
  datasets?: Array<{
    id?: string;
    name: string;
    projectKey?: string;
    file: string;
  }>;
};

export const isComposeProjectArchive = (
  value: unknown
): value is ComposeProjectArchiveManifest => {
  if (!value || typeof value !== "object") return false;
  const candidate = value as { type?: unknown; version?: unknown; packages?: unknown };
  return (
    (candidate.type === PROJECT_ARCHIVE_TYPE ||
      candidate.type === LEGACY_PROJECT_ARCHIVE_TYPE) &&
    candidate.version === 1 &&
    Array.isArray(candidate.packages)
  );
};
