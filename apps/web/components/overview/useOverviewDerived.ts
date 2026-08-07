"use client";

import { useMemo } from "react";
import type { ImporterSnapshot, PackageRecord } from "@/lib/fhir-importer/types";
import { buildDependencyGraph, type DependencyGraph } from "@/lib/fhir-importer/dependency-graph";
import {
  getCurrentTargetKey,
  isProjectSelectableForDatasets,
  isTargetImportInProgress,
} from "@/lib/fhir-importer/target-status";
import type { DatasetRecord } from "@/lib/datasets/storage";
import { matchesFilter } from "@/components/overview/utils";
import type { ProjectEntry } from "@/components/overview/types";

type ImportHistoryEntry = {
  targetKey: string;
};

const EMPTY_PACKAGES: PackageRecord[] = [];
const EMPTY_IMPORT_HISTORY: ImportHistoryEntry[] = [];

const collectResolvedDependencies = (rootKey: string, graph: DependencyGraph) => {
  const deps = new Set<string>();
  const stack = [rootKey];
  while (stack.length > 0) {
    const current = stack.pop();
    if (!current) continue;
    for (const edge of graph.adjacency.get(current) ?? []) {
      if (!edge.resolved) continue;
      if (deps.has(edge.toKey)) continue;
      deps.add(edge.toKey);
      stack.push(edge.toKey);
    }
  }
  return deps;
};

export const useOverviewDerived = ({
  snapshot,
  datasets,
  filter,
}: {
  snapshot: ImporterSnapshot | null;
  datasets: DatasetRecord[];
  filter: string;
}) => {
  const packages = snapshot?.packages ?? EMPTY_PACKAGES;
  const dependencyState = snapshot?.dependencyState;
  const importHistory = snapshot?.state.importHistory ?? EMPTY_IMPORT_HISTORY;
  const currentTarget = snapshot?.state.currentTarget;

  const targetStatus = useMemo(
    () => ({
      packages,
      state: { currentTarget },
      dependencyState,
    }),
    [packages, currentTarget, dependencyState]
  );

  const currentTargetKey = getCurrentTargetKey(targetStatus.state);
  const currentTargetImportInProgress = isTargetImportInProgress(targetStatus);

  const isProjectDatasetSelectable = (projectKey: string) =>
    isProjectSelectableForDatasets(projectKey, targetStatus);

  const graph = useMemo(() => buildDependencyGraph(packages), [packages]);

  const projectByKey = useMemo(() => {
    const map = new Map<string, PackageRecord>();
    for (const pkg of packages) {
      map.set(pkg.key, pkg);
    }
    return map;
  }, [packages]);

  const projectOptions = useMemo(() => {
    return [...packages].sort((a, b) => {
      const idCompare = a.id.localeCompare(b.id);
      if (idCompare !== 0) return idCompare;
      return a.version.localeCompare(b.version);
    });
  }, [packages]);

  const selectableProjectOptions = projectOptions.filter((project) =>
    isProjectDatasetSelectable(project.key)
  );

  const datasetInfoProjectSuggestions = useMemo(
    () =>
      projectOptions.map((entry) => ({
        key: entry.key,
        label: `${entry.id}@${entry.version}`,
      })),
    [projectOptions]
  );

  const normalizedFilter = filter.trim().toLowerCase();

  const targetKeys = useMemo(() => {
    const keys: string[] = [];
    const seen = new Set<string>();

    for (const entry of importHistory) {
      if (!seen.has(entry.targetKey)) {
        keys.push(entry.targetKey);
        seen.add(entry.targetKey);
      }
    }

    return keys;
  }, [importHistory]);

  const targets = useMemo<ProjectEntry[]>(
    () => targetKeys.map((key) => ({ key, record: graph.byKey.get(key) })),
    [targetKeys, graph]
  );

  const dependenciesByTarget = useMemo(() => {
    const map = new Map<string, Set<string>>();
    for (const target of targets) {
      if (!target.record) continue;
      map.set(target.key, collectResolvedDependencies(target.key, graph));
    }
    return map;
  }, [targets, graph]);

  const dependencyOwners = useMemo(() => {
    const map = new Map<string, Set<string>>();
    for (const [targetKey, deps] of dependenciesByTarget) {
      for (const depKey of deps) {
        if (!map.has(depKey)) map.set(depKey, new Set());
        map.get(depKey)!.add(targetKey);
      }
    }
    return map;
  }, [dependenciesByTarget]);

  const dependencyProjects = useMemo(() => {
    const projects: PackageRecord[] = [];
    for (const depKey of dependencyOwners.keys()) {
      const pkg = graph.byKey.get(depKey);
      if (pkg) projects.push(pkg);
    }
    return projects.sort((a, b) => {
      const idCompare = a.id.localeCompare(b.id);
      if (idCompare !== 0) return idCompare;
      return a.version.localeCompare(b.version);
    });
  }, [dependencyOwners, graph]);

  const datasetsByProject = useMemo(() => {
    const map = new Map<string, DatasetRecord[]>();
    for (const dataset of datasets) {
      const list = map.get(dataset.projectKey) ?? [];
      list.push(dataset);
      map.set(dataset.projectKey, list);
    }
    for (const list of map.values()) {
      list.sort((a, b) => b.createdAt - a.createdAt);
    }
    return map;
  }, [datasets]);

  const filteredTargets = targets.filter(
    (target) => target.record && matchesFilter(normalizedFilter, target.record, target.key)
  );

  const filteredDependencies = dependencyProjects.filter((project) =>
    matchesFilter(normalizedFilter, project, project.key)
  );

  const filteredDatasets = useMemo(() => {
    if (!normalizedFilter) return datasets;
    return datasets.filter((dataset) => {
      const project = projectByKey.get(dataset.projectKey);
      const haystack = [
        dataset.name,
        dataset.projectKey,
        project?.id,
        project?.manifest.title,
        project?.manifest.name,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(normalizedFilter);
    });
  }, [datasets, normalizedFilter, projectByKey]);

  const dependentsByProject = useMemo(() => {
    const map = new Map<string, Set<string>>();
    for (const [ownerKey, deps] of dependenciesByTarget) {
      for (const depKey of deps) {
        if (!map.has(depKey)) map.set(depKey, new Set());
        map.get(depKey)!.add(ownerKey);
      }
    }
    return map;
  }, [dependenciesByTarget]);

  const canDeleteProject = (projectKey: string) => {
    const dependents = dependentsByProject.get(projectKey);
    return !dependents || dependents.size === 0;
  };

  return {
    packages,
    graph,
    projectByKey,
    projectOptions,
    selectableProjectOptions,
    datasetInfoProjectSuggestions,
    currentTargetKey,
    currentTargetImportInProgress,
    isProjectDatasetSelectable,
    dependenciesByTarget,
    dependencyOwners,
    datasetsByProject,
    filteredTargets,
    filteredDependencies,
    filteredDatasets,
    canDeleteProject,
    dependentsByProject,
  };
};

