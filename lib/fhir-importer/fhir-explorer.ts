import type { PackageManifest } from "./types";

const PROJECT_TYPES = ["fhir-explorer-project", "health-compose-project"] as const;
const ARCHIVE_TYPES = [
  "fhir-explorer-project-archive",
  "health-compose-project-archive",
] as const;

type FhirExplorerProjectType = (typeof PROJECT_TYPES)[number];
type FhirExplorerArchiveType = (typeof ARCHIVE_TYPES)[number];

export type FhirExplorerResourceExport = {
  resourceType?: string;
  id?: string;
  url?: string;
  content: unknown;
};

export type FhirExplorerPackageExport = {
  key: string;
  id: string;
  version: string;
  manifest: PackageManifest;
  resources: FhirExplorerResourceExport[];
};

export type FhirExplorerDatasetExport = {
  id?: string;
  name: string;
  projectKey?: string;
  resources: unknown[];
};

export type FhirExplorerProjectExport = {
  type: FhirExplorerProjectType;
  version: 1;
  targetKey?: string;
  exportedAt: string;
  packages: FhirExplorerPackageExport[];
  datasets: FhirExplorerDatasetExport[];
};

export const isFhirExplorerProjectExport = (value: unknown): value is FhirExplorerProjectExport => {
  if (!value || typeof value !== "object") return false;
  const candidate = value as FhirExplorerProjectExport;
  return (
    PROJECT_TYPES.includes(candidate.type) &&
    candidate.version === 1 &&
    Array.isArray(candidate.packages)
  );
};

export type FhirExplorerProjectArchiveManifest = {
  type: FhirExplorerArchiveType;
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

export const isFhirExplorerProjectArchive = (
  value: unknown
): value is FhirExplorerProjectArchiveManifest => {
  if (!value || typeof value !== "object") return false;
  const candidate = value as FhirExplorerProjectArchiveManifest;
  return (
    ARCHIVE_TYPES.includes(candidate.type) &&
    candidate.version === 1 &&
    Array.isArray(candidate.packages)
  );
};
