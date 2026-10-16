import { buildPackageKey } from "@fhir-explorer/core/fhir-importer/utils";
import type { PackageManifest } from "@fhir-explorer/core/fhir-importer/types";
import type { AuthoredProjectRecord } from "@fhir-explorer/core/projects/types";

export const PROJECTS_STORAGE_KEY = "fhir-explorer-projects";

export const sortProjectsByNewest = (
  a: AuthoredProjectRecord,
  b: AuthoredProjectRecord
) => b.updatedAt - a.updatedAt;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value && typeof value === "object" && !Array.isArray(value));

export const isProjectRecord = (entry: unknown): entry is AuthoredProjectRecord =>
  isRecord(entry) &&
  typeof entry.key === "string" &&
  typeof entry.id === "string" &&
  typeof entry.version === "string" &&
  isRecord(entry.manifest) &&
  typeof entry.createdAt === "number" &&
  typeof entry.updatedAt === "number";

/**
 * Build the deterministic `id@version` key used everywhere as the project /
 * package identifier. Reuses the importer's key helper so authored projects and
 * imported packages share the same key space.
 */
export const buildProjectKey = buildPackageKey;

/**
 * Pure factory for a fresh project record. Kept side-effect free (the caller
 * persists it) so it is unit-testable in a node env.
 */
export const createProjectRecord = (
  manifest: PackageManifest,
  now: number
): AuthoredProjectRecord => {
  const key = buildProjectKey(manifest.name, manifest.version);
  return {
    key,
    id: manifest.name,
    version: manifest.version,
    manifest,
    createdAt: now,
    updatedAt: now,
  };
};
