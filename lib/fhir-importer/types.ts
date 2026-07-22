export type PackageId = string;
export type PackageVersion = string;
export type PackageKey = string;

export type PackageRef = {
  id: PackageId;
  version: PackageVersion;
};

export type PackageManifest = {
  name: string;
  version: string;
  title?: string;
  description?: string;
  author?: string;
  fhirVersions?: string[];
  canonical?: string;
  url?: string;
  jurisdiction?: string;
  type?: string;
  license?: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
};

export type PackageRecord = {
  key: PackageKey;
  id: PackageId;
  version: PackageVersion;
  manifest: PackageManifest;
  addedAt: number;
  resourceCount: number;
  sessionId?: string;
};

export type ParsedResource = {
  resourceType: string;
  id?: string;
  url?: string;
  name?: string;
  title?: string;
  content: unknown;
  packageKey: PackageKey;
  sourcePath: string;
};

export type ParsedPackage = {
  id: PackageId;
  version: PackageVersion;
  packageKey: PackageKey;
  manifest: PackageManifest;
  resources: ParsedResource[];
  warnings: string[];
};

export type ResourceIndexEntry = {
  key: string;
  packageKey: PackageKey;
  resourceType: string;
  id?: string;
  url?: string;
  name?: string;
  title?: string;
  bindings?: Array<{ path: string; valueSet: string }>;
};

export type ResourcePayload = {
  key: string;
  packageKey: PackageKey;
  resourceType: string;
  id?: string;
  url?: string;
  content: unknown;
};

export type ImportState = {
  currentTarget?: PackageRef;
  versionSelections: Record<string, string>;
  sessionId?: string;
  importHistory?: Array<{
    targetKey: string;
    completedAt: number;
  }>;
};

export type DependencyRequirement = {
  id: PackageId;
  ranges: string[];
  exactVersion?: string;
  chosenVersion?: string;
  requestedBy: PackageKey[];
  status: "missing" | "resolved" | "conflict";
  conflictReason?: string;
};

export type DependencyState = {
  missing: DependencyRequirement[];
  resolved: DependencyRequirement[];
  conflicts: DependencyRequirement[];
};

export type ImportProgress = {
  phase:
    | "idle"
    | "reading"
    | "parsing"
    | "indexing"
    | "saving"
    | "completed";
  message?: string;
  percent?: number;
};

export type ImportResult = {
  status: "imported" | "duplicate";
  packageKey: PackageKey;
  warnings: string[];
};

export type ImporterSnapshot = {
  state: ImportState;
  packages: PackageRecord[];
  dependencyState: DependencyState;
  resourceIndexCount: number;
};
