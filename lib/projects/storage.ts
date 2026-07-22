import { logger } from "@/lib/logger";
import { buildPackageKey } from "@/lib/fhir-importer/utils";
import type { PackageManifest } from "@/lib/fhir-importer/types";
import type { AuthoredProjectRecord } from "@/lib/projects/types";

const STORAGE_KEY = "health-compose-projects";

const sortByNewest = (a: AuthoredProjectRecord, b: AuthoredProjectRecord) =>
  b.updatedAt - a.updatedAt;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value && typeof value === "object" && !Array.isArray(value));

const isProjectRecord = (entry: unknown): entry is AuthoredProjectRecord =>
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

export const loadProjects = (): AuthoredProjectRecord[] => {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isProjectRecord).sort(sortByNewest);
  } catch (error) {
    logger.error("Failed to load projects", { error });
    return [];
  }
};

export const saveProjects = (projects: AuthoredProjectRecord[]) => {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
  } catch (error) {
    logger.error("Failed to save projects", { error });
  }
};

export const getProject = (key: string): AuthoredProjectRecord | undefined =>
  loadProjects().find((entry) => entry.key === key);

export const upsertProject = (
  project: AuthoredProjectRecord
): AuthoredProjectRecord[] => {
  const existing = loadProjects().filter((entry) => entry.key !== project.key);
  const next = [project, ...existing].sort(sortByNewest);
  saveProjects(next);
  return next;
};

export const removeProject = (key: string): AuthoredProjectRecord[] => {
  const next = loadProjects()
    .filter((entry) => entry.key !== key)
    .sort(sortByNewest);
  saveProjects(next);
  return next;
};

export const clearProjects = () => {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    logger.error("Failed to clear projects", { error });
  }
};

/**
 * Pure factory for a fresh project record. Kept side-effect free (caller
 * persists via {@link upsertProject}) so it is unit-testable in a node env.
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
