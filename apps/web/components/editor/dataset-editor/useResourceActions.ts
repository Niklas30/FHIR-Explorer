"use client";

import { toast } from "sonner";
import {
  createDatasetResourceId,
  removeDatasetResource,
  type DatasetResource,
} from "@/lib/datasets/content";
import type { StructureDefinition } from "@/lib/fhir-editor/registry";
import type { ReferenceCreationTarget } from "@/lib/fhir-editor/reference-targets";
import { formatTemplate } from "@/components/editor/resource-detail/utils";

const downloadJson = (filename: string, payload: unknown) => {
  if (typeof window === "undefined") return;
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
};

const cloneContent = (content: Record<string, unknown>) =>
  typeof structuredClone === "function"
    ? structuredClone(content)
    : (JSON.parse(JSON.stringify(content)) as Record<string, unknown>);

type PersistResources = (
  next: DatasetResource[] | ((previous: DatasetResource[]) => DatasetResource[])
) => void;

type UseResourceActionsArgs = {
  datasetId: string;
  persistResources: PersistResources;
  resolveStructureDefinition: (canonicalUrl: string) => StructureDefinition | null;
  text: { removeResourceConfirm: string; referenceTargetCreated: string };
  /** Called with the new dataset resource id when a resource was created or duplicated. */
  onResourceCreated: (resourceId: string) => void;
};

/** CRUD actions on dataset resources, shared by the editor panels. */
export const useDatasetResourceActions = ({
  datasetId,
  persistResources,
  resolveStructureDefinition,
  text,
  onResourceCreated,
}: UseResourceActionsArgs) => {
  const removeResource = (resourceId: string) => {
    const ok = window.confirm(text.removeResourceConfirm);
    if (!ok) return;
    persistResources(removeDatasetResource(datasetId, resourceId));
  };

  const exportResource = (resource: DatasetResource) => {
    const id =
      typeof resource.content.id === "string" && resource.content.id.trim()
        ? resource.content.id.trim()
        : resource.id;
    const safeId = id.replace(/[^a-zA-Z0-9-_]+/g, "-");
    downloadJson(`${resource.resourceType}-${safeId}.json`, resource.content);
  };

  const duplicateResource = (resource: DatasetResource) => {
    const now = Date.now();
    const content = cloneContent(resource.content);
    content.id = createDatasetResourceId();

    const duplicated: DatasetResource = {
      ...resource,
      id: createDatasetResourceId(),
      content,
      createdAt: now,
      updatedAt: now,
      lastSelectedAt: now,
    };

    persistResources((previous) => [duplicated, ...previous]);
    onResourceCreated(duplicated.id);
  };

  const createResource = (payload: { profileUrl: string; resourceId?: string }) => {
    const profileDefinition = resolveStructureDefinition(payload.profileUrl);
    if (!profileDefinition) return;
    const resourceType = profileDefinition.type ?? profileDefinition.id ?? "Resource";
    const now = Date.now();
    const content: Record<string, unknown> = { resourceType };
    if (profileDefinition.url) {
      content.meta = { profile: [profileDefinition.url] };
    }
    if (payload.resourceId) {
      content.id = payload.resourceId;
    }

    const nextResource: DatasetResource = {
      id: createDatasetResourceId(),
      resourceType,
      profile: profileDefinition.url,
      content,
      createdAt: now,
      updatedAt: now,
      lastSelectedAt: now,
    };

    persistResources((previous) => [nextResource, ...previous]);
    onResourceCreated(nextResource.id);
  };

  const createReferenceTarget = (target: ReferenceCreationTarget): string | null => {
    const now = Date.now();
    const contentId = createDatasetResourceId();
    const content: Record<string, unknown> = {
      resourceType: target.resourceType,
      id: contentId,
    };
    if (target.profileUrl) {
      content.meta = { profile: [target.profileUrl] };
    }

    const nextResource: DatasetResource = {
      id: createDatasetResourceId(),
      resourceType: target.resourceType,
      profile: target.profileUrl,
      content,
      createdAt: now,
      updatedAt: now,
    };

    // The new target stays in the background; the user keeps editing the
    // resource that references it and can navigate via the reference field.
    persistResources((previous) => [nextResource, ...previous]);
    const reference = `${target.resourceType}/${contentId}`;
    toast.success(formatTemplate(text.referenceTargetCreated, { reference }));
    return reference;
  };

  return {
    removeResource,
    exportResource,
    duplicateResource,
    createResource,
    createReferenceTarget,
  };
};
