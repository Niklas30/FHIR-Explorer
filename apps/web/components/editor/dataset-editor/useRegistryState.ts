"use client";

import { useEffect, useMemo, useState } from "react";
import type { DatasetRecord } from "@/lib/datasets/storage";
import type { DatasetResource } from "@/lib/datasets/content";
import { buildRegistry, getStructureDefinitionByCanonical } from "@/lib/fhir-editor/registry";
import {
  getProfileSummaries,
  resolveProfileForResource,
  type ProfileSummary,
} from "@/lib/fhir-editor/profiles";
import { buildSchemaTree, createSchemaContext } from "@/lib/fhir-editor/schema";
import { type DependencyGraph } from "@/lib/fhir-importer/dependency-graph";
import type { PackageRecord, ResourcePayload } from "@/lib/fhir-importer/types";
import { getProject } from "@/lib/projects/storage";
import { loadProjectResources } from "@/lib/projects/content";
import type { AuthoredResource } from "@/lib/projects/types";
import { resolveProjectPackageKeys, toPayloads } from "@/lib/projects/registry-resolution";

export const useDatasetEditorRegistryState = ({
  dataset,
  datasetLoaded,
  packages,
  graph,
  selectedResource,
  getResourcePayloadsByPackageKeys,
  errorLoadingResourcesMessage,
}: {
  dataset: DatasetRecord | null;
  datasetLoaded: boolean;
  packages: PackageRecord[];
  graph: DependencyGraph;
  selectedResource: DatasetResource | null;
  getResourcePayloadsByPackageKeys: (keys: string[]) => Promise<ResourcePayload[]>;
  errorLoadingResourcesMessage: string;
}) => {
  const [registryLoaded, setRegistryLoaded] = useState(false);
  const [initializationError, setInitializationError] = useState<Error | null>(null);
  const [profiles, setProfiles] = useState<ProfileSummary[]>([]);
  const [registryState, setRegistryState] = useState<ReturnType<typeof buildRegistry> | null>(null);

  useEffect(() => {
    if (!dataset) return;
    // The project may be an authored project (own resources + declared
    // dependencies) or an imported package (its dependency closure).
    const authored = getProject(dataset.projectKey) ?? null;
    if (!authored && packages.length === 0) {
      setRegistryLoaded(true);
      return;
    }
    setRegistryLoaded(false);
    setInitializationError(null);
    const keys = resolveProjectPackageKeys({ authored, projectKey: dataset.projectKey, graph });

    let active = true;
    Promise.all([
      getResourcePayloadsByPackageKeys(keys),
      authored
        ? loadProjectResources(dataset.projectKey)
        : Promise.resolve<AuthoredResource[]>([]),
    ])
      .then(([dependencyPayloads, authoredResources]) => {
        if (!active) return;
        const nextRegistry = buildRegistry([
          ...dependencyPayloads,
          ...toPayloads(dataset.projectKey, authoredResources),
        ]);
        setRegistryState(nextRegistry);
        setProfiles(getProfileSummaries(nextRegistry));
        setRegistryLoaded(true);
      })
      .catch((error) => {
        if (!active) return;
        const normalizedError =
          error instanceof Error ? error : new Error(errorLoadingResourcesMessage);
        setRegistryState(null);
        setProfiles([]);
        setInitializationError(normalizedError);
        setRegistryLoaded(true);
      });

    return () => {
      active = false;
    };
  }, [dataset, packages.length, graph, getResourcePayloadsByPackageKeys, errorLoadingResourcesMessage]);

  useEffect(() => {
    if (!datasetLoaded) return;
    if (!dataset) setRegistryLoaded(true);
  }, [datasetLoaded, dataset]);

  const profile =
    selectedResource && registryState
      ? resolveProfileForResource(selectedResource.content, registryState)
      : null;

  // The schema context caches generated snapshots and datatype trees across
  // all profiles of the loaded registry.
  const schemaCtx = useMemo(
    () => (registryState ? createSchemaContext(registryState) : null),
    [registryState]
  );

  const schemaTree = useMemo(() => {
    if (!profile || !schemaCtx) return null;
    return buildSchemaTree(profile, schemaCtx);
  }, [profile, schemaCtx]);

  const resolveStructureDefinition = (canonicalUrl: string) => {
    if (!registryState) return null;
    return getStructureDefinitionByCanonical(registryState, canonicalUrl) ?? null;
  };

  return {
    registryLoaded,
    initializationError,
    registryState,
    profiles,
    schemaCtx,
    schemaTree,
    profile,
    resolveStructureDefinition,
  };
};
