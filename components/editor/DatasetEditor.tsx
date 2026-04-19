"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useImporter } from "@/components/importer/useImporter";
import { EditorCommandPalette } from "@/components/editor/commands/EditorCommandPalette";
import { createEditorCommands } from "@/components/editor/commands/create-editor-commands";
import { useEditorCommandShortcuts } from "@/components/editor/commands/use-editor-command-shortcuts";
import { DatasetDiagramDialog } from "@/components/editor/DatasetDiagramDialog";
import { EditorHeader } from "@/components/editor/EditorHeader";
import { ExportDialog } from "@/components/editor/ExportDialog";
import { NewResourceDialog } from "@/components/editor/NewResourceDialog";
import {
  ResourceDetailPanel,
  type ResourceDetailPanelHandle,
} from "@/components/editor/ResourceDetailPanel";
import { ResourceJsonPanel } from "@/components/editor/ResourceJsonPanel";
import { ResourceListPanel } from "@/components/editor/ResourceListPanel";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Layout } from "react-resizable-panels";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { DatasetRecord } from "@/lib/datasets/storage";
import { loadDatasets, upsertDataset } from "@/lib/datasets/storage";
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
import { isDevModeEnabled } from "@/lib/dev-mode";
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

type ResourceNavigationState = {
  history: string[];
  index: number;
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

const pruneResourceNavigation = (
  state: ResourceNavigationState,
  validIds: Set<string>
): ResourceNavigationState => {
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

const pushResourceNavigationEntry = (
  state: ResourceNavigationState,
  resourceId: string
): ResourceNavigationState => {
  const currentId = state.index >= 0 ? state.history[state.index] : null;
  if (currentId === resourceId) return state;

  const boundedIndex = Math.min(state.index, state.history.length - 1);
  const base = boundedIndex >= 0 ? state.history.slice(0, boundedIndex + 1) : [];
  const nextHistory = [...base, resourceId];
  return {
    history: nextHistory,
    index: nextHistory.length - 1,
  };
};

export const DatasetEditor = ({ datasetId }: DatasetEditorProps) => {
  const router = useRouter();
  const resourceDetailRef = useRef<ResourceDetailPanelHandle | null>(null);
  const [dataset, setDataset] = useState<DatasetRecord | null>(null);
  const [datasets, setDatasets] = useState<DatasetRecord[]>([]);
  const [datasetLoaded, setDatasetLoaded] = useState(false);
  const [registryLoaded, setRegistryLoaded] = useState(false);
  const [initializationError, setInitializationError] = useState<Error | null>(null);
  const [resources, setResources] = useState<DatasetResource[]>([]);
  const [selectedResourceId, setSelectedResourceId] = useState<string | null>(null);
  const [resourceNavigation, setResourceNavigation] = useState<ResourceNavigationState>({
    history: [],
    index: -1,
  });
  const [profiles, setProfiles] = useState<ProfileSummary[]>([]);
  const [isCreateDialogOpen, setCreateDialogOpen] = useState(false);
  const [isDiagramOpen, setDiagramOpen] = useState(false);
  const [isExportDialogOpen, setExportDialogOpen] = useState(false);
  const [isDatasetInfoOpen, setDatasetInfoOpen] = useState(false);
  const [isCommandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [datasetNameDraft, setDatasetNameDraft] = useState("");
  const [datasetProjectKeyDraft, setDatasetProjectKeyDraft] = useState("");
  const [exportScope, setExportScope] = useState<"dataset" | "project">("dataset");
  const [exportFormat, setExportFormat] = useState<"json" | "zip">("json");
  const [exportDatasetMode, setExportDatasetMode] = useState<
    "package" | "resources" | "searchset"
  >("package");
  const [exportIncludeDatasets, setExportIncludeDatasets] = useState(true);
  const [zoomPercent, setZoomPercent] = useState(100);
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [viewSettingsLoaded, setViewSettingsLoaded] = useState(false);
  const layoutStorageKey = "fhir-explorer-editor-layout";
  const [panelLayout, setPanelLayout] = useState<Layout | null>(null);

  const { snapshot, getResourcePayloadsByPackageKeys } = useImporter();
  const packages = snapshot?.packages ?? [];
  const projectSuggestions = useMemo(() => {
    return [...packages]
      .sort((a, b) => {
        const idCompare = a.id.localeCompare(b.id);
        if (idCompare !== 0) return idCompare;
        return a.version.localeCompare(b.version);
      })
      .map((entry) => ({
        key: entry.key,
        label: `${entry.id}@${entry.version}`,
      }));
  }, [packages]);
  const hasSuggestedProject = useMemo(
    () => projectSuggestions.some((project) => project.key === datasetProjectKeyDraft),
    [projectSuggestions, datasetProjectKeyDraft]
  );

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
    if (!isDatasetInfoOpen || !dataset) return;
    setDatasetNameDraft(dataset.name);
    setDatasetProjectKeyDraft(dataset.projectKey);
  }, [isDatasetInfoOpen, dataset]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setViewSettingsLoaded(false);
    const storedZoom = Number(window.localStorage.getItem("fhir-explorer-zoom"));
    if (!Number.isNaN(storedZoom) && storedZoom >= 70 && storedZoom <= 140) {
      setZoomPercent(storedZoom);
    }
    const storedTheme = window.localStorage.getItem("fhir-explorer-theme");
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
    window.localStorage.setItem("fhir-explorer-zoom", String(zoomPercent));
  }, [zoomPercent]);

  useEffect(() => {
    if (typeof document === "undefined") return;
    document.documentElement.classList.toggle("dark", theme === "dark");
    if (typeof window !== "undefined") {
      if (!viewSettingsLoaded) return;
      window.localStorage.setItem("fhir-explorer-theme", theme);
    }
  }, [theme, viewSettingsLoaded]);

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

  const [registryState, setRegistryState] = useState<ReturnType<typeof buildRegistry> | null>(
    null
  );

  useEffect(() => {
    if (!dataset || packages.length === 0) return;
    setRegistryLoaded(false);
    setInitializationError(null);
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
      })
      .catch((error) => {
        if (!active) return;
        const normalizedError =
          error instanceof Error ? error : new Error("Failed to load FHIR package resources.");
        setRegistryState(null);
        setProfiles([]);
        setInitializationError(normalizedError);
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

  const handleSelectResource = (
    resourceId: string,
    options?: { recordHistory?: boolean }
  ) => {
    const target = resources.find((entry) => entry.id === resourceId);
    if (!target) {
      return;
    }
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
    resourceNavigation.index >= 0 &&
    resourceNavigation.index < resourceNavigation.history.length - 1;

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

  const handleOpenProjects = () => {
    router.push("/");
  };

  const handleOpenCreateDialog = () => {
    setCreateDialogOpen(true);
  };

  const handleOpenDiagram = () => {
    setDiagramOpen(true);
  };

  const handleOpenExportDialog = () => {
    setExportDialogOpen(true);
  };

  const handleOpenCommandPalette = () => {
    setCommandPaletteOpen(true);
  };

  const handleOpenDatasetInfo = () => {
    if (!dataset) return;
    setDatasetNameDraft(dataset.name);
    setDatasetProjectKeyDraft(dataset.projectKey);
    setDatasetInfoOpen(true);
  };

  const handleFocusFormSearch = () => {
    resourceDetailRef.current?.focusSearch();
  };

  const handleZoomIn = () => {
    setZoomPercent((prev) => Math.min(140, prev + 5));
  };

  const handleZoomOut = () => {
    setZoomPercent((prev) => Math.max(70, prev - 5));
  };

  const handleSaveDatasetInfo = () => {
    if (!dataset) return;
    const nextName = datasetNameDraft.trim();
    const nextProjectKey = datasetProjectKeyDraft.trim();
    if (!nextName) {
      toast.error("Dataset name is required.");
      return;
    }
    if (!nextProjectKey) {
      toast.error("Project key is required.");
      return;
    }
    const nextDataset: DatasetRecord = {
      ...dataset,
      name: nextName,
      projectKey: nextProjectKey,
    };
    const nextDatasets = upsertDataset(nextDataset);
    setDataset(nextDataset);
    setDatasets(nextDatasets);
    setDatasetInfoOpen(false);
    toast.success("Dataset info updated.");
  };

  const editorCommands = createEditorCommands({
    openPalette: handleOpenCommandPalette,
    openProjects: handleOpenProjects,
    createResource: handleOpenCreateDialog,
    openExport: handleOpenExportDialog,
    openDiagram: handleOpenDiagram,
    focusFormSearch: handleFocusFormSearch,
    zoomIn: handleZoomIn,
    zoomOut: handleZoomOut,
    navigateBack: handleNavigateBack,
    navigateForward: handleNavigateForward,
    canNavigateBack,
    canNavigateForward,
    theme,
    setTheme,
  });

  useEditorCommandShortcuts({ commands: editorCommands });

  const handleRemoveResource = (resourceId: string) => {
    const ok = window.confirm("Remove this resource from the dataset?");
    if (!ok) return;
    const nextResources = removeDatasetResource(datasetId, resourceId);
    setResources(nextResources);
    const validIds = new Set(nextResources.map((entry) => entry.id));
    setResourceNavigation((prev) => pruneResourceNavigation(prev, validIds));
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
    setResourceNavigation((prev) => pushResourceNavigationEntry(prev, duplicated.id));
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
      type: "fhir-explorer-project",
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
      type: "fhir-explorer-project-archive",
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
    setResourceNavigation((prev) => pushResourceNavigationEntry(prev, nextResource.id));
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

  if (initializationError) {
    const details = [`message: ${initializationError.message}`];
    if (initializationError.stack) {
      details.push("", initializationError.stack);
    }

    return (
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-10">
        <Card className="border-foreground/10">
          <CardHeader>
            <CardTitle className="text-2xl">Editor konnte nicht geladen werden</CardTitle>
            <CardDescription>
              Beim Initialisieren der FHIR-Profile ist ein Fehler aufgetreten.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {isDevModeEnabled() ? (
              <pre className="max-h-[45dvh] overflow-auto rounded-md border border-foreground/10 bg-muted/30 p-3 text-xs whitespace-pre-wrap">
                {details.join("\n")}
              </pre>
            ) : (
              <p className="text-sm text-muted-foreground">
                Für technische Details kann Dev Mode über <Link href="/devmode" className="underline">/devmode</Link>{" "}
                aktiviert werden.
              </p>
            )}
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
          onOpenDiagram={handleOpenDiagram}
          onOpenExport={handleOpenExportDialog}
          onOpenDatasetInfo={handleOpenDatasetInfo}
          theme={theme}
          onThemeChange={setTheme}
          zoomLabel={zoomLabel}
          onZoomIn={handleZoomIn}
          onZoomOut={handleZoomOut}
          canNavigateBack={canNavigateBack}
          canNavigateForward={canNavigateForward}
          onNavigateBack={handleNavigateBack}
          onNavigateForward={handleNavigateForward}
          onOpenCommands={handleOpenCommandPalette}
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
                registry={registryState}
                selectedId={selectedResourceId}
                onSelect={handleSelectResource}
                onCreateResource={handleOpenCreateDialog}
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
                ref={resourceDetailRef}
                resource={selectedResource}
                fields={fields}
                registry={registryState}
                datasetResources={resources}
                onSelectResource={handleSelectResource}
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
                datasetResources={resources}
                fields={fields}
                registry={registryState}
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
        <Dialog open={isDatasetInfoOpen} onOpenChange={setDatasetInfoOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Dataset Info</DialogTitle>
              <DialogDescription>
                Review and edit metadata for this dataset.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-3">
              <div className="grid gap-2">
                <Label htmlFor="dataset-info-name">Name</Label>
                <Input
                  id="dataset-info-name"
                  value={datasetNameDraft}
                  onChange={(event) => setDatasetNameDraft(event.target.value)}
                  placeholder="Dataset name"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="dataset-info-project">Project key</Label>
                <select
                  id="dataset-info-project"
                  className="h-9 rounded-md border border-foreground/20 bg-background px-3 text-sm"
                  value={
                    hasSuggestedProject
                      ? datasetProjectKeyDraft
                      : "__custom_project_key__"
                  }
                  onChange={(event) => {
                    const value = event.target.value;
                    if (value === "__custom_project_key__") {
                      if (hasSuggestedProject) {
                        setDatasetProjectKeyDraft("");
                      }
                      return;
                    }
                    setDatasetProjectKeyDraft(value);
                  }}
                >
                  {projectSuggestions.length === 0 ? (
                    <option value="__custom_project_key__">
                      No imported projects available
                    </option>
                  ) : null}
                  {projectSuggestions.map((project) => (
                    <option key={project.key} value={project.key}>
                      {project.label}
                    </option>
                  ))}
                  <option value="__custom_project_key__">Custom project key…</option>
                </select>
                {!hasSuggestedProject ? (
                  <Input
                    value={datasetProjectKeyDraft}
                    onChange={(event) => setDatasetProjectKeyDraft(event.target.value)}
                    placeholder="package-id@version"
                  />
                ) : null}
                <p className="text-xs text-muted-foreground">
                  Select an imported project or enter a custom project key.
                </p>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="dataset-info-id">Dataset ID</Label>
                <Input id="dataset-info-id" value={dataset.id} readOnly />
                <p className="text-xs text-muted-foreground">
                  Dataset ID is read-only because it is used as the storage key.
                </p>
              </div>
              <div className="text-xs text-muted-foreground">
                Created: {new Date(dataset.createdAt).toLocaleString()}
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDatasetInfoOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleSaveDatasetInfo}>Save</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        <EditorCommandPalette
          open={isCommandPaletteOpen}
          onOpenChange={setCommandPaletteOpen}
          commands={editorCommands}
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
