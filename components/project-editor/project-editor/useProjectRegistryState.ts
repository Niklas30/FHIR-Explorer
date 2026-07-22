"use client";

import { useEffect, useMemo, useState } from "react";
import { buildRegistry, getStructureDefinitionByCanonical } from "@/lib/fhir-editor/registry";
import {
  getProfileSummaries,
  resolveProfileForResource,
  type ProfileSummary,
} from "@/lib/fhir-editor/profiles";
import { buildSchemaTree, createSchemaContext } from "@/lib/fhir-editor/schema";
import { buildPackageKey } from "@/lib/fhir-importer/utils";
import { collectDependencies, type DependencyGraph } from "@/lib/fhir-importer/dependency-graph";
import type {
  PackageRecord,
  ResourcePayload,
} from "@/lib/fhir-importer/types";
import type { AuthoredProjectRecord, AuthoredResource } from "@/lib/projects/types";

const toPayloads = (
  project: AuthoredProjectRecord,
  resources: AuthoredResource[]
): ResourcePayload[] =>
  resources.map((resource) => {
    const content = resource.content as Record<string, unknown>;
    return {
      key: `${project.key}:${resource.id}`,
      packageKey: project.key,
      resourceType: resource.resourceType,
      id: typeof content.id === "string" ? content.id : undefined,
      url: typeof content.url === "string" ? content.url : undefined,
      content: resource.content,
    };
  });

/**
 * Resolve the imported package keys the project's manifest dependencies point
 * at, expanded across the importer dependency graph.
 */
const resolveDependencyKeys = (
  project: AuthoredProjectRecord,
  packages: PackageRecord[],
  graph: DependencyGraph
): string[] => {
  const dependencies = project.manifest.dependencies ?? {};
  const available = new Set(packages.map((pkg) => pkg.key));
  const keys = new Set<string>();
  for (const [id, version] of Object.entries(dependencies)) {
    const directKey = buildPackageKey(id, version);
    const rootKey = available.has(directKey)
      ? directKey
      : packages.find((pkg) => pkg.id === id)?.key;
    if (!rootKey) continue;
    keys.add(rootKey);
    for (const depKey of collectDependencies(rootKey, graph)) {
      keys.add(depKey);
    }
  }
  return Array.from(keys);
};

export const useProjectRegistryState = ({
  project,
  resources,
  selectedResource,
  packages,
  graph,
  getResourcePayloadsByPackageKeys,
}: {
  project: AuthoredProjectRecord | null;
  resources: AuthoredResource[];
  selectedResource: AuthoredResource | null;
  packages: PackageRecord[];
  graph: DependencyGraph;
  getResourcePayloadsByPackageKeys: (keys: string[]) => Promise<ResourcePayload[]>;
}) => {
  const [registryLoaded, setRegistryLoaded] = useState(false);
  const [initializationError, setInitializationError] = useState<Error | null>(null);
  const [dependencyPayloads, setDependencyPayloads] = useState<ResourcePayload[]>([]);
  const [profiles, setProfiles] = useState<ProfileSummary[]>([]);

  const dependencyKeys = useMemo(
    () => (project ? resolveDependencyKeys(project, packages, graph) : []),
    [project, packages, graph]
  );

  // Fetch imported dependency payloads. Recomputed only when the resolved keys
  // change (join keeps the dep array a stable primitive for the effect).
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
    const authoredPayloads = toPayloads(project, resources);
    return buildRegistry([...dependencyPayloads, ...authoredPayloads]);
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
