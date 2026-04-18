"use client";

import { useEffect, useMemo, useState } from "react";
import { useImporter } from "@/components/importer/useImporter";
import { DatasetDiagramDialog } from "@/components/editor/DatasetDiagramDialog";
import { EditorHeader } from "@/components/editor/EditorHeader";
import { ExportDialog } from "@/components/editor/ExportDialog";
import { NewResourceDialog } from "@/components/editor/NewResourceDialog";
import { ResourceDetailPanel } from "@/components/editor/ResourceDetailPanel";
import { ResourceJsonPanel } from "@/components/editor/ResourceJsonPanel";
import { ResourceListPanel } from "@/components/editor/ResourceListPanel";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import type { Layout } from "react-resizable-panels";
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
import type {
  ComposeDatasetExport,
  ComposePackageExport,
  ComposeProjectArchiveManifest,
  ComposeProjectExport,
} from "@/lib/fhir-importer/compose";
import type { PackageRecord } from "@/lib/fhir-importer/types";
import { buildPackageKey, isExactVersion } from "@/lib/fhir-importer/utils";
import { toast } from "sonner";
import JSZip from "jszip";

type DatasetEditorProps = {
  datasetId: string;
};

type DependencyGraph = {
  byKey: Map<string, PackageRecord>;
  adjacency: Map<string, string[]>;
};

const downloadBlob = (filename: string, blob: Blob) => {
  if (typeof window === "undefined") return;
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
};

const downloadJson = (filename: string, payload: unknown) => {
  if (typeof window === "undefined") return;
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  downloadBlob(filename, blob);
};

const toSafeFilename = (value: string) =>
  value
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+/, "")
    .replace(/-+$/, "");

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
  const [datasets, setDatasets] = useState<DatasetRecord[]>([]);
  const [datasetLoaded, setDatasetLoaded] = useState(false);
  const [registryLoaded, setRegistryLoaded] = useState(false);
  const [resources, setResources] = useState<DatasetResource[]>([]);
  const [selectedResourceId, setSelectedResourceId] = useState<string | null>(null);
  const [profiles, setProfiles] = useState<ProfileSummary[]>([]);
  const [isCreateDialogOpen, setCreateDialogOpen] = useState(false);
  const [isDiagramOpen, setDiagramOpen] = useState(false);
  const [isExportDialogOpen, setExportDialogOpen] = useState(false);
  const [exportScope, setExportScope] = useState<"dataset" | "project">("dataset");
  const [exportFormat, setExportFormat] = useState<"json" | "zip">("json");
  const [exportDatasetMode, setExportDatasetMode] = useState<
    "package" | "resources" | "searchset"
  >("package");
  const [exportIncludeDatasets, setExportIncludeDatasets] = useState(true);
  const [zoomPercent, setZoomPercent] = useState(100);
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [viewSettingsLoaded, setViewSettingsLoaded] = useState(false);
  const layoutStorageKey = "health-compose-editor-layout";
  const [panelLayout, setPanelLayout] = useState<Layout | null>(null);

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
    setDatasets(records);
    const loaded = loadDatasetResources(datasetId);
    setResources(sortResources(loaded));
    setDatasetLoaded(true);
  }, [datasetId]);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const name = dataset?.name?.trim();
    document.title = name ? `Editor - ${name}` : "Editor";
  }, [dataset?.name]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setViewSettingsLoaded(false);
    const storedZoom = Number(window.localStorage.getItem("health-compose-zoom"));
    if (!Number.isNaN(storedZoom) && storedZoom >= 70 && storedZoom <= 140) {
      setZoomPercent(storedZoom);
    }
    const storedTheme = window.localStorage.getItem("health-compose-theme");
    if (storedTheme === "light" || storedTheme === "dark") {
      setTheme(storedTheme);
    }
    const rawLayout = window.localStorage.getItem(layoutStorageKey);
    if (rawLayout) {
      try {
        const parsed = JSON.parse(rawLayout) as unknown;
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
          const entries = Object.entries(parsed as Record<string, unknown>).filter(
            ([, value]) => typeof value === "number"
          );
          if (entries.length > 0) {
            setPanelLayout(Object.fromEntries(entries) as Layout);
          }
        }
      } catch {
        setPanelLayout(null);
      }
    }
    setViewSettingsLoaded(true);
  }, [layoutStorageKey]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!viewSettingsLoaded) return;
    window.localStorage.setItem("health-compose-zoom", String(zoomPercent));
  }, [zoomPercent]);

  useEffect(() => {
    if (typeof document === "undefined") return;
    document.documentElement.classList.toggle("dark", theme === "dark");
    if (typeof window !== "undefined") {
      if (!viewSettingsLoaded) return;
      window.localStorage.setItem("health-compose-theme", theme);
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

  const datasetResourcesPayload = useMemo(
    () => resources.map((entry) => entry.content),
    [resources]
  );

  const buildSearchsetBundle = (entries: unknown[]) => ({
    resourceType: "Bundle",
    type: "searchset",
    total: entries.length,
    entry: entries.map((resource) => ({ resource })),
  });

  const handleExportDataset = async () => {
    if (!dataset) return;
    const safeName = toSafeFilename(dataset.name) || "dataset";
    let payload: unknown = null;
    let filename = `${safeName}.json`;
    let zipName = `${safeName}.zip`;

    if (exportDatasetMode === "package") {
      const datasetPayload: ComposeDatasetExport = {
        id: dataset.id,
        name: dataset.name,
        projectKey: dataset.projectKey,
        resources: datasetResourcesPayload,
      };
      payload = datasetPayload;
      filename = `${safeName}.json`;
      zipName = `${safeName}.zip`;
    } else if (exportDatasetMode === "resources") {
      payload = datasetResourcesPayload;
      filename = `${safeName}-resources.json`;
      zipName = `${safeName}-resources.zip`;
    } else {
      payload = buildSearchsetBundle(datasetResourcesPayload);
      filename = `${safeName}-searchset.json`;
      zipName = `${safeName}-searchset.zip`;
    }

    if (exportFormat === "json") {
      downloadJson(filename, payload);
    } else {
      const zip = new JSZip();
      zip.file(filename, JSON.stringify(payload, null, 2));
      const blob = await zip.generateAsync({ type: "blob" });
      downloadBlob(zipName, blob);
    }
    toast.success("Dataset exported.");
  };

  const prepareProjectExport = async (
    project: PackageRecord,
    includeDatasets: boolean
  ): Promise<{
    projectKeys: Set<string>;
    exportPackages: ComposePackageExport[];
    exportDatasets: ComposeDatasetExport[];
  } | null> => {
    const graph = buildDependencyGraph(packages);
    const dependencyKeys = collectDependencies(project.key, graph);
    const projectKeys = new Set<string>([project.key, ...dependencyKeys]);
    const packageRecords = Array.from(projectKeys)
      .map((key) => graph.byKey.get(key))
      .filter((record): record is PackageRecord => Boolean(record));

    if (packageRecords.length === 0) {
      toast.error("No packages available to export.");
      return null;
    }

    const payloads = await getResourcePayloadsByPackageKeys(Array.from(projectKeys));
    const payloadsByKey = new Map<string, typeof payloads>();
    for (const payload of payloads) {
      const list = payloadsByKey.get(payload.packageKey) ?? [];
      list.push(payload);
      payloadsByKey.set(payload.packageKey, list);
    }

    const exportPackages: ComposePackageExport[] = packageRecords.map((pkg) => ({
      key: pkg.key,
      id: pkg.id,
      version: pkg.version,
      manifest: pkg.manifest,
      resources: (payloadsByKey.get(pkg.key) ?? []).map((resource) => ({
        resourceType: resource.resourceType,
        id: resource.id,
        url: resource.url,
        content: resource.content,
      })),
    }));

    const exportDatasets: ComposeDatasetExport[] = includeDatasets
      ? datasets
          .filter((entry) => projectKeys.has(entry.projectKey ?? ""))
          .map((entry) => ({
            id: entry.id,
            name: entry.name,
            projectKey: entry.projectKey,
            resources:
              entry.id === dataset?.id
                ? datasetResourcesPayload
                : loadDatasetResources(entry.id).map((item) => item.content),
          }))
      : [];

    return {
      projectKeys,
      exportPackages,
      exportDatasets,
    };
  };

  const exportProjectAsJson = async (project: PackageRecord, includeDatasets: boolean) => {
    const prepared = await prepareProjectExport(project, includeDatasets);
    if (!prepared) return;

    const payload: ComposeProjectExport = {
      type: "health-compose-project",
      version: 1,
      targetKey: project.key,
      exportedAt: new Date().toISOString(),
      packages: prepared.exportPackages,
      datasets: prepared.exportDatasets,
    };

    const filename =
      toSafeFilename(`${project.id}-${project.version}-compose.json`) ||
      "compose-project.json";
    downloadJson(filename, payload);
    toast.success("Project exported.");
  };

  const exportProjectAsZip = async (project: PackageRecord, includeDatasets: boolean) => {
    const prepared = await prepareProjectExport(project, includeDatasets);
    if (!prepared) return;

    const zip = new JSZip();
    const packagesFolder = zip.folder("packages");
    const datasetsFolder = zip.folder("datasets");

    const packageEntries = prepared.exportPackages.map((pkg) => {
      const filename = toSafeFilename(`${pkg.key}.json`) || "package.json";
      packagesFolder?.file(filename, JSON.stringify(pkg, null, 2));
      return {
        key: pkg.key,
        id: pkg.id,
        version: pkg.version,
        manifest: pkg.manifest,
        file: `packages/${filename}`,
      };
    });

    const datasetEntries = prepared.exportDatasets.map((entry, index) => {
      const baseName = toSafeFilename(entry.id ?? entry.name) || `dataset-${index + 1}`;
      const filename = `${baseName}.json`;
      datasetsFolder?.file(filename, JSON.stringify(entry, null, 2));
      return {
        id: entry.id,
        name: entry.name,
        projectKey: entry.projectKey,
        file: `datasets/${filename}`,
      };
    });

    const manifest: ComposeProjectArchiveManifest = {
      type: "health-compose-project-archive",
      version: 1,
      targetKey: project.key,
      exportedAt: new Date().toISOString(),
      packages: packageEntries,
      datasets: includeDatasets ? datasetEntries : undefined,
    };

    zip.file("compose-project.json", JSON.stringify(manifest, null, 2));
    const blob = await zip.generateAsync({ type: "blob" });
    const filename =
      toSafeFilename(`${project.id}-${project.version}-compose.zip`) || "compose-project.zip";
    downloadBlob(filename, blob);
    toast.success("Project exported.");
  };

  const handleExportConfirm = async () => {
    if (!dataset) return;
    if (exportScope === "dataset") {
      await handleExportDataset();
      setExportDialogOpen(false);
      return;
    }

    const targetProject = packages.find((pkg) => pkg.key === dataset.projectKey);
    if (!targetProject) {
      toast.error("Project package not found for this dataset.");
      return;
    }

    if (exportFormat === "json") {
      await exportProjectAsJson(targetProject, exportIncludeDatasets);
    } else {
      await exportProjectAsZip(targetProject, exportIncludeDatasets);
    }
    setExportDialogOpen(false);
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
          onOpenExport={() => setExportDialogOpen(true)}
          theme={theme}
          onThemeChange={setTheme}
          zoomLabel={zoomLabel}
          onZoomIn={() => setZoomPercent((prev) => Math.min(140, prev + 5))}
          onZoomOut={() => setZoomPercent((prev) => Math.max(70, prev - 5))}
        />

        <div className="min-h-0 flex-1 overflow-hidden px-6 pb-6 pt-4">
          <ResizablePanelGroup
            direction="horizontal"
            onLayoutChanged={(layout: Layout) => {
              setPanelLayout(layout);
              if (typeof window !== "undefined" && viewSettingsLoaded) {
                window.localStorage.setItem(layoutStorageKey, JSON.stringify(layout));
              }
            }}
            className="h-full min-h-0 rounded-xl border border-foreground/10 bg-background"
          >
            <ResizablePanel
              id="resource-list"
              defaultSize={panelLayout?.["resource-list"] ?? 24}
              minSize={18}
              className="min-h-0 min-w-0"
            >
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
            <ResizablePanel
              id="resource-detail"
              defaultSize={panelLayout?.["resource-detail"] ?? 44}
              minSize={32}
              className="min-h-0 min-w-0"
            >
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
            <ResizablePanel
              id="resource-json"
              defaultSize={panelLayout?.["resource-json"] ?? 32}
              minSize={20}
              className="min-h-0 min-w-0"
            >
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
        <ExportDialog
          open={isExportDialogOpen}
          onOpenChange={setExportDialogOpen}
          title="Export dataset"
          description="Export the current dataset or the full project with dependencies."
          scope={exportScope}
          scopeOptions={[
            { value: "dataset", label: "Dataset only" },
            {
              value: "project",
              label: "Project + dependencies",
              disabled: !dataset.projectKey,
              helper: !dataset.projectKey
                ? "Project export is unavailable for datasets without a project key."
                : undefined,
            },
          ]}
          onScopeChange={setExportScope}
          exportFormat={exportFormat}
          onExportFormatChange={setExportFormat}
          datasetMode={exportDatasetMode}
          onDatasetModeChange={setExportDatasetMode}
          includeDatasets={exportIncludeDatasets}
          onIncludeDatasetsChange={setExportIncludeDatasets}
          confirmLabel={exportScope === "dataset" ? "Export dataset" : "Export project"}
          onConfirm={handleExportConfirm}
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
