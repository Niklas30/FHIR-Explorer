import { logger } from "@fhir-explorer/core/logger";
import {
  PROJECTS_STORAGE_KEY,
  isProjectRecord,
  sortProjectsByNewest,
} from "@fhir-explorer/core/projects/storage";
import type { AuthoredProjectRecord } from "@fhir-explorer/core/projects/types";

export const loadProjects = (): AuthoredProjectRecord[] => {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(PROJECTS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isProjectRecord).sort(sortProjectsByNewest);
  } catch (error) {
    logger.error("Failed to load projects", { error });
    return [];
  }
};

export const saveProjects = (projects: AuthoredProjectRecord[]) => {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(PROJECTS_STORAGE_KEY, JSON.stringify(projects));
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
  const next = [project, ...existing].sort(sortProjectsByNewest);
  saveProjects(next);
  return next;
};

export const removeProject = (key: string): AuthoredProjectRecord[] => {
  const next = loadProjects()
    .filter((entry) => entry.key !== key)
    .sort(sortProjectsByNewest);
  saveProjects(next);
  return next;
};

export const clearProjects = () => {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(PROJECTS_STORAGE_KEY);
  } catch (error) {
    logger.error("Failed to clear projects", { error });
  }
};
