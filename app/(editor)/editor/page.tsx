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
import type { PackageRecord } from "@/lib/fhir-importer/types";
import { buildPackageKey, isExactVersion } from "@/lib/fhir-importer/utils";
import {
  loadDatasets,
  removeDataset,
  removeDatasetsForProject,
  upsertDataset,
  type DatasetRecord,
} from "@/lib/datasets/storage";
import { toast } from "sonner";
import { MoreHorizontal, Plus, Upload } from "lucide-react";

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

type ProjectCardProps = {
  kind: "Target" | "Dependency";
  project: PackageRecord;
  dependencyCount?: number;
  owners?: string[];
  datasets: DatasetRecord[];
  onCreateDataset: (project: PackageRecord) => void;
  onImportDataset: (project: PackageRecord) => void;
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
                Create datasets for this project. The editor is coming soon.
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
                      <Link href={`/editor/${dataset.id}`}>Open</Link>
                    </Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button size="icon-sm" variant="ghost" aria-label="Dataset actions">
                          <MoreHorizontal className="size-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
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
  const { snapshot, refresh, deletePackage } = useImporter();
  const [filter, setFilter] = useState("");
  const [datasets, setDatasets] = useState<DatasetRecord[]>([]);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [selectedProject, setSelectedProject] = useState<PackageRecord | null>(null);
  const [datasetName, setDatasetName] = useState("");
  const [importDatasetFile, setImportDatasetFile] = useState<File | null>(null);

  useEffect(() => {
    setDatasets(loadDatasets());
  }, []);

  const packages = snapshot?.packages ?? [];
  const importHistory = snapshot?.state.importHistory ?? [];
  const currentTarget = snapshot?.state.currentTarget;

  const graph = useMemo(() => buildDependencyGraph(packages), [packages]);

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

  const normalizedFilter = filter.trim().toLowerCase();
  const filteredTargets = targets.filter((target) =>
    matchesFilter(normalizedFilter, target.record, target.key)
  );
  const filteredDependencies = dependencyProjects.filter((project) =>
    matchesFilter(normalizedFilter, project, project.key)
  );

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
    setDatasetName(`${defaultName} Dataset`);
    setImportDatasetFile(null);
    setCreateDialogOpen(true);
  };

  const openImportDialog = (project: PackageRecord) => {
    const defaultName = project.manifest.title ?? project.manifest.name ?? project.id;
    setSelectedProject(project);
    setDatasetName(`${defaultName} Dataset`);
    setImportDatasetFile(null);
    setImportDialogOpen(true);
  };

  const handleCreateDataset = () => {
    if (!selectedProject) return;
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
    setDatasets(next);
      setCreateDialogOpen(false);
      toast.success("Dataset created. Editor coming soon.");
  };

  const handleImportDataset = async () => {
    if (!selectedProject) return;
    if (!importDatasetFile) {
      toast.error("Choose a dataset file to import.");
      return;
    }
    try {
      const text = await importDatasetFile.text();
      const parsed = JSON.parse(text) as
        | { name?: string; id?: string }
        | { datasets?: Array<{ name?: string; id?: string }> };

      let importedName: string | undefined;
      let importedId: string | undefined;

      if (Array.isArray((parsed as { datasets?: Array<{ name?: string; id?: string }> }).datasets)) {
        const first = (parsed as { datasets?: Array<{ name?: string; id?: string }> }).datasets?.[0];
        importedName = first?.name;
        importedId = first?.id;
      } else {
        importedName = (parsed as { name?: string }).name;
        importedId = (parsed as { id?: string }).id;
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
      const next = upsertDataset(dataset);
      setDatasets(next);
      setImportDialogOpen(false);
      setImportDatasetFile(null);
      toast.success("Dataset imported. Editor coming soon.");
    } catch (error) {
      toast.error("Failed to import dataset file.");
      console.error(error);
    }
  };

  const handleDeleteDataset = (dataset: DatasetRecord) => {
    const ok = window.confirm(`Delete dataset \"${dataset.name}\"? This cannot be undone.`);
    if (!ok) return;
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
    const next = removeDatasetsForProject(project.key);
    setDatasets(next);
    toast.success("Project deleted.");
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
          Review imported target packages, inspect dependencies, and start datasets. Dataset
          composition will arrive in a future update.
        </p>
      </header>

      <Card className="border-foreground/10">
        <CardHeader>
          <CardTitle className="text-lg">Filter Projects</CardTitle>
          <CardDescription>Search by name, id, or description.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          <Label htmlFor="project-filter">Filter</Label>
          <Input
            id="project-filter"
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
            placeholder="Search imported packages"
          />
        </CardContent>
      </Card>

      <section className="grid gap-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-foreground">Target Projects</h2>
            <p className="text-sm text-muted-foreground">
              Targets that were imported explicitly.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button asChild size="sm" variant="outline">
              <Link href="/importer">Import Project</Link>
            </Button>
          </div>
        </div>

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
              onDeleteDataset={handleDeleteDataset}
              onDeleteProject={handleDeleteProject}
              canDeleteProject={canDeleteProject(project.key)}
              deleteReason={deleteReasonFor(project.key)}
            />
          ))}
        </div>
      )}
      </section>

      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create dataset</DialogTitle>
            <DialogDescription>
              Create a dataset shell for {selectedProject?.id ?? "this project"}. The
              editor is not implemented yet.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
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
              <Label htmlFor="dataset-import">Dataset file (.json)</Label>
              <Input
                id="dataset-import"
                type="file"
                accept=".json,application/json"
                onChange={(event) => setImportDatasetFile(event.target.files?.[0] ?? null)}
              />
              <p className="text-xs text-muted-foreground">
                Accepts a JSON file with a {`{"name": "My Dataset"}`} object.
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
    </div>
  );
}
