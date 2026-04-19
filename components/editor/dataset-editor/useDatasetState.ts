"use client";

import { useEffect, useMemo, useState } from "react";
import type { DatasetRecord } from "@/lib/datasets/storage";
import { loadDatasets } from "@/lib/datasets/storage";
import type { DatasetResource } from "@/lib/datasets/content";
import { loadDatasetResources, saveDatasetResources } from "@/lib/datasets/content";

type ResourceNavigationState = {
  history: string[];
  index: number;
};

const pruneResourceNavigation = (state: ResourceNavigationState, validIds: Set<string>): ResourceNavigationState => {
  const nextHistory = state.history.filter((id) => validIds.has(id));
  if (nextHistory.length === 0) {
    if (state.history.length === 0 && state.index === -1) return state;
    return { history: [], index: -1 };
  }

  const currentId = state.index >= 0 ? state.history[state.index] : null;
  let nextIndex = currentId ? nextHistory.indexOf(currentId) : -1;
  if (nextIndex < 0) {
    nextIndex = Math.min(state.index, nextHistory.length - 1);
  }
  if (nextIndex < 0) {
    nextIndex = 0;
  }

  if (nextHistory.length === state.history.length && nextIndex === state.index) {
    return state;
  }
  return { history: nextHistory, index: nextIndex };
};

const pushResourceNavigationEntry = (state: ResourceNavigationState, resourceId: string): ResourceNavigationState => {
  const currentId = state.index >= 0 ? state.history[state.index] : null;
  if (currentId === resourceId) return state;

  const boundedIndex = Math.min(state.index, state.history.length - 1);
  const base = boundedIndex >= 0 ? state.history.slice(0, boundedIndex + 1) : [];
  const nextHistory = [...base, resourceId];
  return { history: nextHistory, index: nextHistory.length - 1 };
};

const sortResources = (items: DatasetResource[]) => {
  return [...items].sort((a, b) => {
    const aSelected = a.lastSelectedAt ?? 0;
    const bSelected = b.lastSelectedAt ?? 0;
    if (aSelected !== bSelected) return bSelected - aSelected;
    return b.createdAt - a.createdAt;
  });
};

export const useDatasetEditorDatasetState = ({
  datasetId,
  title,
}: {
  datasetId: string;
  title: string;
}) => {
  const [dataset, setDataset] = useState<DatasetRecord | null>(null);
  const [datasets, setDatasets] = useState<DatasetRecord[]>([]);
  const [datasetLoaded, setDatasetLoaded] = useState(false);

  const [resources, setResources] = useState<DatasetResource[]>([]);
  const [selectedResourceId, setSelectedResourceId] = useState<string | null>(null);
  const [resourceNavigation, setResourceNavigation] = useState<ResourceNavigationState>({
    history: [],
    index: -1,
  });

  useEffect(() => {
    const records = loadDatasets();
    const match = records.find((entry) => entry.id === datasetId) ?? null;
    setDataset(match);
    setDatasets(records);
    const loaded = loadDatasetResources(datasetId);
    setResources(sortResources(loaded));
    setDatasetLoaded(true);
  }, [datasetId]);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const name = dataset?.name?.trim();
    document.title = name ? `${title} - ${name}` : title;
  }, [dataset?.name, title]);

  useEffect(() => {
    if (resources.length === 0) {
      setSelectedResourceId(null);
      setResourceNavigation({ history: [], index: -1 });
      return;
    }
    const validIds = new Set(resources.map((entry) => entry.id));
    setResourceNavigation((prev) => pruneResourceNavigation(prev, validIds));

    if (!selectedResourceId || !validIds.has(selectedResourceId)) {
      const fallbackId = resources[0].id;
      setSelectedResourceId(fallbackId);
      setResourceNavigation((prev) =>
        pushResourceNavigationEntry(pruneResourceNavigation(prev, validIds), fallbackId)
      );
    }
  }, [resources, selectedResourceId]);

  const selectedResource = useMemo(
    () => resources.find((entry) => entry.id === selectedResourceId) ?? null,
    [resources, selectedResourceId]
  );

  const persistResources = (nextResources: DatasetResource[]) => {
    const sorted = sortResources(nextResources);
    setResources(sorted);
    saveDatasetResources(datasetId, sorted);
  };

  const handleUpdateResource = (nextResource: DatasetResource) => {
    const nextResources = [nextResource, ...resources.filter((entry) => entry.id !== nextResource.id)];
    persistResources(nextResources);
  };

  const handleSelectResource = (resourceId: string, options?: { recordHistory?: boolean }) => {
    const target = resources.find((entry) => entry.id === resourceId);
    if (!target) return;

    const shouldRecordHistory = options?.recordHistory !== false;
    const now = Date.now();
    const nextResources = resources.map((entry) =>
      entry.id === resourceId ? { ...entry, lastSelectedAt: now } : entry
    );
    persistResources(nextResources);
    setSelectedResourceId(resourceId);
    if (shouldRecordHistory) {
      setResourceNavigation((prev) => pushResourceNavigationEntry(prev, resourceId));
    }
  };

  const canNavigateBack = resourceNavigation.index > 0;
  const canNavigateForward =
    resourceNavigation.index >= 0 && resourceNavigation.index < resourceNavigation.history.length - 1;

  const handleNavigateBack = () => {
    if (!canNavigateBack) return;
    const targetResourceId = resourceNavigation.history[resourceNavigation.index - 1];
    if (!targetResourceId) return;
    setResourceNavigation((prev) => ({ ...prev, index: prev.index - 1 }));
    handleSelectResource(targetResourceId, { recordHistory: false });
  };

  const handleNavigateForward = () => {
    if (!canNavigateForward) return;
    const targetResourceId = resourceNavigation.history[resourceNavigation.index + 1];
    if (!targetResourceId) return;
    setResourceNavigation((prev) => ({ ...prev, index: prev.index + 1 }));
    handleSelectResource(targetResourceId, { recordHistory: false });
  };

  return {
    dataset,
    setDataset,
    datasets,
    setDatasets,
    datasetLoaded,
    resources,
    setResources,
    selectedResourceId,
    setSelectedResourceId,
    selectedResource,
    resourceNavigation,
    setResourceNavigation,
    persistResources,
    handleUpdateResource,
    handleSelectResource,
    canNavigateBack,
    canNavigateForward,
    handleNavigateBack,
    handleNavigateForward,
  };
};

