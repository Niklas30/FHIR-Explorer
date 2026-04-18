"use client";

import { useEffect, useState } from "react";
import { useImporter } from "@/components/importer/useImporter";
import { EditorHeader } from "@/components/editor/EditorHeader";
import { NewResourceDialog } from "@/components/editor/NewResourceDialog";
import { ResourceDetailPanel } from "@/components/editor/ResourceDetailPanel";
import { ResourceJsonPanel } from "@/components/editor/ResourceJsonPanel";
import { ResourceListPanel } from "@/components/editor/ResourceListPanel";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { DatasetRecord } from "@/lib/datasets/storage";
import { loadDatasets } from "@/lib/datasets/storage";
import {
  createDatasetResourceId,
  loadDatasetResources,
  removeDatasetResource,
  saveDatasetResources,
  type DatasetResource,
} from "@/lib/datasets/content";
import { buildRegistry, getStructureDefinitionByCanonical } from "@/lib/fhir-editor/registry";
import {
  buildFieldDefinitions,
  getProfileSummaries,
  resolveProfileForResource,
  type ProfileSummary,
} from "@/lib/fhir-editor/profiles";
import type { PackageRecord } from "@/lib/fhir-importer/types";
import { buildPackageKey, isExactVersion } from "@/lib/fhir-importer/utils";

type DatasetEditorProps = {
  datasetId: string;
};

type DependencyGraph = {
  byKey: Map<string, PackageRecord>;
  adjacency: Map<string, string[]>;
};

const buildDependencyGraph = (packages: PackageRecord[]): DependencyGraph => {
  const byKey = new Map<string, PackageRecord>();
  const byId = new Map<string, PackageRecord[]>();

  for (const pkg of packages) {
    byKey.set(pkg.key, pkg);
    const list = byId.get(pkg.id) ?? [];
    list.push(pkg);
    byId.set(pkg.id, list);
  }

  const adjacency = new Map<string, string[]>();

  for (const pkg of packages) {
    const deps = pkg.manifest.dependencies ?? {};
    const edges: string[] = [];

    for (const [depId, spec] of Object.entries(deps)) {
      const normalized = spec.trim();
      if (!normalized) continue;

      if (isExactVersion(normalized)) {
        const depKey = buildPackageKey(depId, normalized);
        if (byKey.has(depKey)) {
          edges.push(depKey);
        }
      } else {
        const candidates = byId.get(depId) ?? [];
        for (const candidate of candidates) {
          edges.push(candidate.key);
        }
      }
    }

    adjacency.set(pkg.key, edges);
  }

  return { byKey, adjacency };
};

const collectDependencies = (targetKey: string, graph: DependencyGraph): Set<string> => {
  const { adjacency } = graph;
  const visited = new Set<string>();
  const dependencies = new Set<string>();
  const queue = [targetKey];

  while (queue.length > 0) {
    const key = queue.shift();
    if (!key || visited.has(key)) continue;
    visited.add(key);

    const edges = adjacency.get(key) ?? [];
    for (const depKey of edges) {
      if (!visited.has(depKey)) {
        dependencies.add(depKey);
        queue.push(depKey);
      }
    }
  }

  dependencies.delete(targetKey);
  return dependencies;
};

export const DatasetEditor = ({ datasetId }: DatasetEditorProps) => {
  const [dataset, setDataset] = useState<DatasetRecord | null>(null);
  const [resources, setResources] = useState<DatasetResource[]>([]);
  const [selectedResourceId, setSelectedResourceId] = useState<string | null>(null);
  const [profiles, setProfiles] = useState<ProfileSummary[]>([]);
  const [isCreateDialogOpen, setCreateDialogOpen] = useState(false);

  const { snapshot, getResourcePayloadsByPackageKeys } = useImporter();
  const packages = snapshot?.packages ?? [];

  const sortResources = (items: DatasetResource[]) => {
    return [...items].sort((a, b) => {
      const aSelected = a.lastSelectedAt ?? 0;
      const bSelected = b.lastSelectedAt ?? 0;
      if (aSelected !== bSelected) return bSelected - aSelected;
      return b.createdAt - a.createdAt;
    });
  };

  useEffect(() => {
    const records = loadDatasets();
    const match = records.find((entry) => entry.id === datasetId) ?? null;
    setDataset(match);
    const loaded = loadDatasetResources(datasetId);
    setResources(sortResources(loaded));
  }, [datasetId]);

  useEffect(() => {
    if (resources.length === 0) {
      setSelectedResourceId(null);
      return;
    }
    if (!selectedResourceId || !resources.some((entry) => entry.id === selectedResourceId)) {
      setSelectedResourceId(resources[0].id);
    }
  }, [resources, selectedResourceId]);

  const [registryState, setRegistryState] = useState<ReturnType<typeof buildRegistry> | null>(
    null
  );

  useEffect(() => {
    if (!dataset || packages.length === 0) return;
    const graph = buildDependencyGraph(packages);
    const dependencyKeys = collectDependencies(dataset.projectKey, graph);
    const projectKeys = new Set<string>([dataset.projectKey, ...dependencyKeys]);

    let active = true;
    getResourcePayloadsByPackageKeys(Array.from(projectKeys))
      .then((payloads) => {
        if (!active) return;
        const nextRegistry = buildRegistry(payloads);
        setRegistryState(nextRegistry);
        setProfiles(getProfileSummaries(nextRegistry));
      });

    return () => {
      active = false;
    };
  }, [dataset, packages, getResourcePayloadsByPackageKeys]);

  const selectedResource = resources.find((entry) => entry.id === selectedResourceId) ?? null;
  const profile =
    selectedResource && registryState
      ? resolveProfileForResource(selectedResource.content, registryState)
      : null;
  const fields =
    profile && registryState ? buildFieldDefinitions(profile, registryState) : [];

  const persistResources = (nextResources: DatasetResource[]) => {
    const sorted = sortResources(nextResources);
    setResources(sorted);
    saveDatasetResources(datasetId, sorted);
  };

  const handleUpdateResource = (nextResource: DatasetResource) => {
    const nextResources = [
      nextResource,
      ...resources.filter((entry) => entry.id !== nextResource.id),
    ];
    persistResources(nextResources);
  };

  const handleSelectResource = (resourceId: string) => {
    const target = resources.find((entry) => entry.id === resourceId);
    if (!target) {
      setSelectedResourceId(resourceId);
      return;
    }
    const now = Date.now();
    const nextResources = resources.map((entry) =>
      entry.id === resourceId ? { ...entry, lastSelectedAt: now } : entry
    );
    persistResources(nextResources);
    setSelectedResourceId(resourceId);
  };

  const handleRemoveResource = (resourceId: string) => {
    const ok = window.confirm("Remove this resource from the dataset?");
    if (!ok) return;
    const nextResources = removeDatasetResource(datasetId, resourceId);
    setResources(nextResources);
  };

  const handleCreateResource = (payload: { profileUrl: string; resourceId?: string }) => {
    if (!registryState) return;
    const profileDefinition = getStructureDefinitionByCanonical(
      registryState,
      payload.profileUrl
    );
    if (!profileDefinition) return;
    const resourceType = profileDefinition.type ?? profileDefinition.id ?? "Resource";
    const now = Date.now();
    const content: Record<string, unknown> = {
      resourceType,
    };
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

    const nextResources = [nextResource, ...resources];
    persistResources(nextResources);
    setSelectedResourceId(nextResource.id);
    setCreateDialogOpen(false);
  };

  if (!dataset) {
    return (
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-10">
        <Card className="border-foreground/10">
          <CardHeader>
            <CardTitle className="text-2xl">Dataset not found</CardTitle>
            <CardDescription>
              The dataset id could not be resolved. Return to the projects overview.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">Missing id: {datasetId}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex h-[100dvh] flex-col overflow-hidden bg-muted/20">
      <EditorHeader
        datasetName={dataset.name}
        datasetId={dataset.id}
        projectKey={dataset.projectKey}
        onCreateResource={() => setCreateDialogOpen(true)}
      />

      <div className="flex-1 min-h-0 overflow-hidden px-6 pb-6 pt-4">
        <ResizablePanelGroup
          direction="horizontal"
          className="h-full min-h-0 rounded-xl border border-foreground/10 bg-background"
        >
          <ResizablePanel defaultSize={24} minSize={18} className="min-h-0">
            <ResourceListPanel
              resources={resources}
              selectedId={selectedResourceId}
              onSelect={handleSelectResource}
            />
          </ResizablePanel>
          <ResizableHandle withHandle />
          <ResizablePanel defaultSize={44} minSize={32} className="min-h-0">
            <ResourceDetailPanel
              resource={selectedResource}
              fields={fields}
              registry={registryState}
              datasetResources={resources}
              onUpdateResource={handleUpdateResource}
              onRemoveResource={handleRemoveResource}
            />
          </ResizablePanel>
          <ResizableHandle withHandle />
          <ResizablePanel defaultSize={32} minSize={20} className="min-h-0">
            <ResourceJsonPanel
              resource={selectedResource}
              onUpdateResource={handleUpdateResource}
            />
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>

      <NewResourceDialog
        open={isCreateDialogOpen}
        onOpenChange={setCreateDialogOpen}
        profiles={profiles}
        onCreate={handleCreateResource}
      />
    </div>
  );
};
