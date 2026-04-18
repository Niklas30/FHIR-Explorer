import type { PackageManifest } from "./types";

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
  type: "health-compose-project";
  version: 1;
  targetKey?: string;
  exportedAt: string;
  packages: ComposePackageExport[];
  datasets: ComposeDatasetExport[];
};

export const isComposeProjectExport = (value: unknown): value is ComposeProjectExport => {
  if (!value || typeof value !== "object") return false;
  const candidate = value as ComposeProjectExport;
  return (
    candidate.type === "health-compose-project" &&
    candidate.version === 1 &&
    Array.isArray(candidate.packages)
  );
};

export type ComposeProjectArchiveManifest = {
  type: "health-compose-project-archive";
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
  const candidate = value as ComposeProjectArchiveManifest;
  return (
    candidate.type === "health-compose-project-archive" &&
    candidate.version === 1 &&
    Array.isArray(candidate.packages)
  );
};
