"use client";

import { createProjectRecord, upsertProject } from "@/lib/projects/storage";
import { cloneAuthoredResources, saveProjectResources } from "@/lib/projects/content";
import type { AuthoredResource } from "@/lib/projects/types";
import type { PackageManifest } from "@/lib/fhir-importer/types";

/**
 * Create a new editable authored project from a source manifest + resources.
 * Used both for duplicating an authored project and for forking an imported
 * (read-only) package into an editable copy. Returns the new project key.
 */
export const duplicateProject = async ({
  manifest,
  sourceResources,
}: {
  manifest: PackageManifest;
  sourceResources: AuthoredResource[];
}): Promise<string> => {
  const now = Date.now();
  const record = createProjectRecord(manifest, now);
  const resources = cloneAuthoredResources(sourceResources, now);
  upsertProject(record);
  await saveProjectResources(record.key, resources);
  return record.key;
};
