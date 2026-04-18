"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useImporter } from "@/components/importer/useImporter";
import { ExportDialog } from "@/components/editor/ExportDialog";
import type { PackageRecord } from "@/lib/fhir-importer/types";
import { buildPackageKey, isExactVersion } from "@/lib/fhir-importer/utils";
import type {
  ComposeDatasetExport,
  ComposePackageExport,
  ComposeProjectArchiveManifest,
  ComposeProjectExport,
} from "@/lib/fhir-importer/compose";
import {
  loadDatasets,
  clearDatasets,
  removeDataset,
  removeDatasetsForProject,
  upsertDataset,
  type DatasetRecord,
} from "@/lib/datasets/storage";
import {
  clearDatasetResources,
  hydrateDatasetResources,
  loadDatasetResources,
  saveDatasetResources,
} from "@/lib/datasets/content";
import { toast } from "sonner";
import { Database, LayoutGrid, MoreHorizontal, Plus, Settings, Upload } from "lucide-react";
import JSZip from "jszip";

type ProjectEntry = {
  key: string;
  record?: PackageRecord;
};

type DependencyGraph = {
  byKey: Map<string, PackageRecord>;
  adjacency: Map<string, string[]>;
};

const createDatasetId = () => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `dataset-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
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

const matchesFilter = (
  filter: string,
  record: PackageRecord | undefined,
  fallbackKey: string
) => {
  if (!filter) return true;
  const haystack = [
    fallbackKey,
    record?.id,
    record?.version,
    record?.manifest.title,
    record?.manifest.name,
    record?.manifest.description,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return haystack.includes(filter);
};

const formatTimestamp = (timestamp: number) => new Date(timestamp).toLocaleString();

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
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json",
  });
  downloadBlob(filename, blob);
};

const toSafeFilename = (value: string) =>
  value
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+/, "")
    .replace(/-+$/, "");

type ProjectCardProps = {
  kind: "Target" | "Dependency";
  project: PackageRecord;
  dependencyCount?: number;
  owners?: string[];
  datasets: DatasetRecord[];
  onCreateDataset: (project: PackageRecord) => void;
  onImportDataset: (project: PackageRecord) => void;
  onOpenExportDialog: (project: PackageRecord) => void;
  onExportDataset: (dataset: DatasetRecord) => void;
  onDeleteProject: (project: PackageRecord) => void;
  onDeleteDataset: (dataset: DatasetRecord) => void;
  canDeleteProject: boolean;
  deleteReason?: string;
};

const ProjectCard = ({
  kind,
  project,
  dependencyCount,
  owners,
  datasets,
  onCreateDataset,
  onImportDataset,
  onOpenExportDialog,
  onExportDataset,
  onDeleteProject,
  onDeleteDataset,
  canDeleteProject,
  deleteReason,
}: ProjectCardProps) => {
  const title = project.manifest.title ?? project.manifest.name ?? project.id;
  const description = project.manifest.description ?? "No description provided.";

  return (
    <Card className="border-foreground/10">
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="text-xl">{title}</CardTitle>
            <CardDescription>{project.key}</CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={kind === "Target" ? "secondary" : "outline"}>{kind}</Badge>
            <Badge variant="outline">{project.resourceCount} resources</Badge>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="icon-sm" variant="ghost" aria-label="Project actions">
                  <MoreHorizontal className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>Project actions</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => onOpenExportDialog(project)}>
                  Export project...
                </DropdownMenuItem>
                <DropdownMenuItem
                  variant="destructive"
                  disabled={!canDeleteProject}
                  onClick={() => onDeleteProject(project)}
                >
                  Delete project
                </DropdownMenuItem>
                {!canDeleteProject && deleteReason ? (
                  <DropdownMenuLabel className="text-xs text-muted-foreground">
                    {deleteReason}
                  </DropdownMenuLabel>
                ) : null}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </CardHeader>
      <CardContent className="grid gap-4">
        <p className="text-sm text-muted-foreground">{description}</p>
        <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
          <span>Added: {formatTimestamp(project.addedAt)}</span>
          {typeof dependencyCount === "number" ? (
            <span>Dependencies: {dependencyCount}</span>
          ) : null}
          <span>Datasets: {datasets.length}</span>
          {owners && owners.length > 0 ? (
            <span>Used by: {owners.join(", ")}</span>
          ) : null}
        </div>
        <div className="rounded-lg border border-foreground/10 bg-muted/30 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-foreground">Datasets</p>
              <p className="text-xs text-muted-foreground">
                Create datasets for this project and open them in the editor.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="icon-sm"
                variant="secondary"
                onClick={() => onCreateDataset(project)}
                aria-label="Create dataset"
              >
                <Plus className="size-4" />
              </Button>
              <Button
                size="icon-sm"
                variant="outline"
                onClick={() => onImportDataset(project)}
                aria-label="Import dataset"
              >
                <Upload className="size-4" />
              </Button>
            </div>
          </div>
          <div className="mt-3 grid gap-2">
            {datasets.length === 0 ? (
              <p className="text-xs text-muted-foreground">No datasets yet.</p>
            ) : (
              datasets.map((dataset) => (
                <div
                  key={dataset.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-foreground/10 bg-background px-3 py-2 text-xs"
                >
                  <div>
                    <p className="text-sm font-medium text-foreground">{dataset.name}</p>
                    <p className="text-xs text-muted-foreground">
                      Created {formatTimestamp(dataset.createdAt)}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button asChild size="sm" variant="secondary">
                      <Link href={`/${dataset.id}`}>Open</Link>
                    </Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button size="icon-sm" variant="ghost" aria-label="Dataset actions">
                          <MoreHorizontal className="size-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => onExportDataset(dataset)}>
                          Export dataset
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          variant="destructive"
                          onClick={() => onDeleteDataset(dataset)}
                        >
                          Delete dataset
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default function EditorOverviewPage() {
  const { snapshot, refresh, deletePackage, getResourcePayloadsByPackageKeys, clearAllData } = useImporter();
  const [filter, setFilter] = useState("");
  const [viewMode, setViewMode] = useState<"projects" | "datasets">("projects");
  const [viewModeLoaded, setViewModeLoaded] = useState(false);
  const [datasets, setDatasets] = useState<DatasetRecord[]>([]);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [settingsDialogOpen, setSettingsDialogOpen] = useState(false);
  const [selectedProject, setSelectedProject] = useState<PackageRecord | null>(null);
  const [selectedProjectKey, setSelectedProjectKey] = useState<string | null>(null);
  const [exportTarget, setExportTarget] = useState<PackageRecord | null>(null);
  const [datasetName, setDatasetName] = useState("");
  const [importDatasetFile, setImportDatasetFile] = useState<File | null>(null);
  const [exportIncludeDatasets, setExportIncludeDatasets] = useState(true);
  const [exportFormat, setExportFormat] = useState<"json" | "zip">("json");
  const [exportScope, setExportScope] = useState<"project" | "dataset">("project");
  const [exportDatasetMode, setExportDatasetMode] = useState<
    "package" | "resources" | "searchset"
  >("package");
  const [exportDatasetId, setExportDatasetId] = useState<string | null>(null);

  useEffect(() => {
    if (typeof document === "undefined") return;
    document.title = "Projects";
  }, []);

  useEffect(() => {
    setDatasets(loadDatasets());
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const storedView = window.localStorage.getItem("health-compose-overview-viewmode");
    if (storedView === "projects" || storedView === "datasets") {
      setViewMode(storedView);
    }
    setViewModeLoaded(true);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!viewModeLoaded) return;
    window.localStorage.setItem("health-compose-overview-viewmode", viewMode);
  }, [viewMode, viewModeLoaded]);

  const packages = snapshot?.packages ?? [];
  const importHistory = snapshot?.state.importHistory ?? [];
  const currentTarget = snapshot?.state.currentTarget;

  const graph = useMemo(() => buildDependencyGraph(packages), [packages]);
  const exportDatasetOptions = useMemo(() => {
    if (!exportTarget) return [];
    return datasets
      .filter((entry) => entry.projectKey === exportTarget.key)
      .map((entry) => ({
        value: entry.id,
        label: entry.name,
        secondary: entry.id,
      }));
  }, [datasets, exportTarget]);

  useEffect(() => {
    if (!exportTarget) {
      setExportDatasetId(null);
      return;
    }
    const list = datasets.filter((entry) => entry.projectKey === exportTarget.key);
    if (list.length === 0) {
      setExportDatasetId(null);
      return;
    }
    if (!exportDatasetId || !list.some((entry) => entry.id === exportDatasetId)) {
      setExportDatasetId(list[0].id);
    }
  }, [datasets, exportTarget, exportDatasetId]);

  const targetKeys = useMemo(() => {
    const keys: string[] = [];
    const seen = new Set<string>();

    if (currentTarget) {
      const key = buildPackageKey(currentTarget.id, currentTarget.version);
      keys.push(key);
      seen.add(key);
    }

    for (const entry of importHistory) {
      if (!seen.has(entry.targetKey)) {
        keys.push(entry.targetKey);
        seen.add(entry.targetKey);
      }
    }

    return keys;
  }, [currentTarget, importHistory]);

  const targets = useMemo<ProjectEntry[]>(
    () => targetKeys.map((key) => ({ key, record: graph.byKey.get(key) })),
    [targetKeys, graph]
  );

  const dependenciesByTarget = useMemo(() => {
    const map = new Map<string, Set<string>>();
    for (const target of targets) {
      if (!target.record) continue;
      map.set(target.key, collectDependencies(target.key, graph));
    }
    return map;
  }, [targets, graph]);

  const dependencyOwners = useMemo(() => {
    const map = new Map<string, Set<string>>();
    for (const [targetKey, deps] of dependenciesByTarget) {
      for (const depKey of deps) {
        if (!map.has(depKey)) {
          map.set(depKey, new Set());
        }
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

  const normalizedFilter = filter.trim().toLowerCase();
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

  const deleteReasonFor = (projectKey: string) => {
    const dependents = dependentsByProject.get(projectKey);
    if (!dependents || dependents.size === 0) return undefined;
    return `Cannot delete while used by ${Array.from(dependents).sort().join(", ")}.`;
  };

  const openDatasetDialog = (project: PackageRecord) => {
    const defaultName = project.manifest.title ?? project.manifest.name ?? project.id;
    setSelectedProject(project);
    setSelectedProjectKey(project.key);
    setDatasetName(`${defaultName} Dataset`);
    setImportDatasetFile(null);
    setCreateDialogOpen(true);
  };

  const openImportDialog = (project: PackageRecord) => {
    const defaultName = project.manifest.title ?? project.manifest.name ?? project.id;
    setSelectedProject(project);
    setSelectedProjectKey(project.key);
    setDatasetName(`${defaultName} Dataset`);
    setImportDatasetFile(null);
    setImportDialogOpen(true);
  };

  const openDatasetDialogFromList = () => {
    setSelectedProject(null);
    setSelectedProjectKey(null);
    setDatasetName("");
    setImportDatasetFile(null);
    setCreateDialogOpen(true);
  };

  const openExportDialog = (project: PackageRecord) => {
    setExportTarget(project);
    setExportScope("project");
    setExportIncludeDatasets(true);
    setExportFormat("json");
    setExportDatasetMode("package");
    const firstDataset = datasets.find((entry) => entry.projectKey === project.key);
    setExportDatasetId(firstDataset?.id ?? null);
    setExportDialogOpen(true);
  };

  const handleProjectSelection = (projectKey: string) => {
    if (!projectKey) {
      setSelectedProject(null);
      setSelectedProjectKey(null);
      return;
    }
    const project = projectByKey.get(projectKey) ?? null;
    setSelectedProject(project);
    setSelectedProjectKey(projectKey);
    if (project && !datasetName.trim()) {
      const defaultName = project.manifest.title ?? project.manifest.name ?? project.id;
      setDatasetName(`${defaultName} Dataset`);
    }
  };

  const handleCreateDataset = () => {
    if (!selectedProject) {
      toast.error("Select a project for this dataset.");
      return;
    }
    const name = datasetName.trim();
    if (!name) {
      toast.error("Dataset name is required.");
      return;
    }
    const dataset: DatasetRecord = {
      id: createDatasetId(),
      name,
      projectKey: selectedProject.key,
      createdAt: Date.now(),
    };
    const next = upsertDataset(dataset);
    saveDatasetResources(dataset.id, []);
    setDatasets(next);
    setCreateDialogOpen(false);
    toast.success("Dataset created.");
  };

  const handleImportDataset = async () => {
    if (!selectedProject) {
      toast.error("Select a project for this dataset.");
      return;
    }
    if (!importDatasetFile) {
      toast.error("Choose a dataset file to import.");
      return;
    }
    try {
      const parseImportFile = async (file: File) => {
        const lower = file.name.toLowerCase();
        const isZip =
          lower.endsWith(".zip") || file.type === "application/zip" || file.type === "application/x-zip-compressed";
        if (!isZip) {
          const text = await file.text();
          return JSON.parse(text);
        }
        const zip = await JSZip.loadAsync(file);
        const jsonEntry = Object.values(zip.files).find(
          (entry) => !entry.dir && entry.name.toLowerCase().endsWith(".json")
        );
        if (!jsonEntry) {
          throw new Error("ZIP does not contain a JSON dataset file.");
        }
        const text = await jsonEntry.async("text");
        return JSON.parse(text);
      };

      const parsed = (await parseImportFile(importDatasetFile)) as
        | { name?: string; id?: string; resources?: unknown[] }
        | { datasets?: Array<{ name?: string; id?: string; resources?: unknown[] }> }
        | { resourceType?: string; type?: string; entry?: Array<{ resource?: unknown }> }
        | unknown[];

      let importedName: string | undefined;
      let importedId: string | undefined;
      let importedResources: unknown[] | undefined;

      if (Array.isArray(parsed)) {
        importedResources = parsed;
      } else if (
        parsed &&
        typeof parsed === "object" &&
        Array.isArray((parsed as { datasets?: Array<{ name?: string; id?: string }> }).datasets)
      ) {
        const first = (parsed as { datasets?: Array<{ name?: string; id?: string; resources?: unknown[] }> }).datasets?.[0];
        importedName = first?.name;
        importedId = first?.id;
        importedResources = first?.resources;
      } else if (
        parsed &&
        typeof parsed === "object" &&
        (parsed as { resourceType?: string }).resourceType === "Bundle" &&
        (parsed as { type?: string }).type === "searchset"
      ) {
        const entries = (parsed as { entry?: Array<{ resource?: unknown }> }).entry ?? [];
        importedResources = entries.map((entry) => entry.resource).filter(Boolean) as unknown[];
      } else {
        importedName = (parsed as { name?: string }).name;
        importedId = (parsed as { id?: string }).id;
        importedResources = (parsed as { resources?: unknown[] }).resources;
      }

      const name = (importedName ?? datasetName).trim();
      if (!name) {
        toast.error("Dataset name is missing in the import file.");
        return;
      }

      const dataset: DatasetRecord = {
        id: importedId ?? createDatasetId(),
        name,
        projectKey: selectedProject.key,
        createdAt: Date.now(),
      };
      const resources = hydrateDatasetResources(Array.isArray(importedResources) ? importedResources : []);
      saveDatasetResources(dataset.id, resources);
      const next = upsertDataset(dataset);
      setDatasets(next);
      setImportDialogOpen(false);
      setImportDatasetFile(null);
      toast.success("Dataset imported.");
    } catch (error) {
      toast.error("Failed to import dataset file.");
      console.error(error);
    }
  };

  const handleDeleteDataset = (dataset: DatasetRecord) => {
    const ok = window.confirm(`Delete dataset \"${dataset.name}\"? This cannot be undone.`);
    if (!ok) return;
    clearDatasetResources(dataset.id);
    const next = removeDataset(dataset.id);
    setDatasets(next);
    toast.success("Dataset deleted.");
  };

  const handleDeleteProject = async (project: PackageRecord) => {
    if (!canDeleteProject(project.key)) {
      toast.error("This project is required by other projects.");
      return;
    }
    const ok = window.confirm(
      `Delete project \"${project.id}@${project.version}\"? This removes stored resources.`
    );
    if (!ok) return;
    await deletePackage(project.key);
    const datasetIds = datasets
      .filter((dataset) => dataset.projectKey === project.key)
      .map((dataset) => dataset.id);
    for (const datasetId of datasetIds) {
      clearDatasetResources(datasetId);
    }
    const next = removeDatasetsForProject(project.key);
    setDatasets(next);
    toast.success("Project deleted.");
  };

  const buildSearchsetBundle = (entries: unknown[]) => ({
    resourceType: "Bundle",
    type: "searchset",
    total: entries.length,
    entry: entries.map((resource) => ({ resource })),
  });

  const exportDatasetWithMode = async (
    dataset: DatasetRecord,
    mode: "package" | "resources" | "searchset"
  ) => {
    const resources = loadDatasetResources(dataset.id).map((entry) => entry.content);
    const safeName = toSafeFilename(dataset.name) || "dataset";
    let payload: unknown;
    let filename = `${safeName}.json`;
    let zipName = `${safeName}.zip`;

    if (mode === "package") {
      payload = {
        id: dataset.id,
        name: dataset.name,
        projectKey: dataset.projectKey,
        resources,
      };
      filename = `${safeName}.json`;
      zipName = `${safeName}.zip`;
    } else if (mode === "resources") {
      payload = resources;
      filename = `${safeName}-resources.json`;
      zipName = `${safeName}-resources.zip`;
    } else {
      payload = buildSearchsetBundle(resources);
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

  const handleExportDataset = (dataset: DatasetRecord) => {
    exportDatasetWithMode(dataset, "package");
  };

  const prepareProjectExport = async (
    project: PackageRecord,
    includeDatasets: boolean
  ): Promise<{
    projectKeys: Set<string>;
    exportPackages: ComposePackageExport[];
    exportDatasets: ComposeDatasetExport[];
  } | null> => {
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
          .filter((dataset) => projectKeys.has(dataset.projectKey))
          .map((dataset) => ({
            id: dataset.id,
            name: dataset.name,
            projectKey: dataset.projectKey,
            resources: loadDatasetResources(dataset.id).map((entry) => entry.content),
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

    const datasetEntries = prepared.exportDatasets.map((dataset, index) => {
      const baseName = toSafeFilename(dataset.id ?? dataset.name) || `dataset-${index + 1}`;
      const filename = `${baseName}.json`;
      datasetsFolder?.file(filename, JSON.stringify(dataset, null, 2));
      return {
        id: dataset.id,
        name: dataset.name,
        projectKey: dataset.projectKey,
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

  const handleExportProjectConfirm = async () => {
    if (!exportTarget) return;
    if (exportFormat === "json") {
      await exportProjectAsJson(exportTarget, exportIncludeDatasets);
    } else {
      await exportProjectAsZip(exportTarget, exportIncludeDatasets);
    }
    setExportDialogOpen(false);
    setExportTarget(null);
  };

  const handleExportConfirm = async () => {
    if (!exportTarget) return;
    if (exportScope === "dataset") {
      const dataset = datasets.find((entry) => entry.id === exportDatasetId);
      if (!dataset) {
        toast.error("No dataset selected.");
        return;
      }
      await exportDatasetWithMode(dataset, exportDatasetMode);
      setExportDialogOpen(false);
      setExportTarget(null);
      return;
    }

    await handleExportProjectConfirm();
  };

  const handleDeleteAllData = async () => {
    const ok = window.confirm(
      "Delete all locally stored data? This removes imported projects, resources, and datasets."
    );
    if (!ok) return;
    await clearAllData();
    for (const dataset of datasets) {
      clearDatasetResources(dataset.id);
    }
    clearDatasets();
    setDatasets([]);
    setSelectedProject(null);
    setSelectedProjectKey(null);
    toast.success("Local data cleared.");
  };

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-10">
      <header className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground">
              Editor
            </p>
            <h1 className="text-3xl font-semibold text-foreground">Projects Overview</h1>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="ghost" onClick={() => void refresh()}>
              Refresh
            </Button>
          </div>
        </div>
        <p className="max-w-3xl text-sm text-muted-foreground">
          Review imported target packages, inspect dependencies, and start datasets. Open a
          dataset to compose resources with profile-driven forms.
        </p>
      </header>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-foreground">
            {viewMode === "projects" ? "Project Overview" : "Dataset Overview"}
          </h2>
          <p className="text-sm text-muted-foreground">
            {viewMode === "projects"
              ? "Review imported target projects and their dependencies."
              : "Manage datasets and see which project they belong to."}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button asChild size="sm" variant="outline">
            <Link href="/importer">Import Project</Link>
          </Button>
          <Button
            size="sm"
            variant="secondary"
            disabled={projectOptions.length === 0}
            onClick={openDatasetDialogFromList}
          >
            Create dataset
          </Button>
          <Button
            size="icon-sm"
            variant="outline"
            aria-label="Settings"
            onClick={() => setSettingsDialogOpen(true)}
          >
            <Settings className="size-4" />
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Input
          id="project-filter"
          value={filter}
          onChange={(event) => setFilter(event.target.value)}
          placeholder="Filter"
          className="h-8 max-w-xs"
        />
        <div className="flex items-center gap-2">
          <div className="h-6 w-px bg-border" />
          <Button
            size="icon-sm"
            variant={viewMode === "projects" ? "secondary" : "outline"}
            onClick={() => setViewMode("projects")}
            aria-label="Project view"
          >
            <LayoutGrid className="size-4" />
          </Button>
          <Button
            size="icon-sm"
            variant={viewMode === "datasets" ? "secondary" : "outline"}
            onClick={() => setViewMode("datasets")}
            aria-label="Dataset view"
          >
            <Database className="size-4" />
          </Button>
        </div>
      </div>

      {viewMode === "projects" ? (
        <>
          <section className="grid gap-4">
            {filteredTargets.length === 0 ? (
              <Card className="border-dashed border-foreground/20">
                <CardHeader>
                  <CardTitle>No targets yet</CardTitle>
                  <CardDescription>
                    Import a target package to start building datasets and dependencies.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button asChild>
                    <Link href="/importer">Go to Importer</Link>
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {filteredTargets.map((target) =>
                  target.record ? (
                    <ProjectCard
                      key={target.key}
                      kind="Target"
                      project={target.record}
                      dependencyCount={dependenciesByTarget.get(target.key)?.size ?? 0}
                      datasets={datasetsByProject.get(target.key) ?? []}
                      onCreateDataset={openDatasetDialog}
                      onImportDataset={openImportDialog}
                      onOpenExportDialog={openExportDialog}
                      onExportDataset={handleExportDataset}
                      onDeleteDataset={handleDeleteDataset}
                      onDeleteProject={handleDeleteProject}
                      canDeleteProject={canDeleteProject(target.key)}
                      deleteReason={deleteReasonFor(target.key)}
                    />
                  ) : (
                    <Card key={target.key} className="border-destructive/40">
                      <CardHeader>
                        <CardTitle className="text-lg">Missing target package</CardTitle>
                        <CardDescription>
                          {target.key} is in history but no longer available in storage.
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <Button asChild variant="outline">
                          <Link href="/importer">Re-import in Importer</Link>
                        </Button>
                      </CardContent>
                    </Card>
                  )
                )}
              </div>
            )}
          </section>

          <section className="grid gap-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold text-foreground">Dependency Projects</h2>
                <p className="text-sm text-muted-foreground">
                  Packages pulled in to satisfy target dependencies.
                </p>
              </div>
            </div>

            {filteredDependencies.length === 0 ? (
              <Card className="border-dashed border-foreground/20">
                <CardHeader>
                  <CardTitle>No dependencies to show</CardTitle>
                  <CardDescription>
                    Import a target with dependencies or clear the filter to see more.
                  </CardDescription>
                </CardHeader>
              </Card>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {filteredDependencies.map((project) => (
                  <ProjectCard
                    key={project.key}
                    kind="Dependency"
                    project={project}
                    owners={Array.from(dependencyOwners.get(project.key) ?? []).sort()}
                    datasets={datasetsByProject.get(project.key) ?? []}
                    onCreateDataset={openDatasetDialog}
                    onImportDataset={openImportDialog}
                    onOpenExportDialog={openExportDialog}
                    onExportDataset={handleExportDataset}
                    onDeleteDataset={handleDeleteDataset}
                    onDeleteProject={handleDeleteProject}
                    canDeleteProject={canDeleteProject(project.key)}
                    deleteReason={deleteReasonFor(project.key)}
                  />
                ))}
              </div>
            )}
          </section>
        </>
      ) : (
        <section className="grid gap-4">
          {filteredDatasets.length === 0 ? (
            <Card className="border-dashed border-foreground/20">
              <CardHeader>
                <CardTitle>No datasets to show</CardTitle>
                <CardDescription>
                  Create or import datasets from a project card to populate this view.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                <Button asChild size="sm" variant="outline">
                  <Link href="/importer">Import Project</Link>
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={projectOptions.length === 0}
                  onClick={openDatasetDialogFromList}
                >
                  Create dataset
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {filteredDatasets.map((dataset) => {
                const project = projectByKey.get(dataset.projectKey);
                return (
                  <Card key={dataset.id} className="border-foreground/10">
                    <CardHeader>
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <CardTitle className="text-lg">{dataset.name}</CardTitle>
                          <CardDescription>{dataset.projectKey}</CardDescription>
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button size="icon-sm" variant="ghost" aria-label="Dataset actions">
                              <MoreHorizontal className="size-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleExportDataset(dataset)}>
                              Export dataset
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              variant="destructive"
                              onClick={() => handleDeleteDataset(dataset)}
                            >
                              Delete dataset
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </CardHeader>
                    <CardContent className="grid gap-3">
                      <div className="text-xs text-muted-foreground">
                        <div>Created: {formatTimestamp(dataset.createdAt)}</div>
                        <div>
                          Project:{" "}
                          {project?.manifest.title ??
                            project?.manifest.name ??
                            project?.id ??
                            "Unknown"}
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Button asChild size="sm" variant="secondary">
                          <Link href={`/${dataset.id}`}>Open</Link>
                        </Button>
                        {project ? (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openExportDialog(project)}
                          >
                            Export project
                          </Button>
                        ) : null}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </section>
      )}

      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create dataset</DialogTitle>
            <DialogDescription>
              Create a dataset shell for {selectedProject?.id ?? "this project"} and start
              composing resources.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid gap-2">
              <Label htmlFor="dataset-project">Project</Label>
              <select
                id="dataset-project"
                value={selectedProjectKey ?? ""}
                onChange={(event) => handleProjectSelection(event.target.value)}
                className="h-9 rounded-md border border-foreground/20 bg-background px-3 text-sm"
              >
                <option value="">Select project</option>
                {projectOptions.map((project) => (
                  <option key={project.key} value={project.key}>
                    {project.id}@{project.version}
                  </option>
                ))}
              </select>
              <p className="text-xs text-muted-foreground">
                Choose the project this dataset belongs to.
              </p>
            </div>
            <Label htmlFor="dataset-name">Dataset name</Label>
            <Input
              id="dataset-name"
              value={datasetName}
              onChange={(event) => setDatasetName(event.target.value)}
              placeholder="Project dataset"
            />
            <p className="text-xs text-muted-foreground">
              Use this when you want to create a brand new dataset.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateDataset}>
              Create dataset
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Import dataset</DialogTitle>
            <DialogDescription>
              Import a dataset JSON for {selectedProject?.id ?? "this project"}.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid gap-2">
              <Label htmlFor="dataset-import-project">Project</Label>
              <select
                id="dataset-import-project"
                value={selectedProjectKey ?? ""}
                onChange={(event) => handleProjectSelection(event.target.value)}
                className="h-9 rounded-md border border-foreground/20 bg-background px-3 text-sm"
              >
                <option value="">Select project</option>
                {projectOptions.map((project) => (
                  <option key={project.key} value={project.key}>
                    {project.id}@{project.version}
                  </option>
                ))}
              </select>
              <p className="text-xs text-muted-foreground">
                Choose the project this dataset belongs to.
              </p>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="dataset-import">Dataset file (.json)</Label>
              <Input
                id="dataset-import"
                type="file"
                accept=".json,.zip,application/json,application/zip"
                onChange={(event) => setImportDatasetFile(event.target.files?.[0] ?? null)}
              />
              <p className="text-xs text-muted-foreground">
                Supports JSON/ZIP dataset exports, resource lists, or FHIR searchset bundles.
              </p>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="dataset-import-name">Fallback name (optional)</Label>
              <Input
                id="dataset-import-name"
                value={datasetName}
                onChange={(event) => setDatasetName(event.target.value)}
                placeholder="Project dataset"
              />
              <p className="text-xs text-muted-foreground">
                Used only if the import file does not include a name.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setImportDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="secondary" onClick={handleImportDataset}>
              Import dataset
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ExportDialog
        open={exportDialogOpen}
        onOpenChange={(open) => {
          setExportDialogOpen(open);
          if (!open) {
            setExportTarget(null);
          }
        }}
        title="Export project"
        description={`Export ${exportTarget?.id ?? "this project"} or one of its datasets.`}
        scope={exportScope}
        scopeOptions={[
          {
            value: "project",
            label: "Project + dependencies",
          },
          {
            value: "dataset",
            label: "Dataset only",
            disabled: exportDatasetOptions.length === 0,
            helper:
              exportDatasetOptions.length === 0
                ? "No datasets available for this project."
                : undefined,
          },
        ]}
        onScopeChange={setExportScope}
        exportFormat={exportFormat}
        onExportFormatChange={setExportFormat}
        datasetMode={exportDatasetMode}
        onDatasetModeChange={setExportDatasetMode}
        datasetOptions={exportDatasetOptions}
        selectedDataset={exportDatasetId}
        onDatasetChange={setExportDatasetId}
        includeDatasets={exportIncludeDatasets}
        onIncludeDatasetsChange={setExportIncludeDatasets}
        confirmLabel={exportScope === "dataset" ? "Export dataset" : "Export project"}
        confirmDisabled={
          !exportTarget || (exportScope === "dataset" && !exportDatasetId)
        }
        onConfirm={handleExportConfirm}
      />

      <Dialog open={settingsDialogOpen} onOpenChange={setSettingsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Settings</DialogTitle>
            <DialogDescription>
              Manage locally stored data for this browser.
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-lg border border-foreground/10 bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
            Deleting data removes imported packages, dependency metadata, cached resources, and
            all datasets saved in this browser.
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSettingsDialogOpen(false)}>
              Close
            </Button>
            <Button variant="destructive" onClick={handleDeleteAllData}>
              Delete all local data
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
