"use client";

import { useEffect, useMemo, useState } from "react";
import type { DatasetRecord } from "@/lib/datasets/storage";
import type { DatasetResource } from "@/lib/datasets/content";
import { buildRegistry, getStructureDefinitionByCanonical } from "@/lib/fhir-editor/registry";
import {
  buildFieldDefinitions,
  getProfileSummaries,
  resolveProfileForResource,
  type ProfileSummary,
} from "@/lib/fhir-editor/profiles";
import { collectDependencies, type DependencyGraph } from "@/lib/fhir-importer/dependency-graph";
import type { PackageRecord, ResourcePayload } from "@/lib/fhir-importer/types";

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
    if (!dataset || packages.length === 0) return;
    setRegistryLoaded(false);
    setInitializationError(null);
    const dependencyKeys = collectDependencies(dataset.projectKey, graph);
    const projectKeys = new Set<string>([dataset.projectKey, ...dependencyKeys]);

    let active = true;
    getResourcePayloadsByPackageKeys(Array.from(projectKeys))
      .then((payloads) => {
        if (!active) return;
        const nextRegistry = buildRegistry(payloads);
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
    if (!dataset) {
      setRegistryLoaded(true);
      return;
    }
    if (packages.length === 0) {
      setRegistryLoaded(true);
    }
  }, [datasetLoaded, dataset, packages.length]);

  const profile =
    selectedResource && registryState ? resolveProfileForResource(selectedResource.content, registryState) : null;

  const fields = useMemo(() => {
    if (!profile || !registryState) return [];
    return buildFieldDefinitions(profile, registryState);
  }, [profile, registryState]);

  const resolveStructureDefinition = (canonicalUrl: string) => {
    if (!registryState) return null;
    return getStructureDefinitionByCanonical(registryState, canonicalUrl);
  };

  return {
    registryLoaded,
    initializationError,
    registryState,
    profiles,
    fields,
    profile,
    resolveStructureDefinition,
  };
};

