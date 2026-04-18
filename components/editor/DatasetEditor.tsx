"use client";

import { useEffect, useState } from "react";
import { useImporter } from "@/components/importer/useImporter";
import { DatasetDiagramDialog } from "@/components/editor/DatasetDiagramDialog";
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
  const [datasetLoaded, setDatasetLoaded] = useState(false);
  const [registryLoaded, setRegistryLoaded] = useState(false);
  const [resources, setResources] = useState<DatasetResource[]>([]);
  const [selectedResourceId, setSelectedResourceId] = useState<string | null>(null);
  const [profiles, setProfiles] = useState<ProfileSummary[]>([]);
  const [isCreateDialogOpen, setCreateDialogOpen] = useState(false);
  const [isDiagramOpen, setDiagramOpen] = useState(false);
  const [zoomPercent, setZoomPercent] = useState(100);
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [viewSettingsLoaded, setViewSettingsLoaded] = useState(false);
  const layoutStorageKey = "fhir-compose-editor-layout";
  const [panelSizes, setPanelSizes] = useState<number[] | null>(null);

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
    setDatasetLoaded(true);
  }, [datasetId]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setViewSettingsLoaded(false);
    const storedZoom = Number(window.localStorage.getItem("fhir-compose-zoom"));
    if (!Number.isNaN(storedZoom) && storedZoom >= 70 && storedZoom <= 140) {
      setZoomPercent(storedZoom);
    }
    const storedTheme = window.localStorage.getItem("fhir-compose-theme");
    if (storedTheme === "light" || storedTheme === "dark") {
      setTheme(storedTheme);
    }
    const rawLayout = window.localStorage.getItem(layoutStorageKey);
    if (rawLayout) {
      try {
        const parsed = JSON.parse(rawLayout);
        if (Array.isArray(parsed) && parsed.length >= 3) {
          setPanelSizes(parsed.filter((value) => typeof value === "number") as number[]);
        }
      } catch {
        setPanelSizes(null);
      }
    }
    setViewSettingsLoaded(true);
  }, [layoutStorageKey]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!viewSettingsLoaded) return;
    window.localStorage.setItem("fhir-compose-zoom", String(zoomPercent));
  }, [zoomPercent]);

  useEffect(() => {
    if (typeof document === "undefined") return;
    document.documentElement.classList.toggle("dark", theme === "dark");
    if (typeof window !== "undefined") {
      if (!viewSettingsLoaded) return;
      window.localStorage.setItem("fhir-compose-theme", theme);
    }
  }, [theme, viewSettingsLoaded]);

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
    setRegistryLoaded(false);
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
        setRegistryLoaded(true);
      });

    return () => {
      active = false;
    };
  }, [dataset, packages, getResourcePayloadsByPackageKeys]);

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

  const downloadJson = (filename: string, payload: unknown) => {
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

  const handleExportResource = (resource: DatasetResource) => {
    const id =
      typeof resource.content.id === "string" && resource.content.id.trim()
        ? resource.content.id.trim()
        : resource.id;
    const safeId = id.replace(/[^a-zA-Z0-9-_]+/g, "-");
    downloadJson(`${resource.resourceType}-${safeId}.json`, resource.content);
  };

  const handleDuplicateResource = (resource: DatasetResource) => {
    const now = Date.now();
    const cloneContent =
      typeof structuredClone === "function"
        ? structuredClone(resource.content)
        : (JSON.parse(JSON.stringify(resource.content)) as Record<string, unknown>);
    const newContentId = createDatasetResourceId();
    cloneContent.id = newContentId;

    const duplicated: DatasetResource = {
      ...resource,
      id: createDatasetResourceId(),
      content: cloneContent,
      createdAt: now,
      updatedAt: now,
      lastSelectedAt: now,
    };

    const nextResources = [duplicated, ...resources];
    persistResources(nextResources);
    setSelectedResourceId(duplicated.id);
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

  if (!datasetLoaded || !viewSettingsLoaded) {
    return (
      <div className="relative flex h-[100dvh] items-center justify-center bg-muted/20">
        <div className="rounded-lg border border-foreground/10 bg-background px-4 py-3 text-sm text-muted-foreground shadow-sm">
          Loading editor…
        </div>
      </div>
    );
  }

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

  const zoomLabel = `${zoomPercent}%`;
  const isInitializing = dataset ? !registryLoaded : false;

  return (
    <div className="relative flex h-[100dvh] flex-col overflow-hidden bg-muted/20">
      {isInitializing ? (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-background/80 backdrop-blur-sm">
          <div className="rounded-lg border border-foreground/10 bg-background px-4 py-3 text-sm text-muted-foreground shadow-sm">
            Loading editor…
          </div>
        </div>
      ) : null}
      <div className="flex h-full w-full flex-col" style={{ zoom: zoomPercent / 100 }}>
        <EditorHeader
          datasetName={dataset.name}
          datasetId={dataset.id}
          projectKey={dataset.projectKey}
          onCreateResource={() => setCreateDialogOpen(true)}
          onOpenDiagram={() => setDiagramOpen(true)}
          theme={theme}
          onThemeChange={setTheme}
          zoomLabel={zoomLabel}
          onZoomIn={() => setZoomPercent((prev) => Math.min(140, prev + 5))}
          onZoomOut={() => setZoomPercent((prev) => Math.max(70, prev - 5))}
        />

		        <div className="flex-1 min-h-0 overflow-hidden px-6 pb-6 pt-4">
		          <ResizablePanelGroup
		            direction="horizontal"
		            onLayoutChanged={(sizes: number[]) => {
		              setPanelSizes(sizes);
		              if (typeof window !== "undefined" && viewSettingsLoaded) {
		                window.localStorage.setItem(layoutStorageKey, JSON.stringify(sizes));
		              }
		            }}
		            className="h-full min-h-0 rounded-xl border border-foreground/10 bg-background"
		          >
            <ResizablePanel defaultSize={panelSizes?.[0] ?? 24} minSize={18} className="min-h-0">
            <ResourceListPanel
              resources={resources}
              selectedId={selectedResourceId}
              onSelect={handleSelectResource}
              onCreateResource={() => setCreateDialogOpen(true)}
              onRemoveResource={handleRemoveResource}
              onExportResource={handleExportResource}
              onDuplicateResource={handleDuplicateResource}
            />
            </ResizablePanel>
            <ResizableHandle withHandle />
            <ResizablePanel defaultSize={panelSizes?.[1] ?? 44} minSize={32} className="min-h-0">
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
            <ResizablePanel defaultSize={panelSizes?.[2] ?? 32} minSize={20} className="min-h-0">
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
        <DatasetDiagramDialog
          open={isDiagramOpen}
          onOpenChange={setDiagramOpen}
          resources={resources}
        />
      </div>
    </div>
  );
};
