"use client";

import { useEffect, useMemo, useState } from "react";
import { buildRegistry, getStructureDefinitionByCanonical } from "@/lib/fhir-editor/registry";
import {
  getProfileSummaries,
  resolveProfileForResource,
  type ProfileSummary,
} from "@/lib/fhir-editor/profiles";
import { buildSchemaTree, createSchemaContext } from "@/lib/fhir-editor/schema";
import type { DependencyGraph } from "@/lib/fhir-importer/dependency-graph";
import type { ResourcePayload } from "@/lib/fhir-importer/types";
import type { AuthoredProjectRecord, AuthoredResource } from "@/lib/projects/types";
import {
  resolveProjectPackageKeys,
  toPayloads,
} from "@/lib/projects/registry-resolution";

export const useProjectRegistryState = ({
  project,
  resources,
  selectedResource,
  graph,
  getResourcePayloadsByPackageKeys,
}: {
  project: AuthoredProjectRecord | null;
  resources: AuthoredResource[];
  selectedResource: AuthoredResource | null;
  graph: DependencyGraph;
  getResourcePayloadsByPackageKeys: (keys: string[]) => Promise<ResourcePayload[]>;
}) => {
  const [registryLoaded, setRegistryLoaded] = useState(false);
  const [initializationError, setInitializationError] = useState<Error | null>(null);
  const [dependencyPayloads, setDependencyPayloads] = useState<ResourcePayload[]>([]);
  const [profiles, setProfiles] = useState<ProfileSummary[]>([]);

  const dependencyKeys = useMemo(
    () =>
      project
        ? resolveProjectPackageKeys({ authored: project, projectKey: project.key, graph })
        : [],
    [project, graph]
  );

  const dependencyKeysJoined = dependencyKeys.join("|");
  useEffect(() => {
    if (!project) return;
    setRegistryLoaded(false);
    setInitializationError(null);
    let active = true;
    getResourcePayloadsByPackageKeys(dependencyKeys)
      .then((payloads) => {
        if (!active) return;
        setDependencyPayloads(payloads);
        setRegistryLoaded(true);
      })
      .catch((error) => {
        if (!active) return;
        setDependencyPayloads([]);
        setInitializationError(error instanceof Error ? error : new Error(String(error)));
        setRegistryLoaded(true);
      });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project, dependencyKeysJoined, getResourcePayloadsByPackageKeys]);

  // The registry combines imported dependencies with the project's own authored
  // resources, so project-local profiles/value sets resolve and validate too.
  const registryState = useMemo(() => {
    if (!project) return null;
    return buildRegistry([...dependencyPayloads, ...toPayloads(project.key, resources)]);
  }, [project, resources, dependencyPayloads]);

  useEffect(() => {
    if (!registryState) {
      setProfiles([]);
      return;
    }
    setProfiles(getProfileSummaries(registryState));
  }, [registryState]);

  const schemaCtx = useMemo(
    () => (registryState ? createSchemaContext(registryState) : null),
    [registryState]
  );

  const profile = useMemo(
    () =>
      selectedResource && registryState
        ? resolveProfileForResource(selectedResource.content, registryState)
        : null,
    [selectedResource, registryState]
  );

  const schemaTree = useMemo(() => {
    if (!profile || !schemaCtx) return null;
    return buildSchemaTree(profile, schemaCtx);
  }, [profile, schemaCtx]);

  const resolveStructureDefinition = (canonicalUrl: string) =>
    registryState ? getStructureDefinitionByCanonical(registryState, canonicalUrl) ?? null : null;

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
