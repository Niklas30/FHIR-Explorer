"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  createProjectRecord,
  loadProjects,
  upsertProject,
} from "@/lib/projects/storage";
import { loadProjectResources, saveProjectResources } from "@/lib/projects/content";
import { duplicateProject } from "@/components/project-editor/project-editor/duplicateProject";
import type { AuthoredProjectRecord, AuthoredResource } from "@/lib/projects/types";
import type { PackageManifest } from "@/lib/fhir-importer/types";

type DuplicateSource = { manifest: PackageManifest; resources: AuthoredResource[] };

/**
 * Owns the authored-project side of the overview: the record list, the "new
 * project" and "duplicate" dialog state, and the create/duplicate flows
 * (persist + navigate into the editor). Keeps the overview page lean.
 */
export const useAuthoredProjects = (duplicatedMessage: string) => {
  const router = useRouter();
  const [projects, setProjects] = useState<AuthoredProjectRecord[]>([]);
  const [newProjectOpen, setNewProjectOpen] = useState(false);
  const [duplicateSource, setDuplicateSource] = useState<DuplicateSource | null>(null);

  useEffect(() => {
    setProjects(loadProjects());
  }, []);

  const refresh = () => setProjects(loadProjects());
  const keys = useMemo(() => new Set(projects.map((project) => project.key)), [projects]);

  const createFromManifest = (manifest: PackageManifest) => {
    const record = createProjectRecord(manifest, Date.now());
    upsertProject(record);
    void saveProjectResources(record.key, []);
    setNewProjectOpen(false);
    refresh();
    router.push(`/project/${encodeURIComponent(record.key)}`);
  };

  const openDuplicate = async (key: string) => {
    const source = loadProjects().find((project) => project.key === key);
    if (!source) return;
    const resources = await loadProjectResources(key);
    setDuplicateSource({ manifest: source.manifest, resources });
  };

  const confirmDuplicate = async (manifest: PackageManifest) => {
    if (!duplicateSource) return;
    const key = await duplicateProject({ manifest, sourceResources: duplicateSource.resources });
    setDuplicateSource(null);
    refresh();
    toast.success(duplicatedMessage);
    router.push(`/project/${encodeURIComponent(key)}`);
  };

  return {
    projects,
    keys,
    refresh,
    newProjectOpen,
    setNewProjectOpen,
    duplicateSource,
    setDuplicateSource,
    createFromManifest,
    openDuplicate,
    confirmDuplicate,
  };
};
