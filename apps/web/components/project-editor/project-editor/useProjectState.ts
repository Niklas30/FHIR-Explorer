"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getProject, upsertProject } from "@/lib/projects/storage";
import { loadProjectResources, saveProjectResources } from "@/lib/projects/content";
import type { AuthoredProjectRecord, AuthoredResource } from "@/lib/projects/types";
import type { PackageManifest } from "@/lib/fhir-importer/types";

export type ProjectNodeSelection =
  | { kind: "dashboard" }
  | { kind: "issues" }
  | { kind: "manifest" }
  | { kind: "dependencies" }
  | { kind: "resource"; resourceId: string };

const sortResources = (items: AuthoredResource[]) =>
  [...items].sort((a, b) => {
    const aSel = a.lastSelectedAt ?? 0;
    const bSel = b.lastSelectedAt ?? 0;
    if (aSel !== bSel) return bSel - aSel;
    return b.createdAt - a.createdAt;
  });

/**
 * Loads and persists an authored project (localStorage record + IndexedDB
 * resources). Selection lives in the workspace, not here. `project` is null
 * when no authored project matches the key (the caller then checks for an
 * imported package instead).
 */
export const useProjectState = (projectKey: string) => {
  const [project, setProject] = useState<AuthoredProjectRecord | null>(null);
  const [resources, setResources] = useState<AuthoredResource[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  useEffect(() => {
    let active = true;
    setLoaded(false);
    const record = getProject(projectKey) ?? null;
    setProject(record);
    if (!record) {
      setResources([]);
      setLoaded(true);
      return;
    }
    loadProjectResources(projectKey).then((loadedResources) => {
      if (!active) return;
      setResources(sortResources(loadedResources));
      setLoaded(true);
    });
    return () => {
      active = false;
    };
  }, [projectKey]);

  const resourcesRef = useRef(resources);
  useEffect(() => {
    resourcesRef.current = resources;
  }, [resources]);

  const persistResources = useCallback(
    (next: AuthoredResource[] | ((prev: AuthoredResource[]) => AuthoredResource[])) => {
      const resolved = typeof next === "function" ? next(resourcesRef.current) : next;
      const sorted = sortResources(resolved);
      resourcesRef.current = sorted;
      setResources(sorted);
      void saveProjectResources(projectKey, sorted);
      setSavedAt(Date.now());
    },
    [projectKey]
  );

  const updateManifest = useCallback((manifest: PackageManifest) => {
    setProject((prev) => {
      if (!prev) return prev;
      const next: AuthoredProjectRecord = { ...prev, manifest, updatedAt: Date.now() };
      upsertProject(next);
      return next;
    });
    setSavedAt(Date.now());
  }, []);

  const addResource = useCallback(
    (resource: AuthoredResource) => {
      persistResources((prev) => [resource, ...prev.filter((r) => r.id !== resource.id)]);
    },
    [persistResources]
  );

  const updateResource = useCallback(
    (resource: AuthoredResource) => {
      persistResources((prev) => [resource, ...prev.filter((r) => r.id !== resource.id)]);
    },
    [persistResources]
  );

  const removeResource = useCallback(
    (resourceId: string) => {
      persistResources((prev) => prev.filter((r) => r.id !== resourceId));
    },
    [persistResources]
  );

  return {
    project,
    resources,
    loaded,
    savedAt,
    updateManifest,
    addResource,
    updateResource,
    removeResource,
  };
};
