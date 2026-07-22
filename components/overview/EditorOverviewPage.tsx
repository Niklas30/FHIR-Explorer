"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/components/i18n/I18nProvider";
import { useImporter } from "@/components/importer/useImporter";
import type { PackageRecord } from "@/lib/fhir-importer/types";
import type { DatasetRecord } from "@/lib/datasets/storage";
import {
  clearDatasets,
  loadDatasets,
  removeDatasetsForProject,
  upsertDataset,
} from "@/lib/datasets/storage";
import { clearAllDatasetResources, clearDatasetResources } from "@/lib/datasets/content";
import { byLocale } from "@/lib/i18n/select";
import { toast } from "sonner";
import { logger } from "@/lib/logger";
import { EditorOverviewLayout } from "@/components/overview/EditorOverviewLayout";
import { NewProjectDialog } from "@/components/overview/dialogs/NewProjectDialog";
import type { OverviewViewMode, OverviewText } from "@/components/overview/types";
import {
  createDatasetAction,
  deleteDatasetAction,
  deleteProjectAction,
  duplicateDatasetAction,
  exportDatasetAction,
  importDatasetAction,
} from "@/components/overview/datasetActions";
import { exportProject } from "@/components/overview/exportActions";
import { formatText } from "@/components/overview/utils";
import { localizedOverviewText } from "@/components/overview/text";
import { useOverviewDerived } from "@/components/overview/useOverviewDerived";
import { useAuthoredProjects } from "@/components/overview/useAuthoredProjects";
import { removeProject } from "@/lib/projects/storage";
import { clearProjectResources, loadProjectResources } from "@/lib/projects/content";
import { exportAuthoredProject } from "@/components/project-editor/project-editor/exportProject";
import type { AuthoredProjectRecord } from "@/lib/projects/types";

const usePersistedViewMode = (storageKey: string) => {
  const [viewMode, setViewMode] = useState<OverviewViewMode>("projects");
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const storedView = window.localStorage.getItem(storageKey);
    if (storedView === "projects" || storedView === "datasets") {
      setViewMode(storedView);
    }
    setLoaded(true);
  }, [storageKey]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!loaded) return;
    window.localStorage.setItem(storageKey, viewMode);
  }, [loaded, storageKey, viewMode]);

  return { viewMode, setViewMode };
};

/** An authored project rendered through the shared imported-project machinery. */
const authoredAsRecord = (project: AuthoredProjectRecord): PackageRecord => ({
  key: project.key,
  id: project.id,
  version: project.version,
  manifest: project.manifest,
  addedAt: project.updatedAt,
  resourceCount: 0,
});

export default function EditorOverviewPage() {
  const router = useRouter();
  const { locale } = useI18n();
  const text = byLocale(locale, localizedOverviewText);
  const { snapshot, refresh, deletePackage, getResourcePayloadsByPackageKeys, clearAllData } = useImporter();
  const availablePackages = useMemo(() => snapshot?.packages ?? [], [snapshot]);

  const [filter, setFilter] = useState("");
  const { viewMode, setViewMode } = usePersistedViewMode("fhir-explorer-overview-viewmode");
  const [datasets, setDatasets] = useState<DatasetRecord[]>([]);
  const authored = useAuthoredProjects(text.projectDuplicated);

  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [settingsDialogOpen, setSettingsDialogOpen] = useState(false);

  const [selectedProject, setSelectedProject] = useState<PackageRecord | null>(null);
  const [selectedProjectKey, setSelectedProjectKey] = useState<string | null>(null);
  const [datasetName, setDatasetName] = useState("");
  const [importDatasetFile, setImportDatasetFile] = useState<File | null>(null);

  const [exportTarget, setExportTarget] = useState<PackageRecord | null>(null);
  const [exportIncludeDatasets, setExportIncludeDatasets] = useState(true);
  const [exportFormat, setExportFormat] = useState<"json" | "zip">("json");
  const [exportScope, setExportScope] = useState<"project" | "dataset">("project");
  const [exportDatasetMode, setExportDatasetMode] = useState<"package" | "resources" | "searchset">(
    "package"
  );
  const [exportDatasetId, setExportDatasetId] = useState<string | null>(null);

  const [dependencyTreeRootKey, setDependencyTreeRootKey] = useState<string | null>(null);
  const [datasetInfoOpen, setDatasetInfoOpen] = useState(false);
  const [datasetInfoId, setDatasetInfoId] = useState<string | null>(null);

  useEffect(() => {
    setDatasets(loadDatasets());
  }, []);

  const {
    graph,
    projectByKey,
    selectableProjectOptions: importedSelectable,
    datasetInfoProjectSuggestions: importedSuggestions,
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
  } = useOverviewDerived({ snapshot, datasets, filter });

  const normalizedFilter = filter.trim().toLowerCase();
  const filteredAuthored = useMemo(() => {
    if (!normalizedFilter) return authored.projects;
    return authored.projects.filter((project) =>
      [project.id, project.key, project.manifest.title]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(normalizedFilter)
    );
  }, [authored.projects, normalizedFilter]);

  // Authored projects render first, then imported targets — one unified list.
  const combinedTargets = useMemo(
    () => [
      ...filteredAuthored.map((project) => ({ key: project.key, record: authoredAsRecord(project) })),
      ...filteredTargets,
    ],
    [filteredAuthored, filteredTargets]
  );

  const selectableProjectOptions = useMemo(
    () => [...authored.projects.map(authoredAsRecord), ...importedSelectable],
    [authored.projects, importedSelectable]
  );

  const selectableByKey = useMemo(() => {
    const map = new Map<string, PackageRecord>();
    for (const project of selectableProjectOptions) map.set(project.key, project);
    return map;
  }, [selectableProjectOptions]);

  const datasetInfoProjectSuggestions = useMemo(
    () => [
      ...authored.projects.map((project) => ({
        key: project.key,
        label: `${project.id}@${project.version}`,
      })),
      ...importedSuggestions,
    ],
    [authored.projects, importedSuggestions]
  );

  const deleteReasonFor = (projectKey: string) => {
    const dependents = dependentsByProject.get(projectKey);
    if (!dependents || dependents.size === 0) return undefined;
    return formatText(text.cannotDeleteUsedBy, {
      projects: Array.from(dependents).sort().join(", "),
    });
  };

  const handleProjectSelection = (projectKey: string) => {
    if (!projectKey) {
      setSelectedProject(null);
      setSelectedProjectKey(null);
      return;
    }
    const project = selectableByKey.get(projectKey) ?? null;
    setSelectedProject(project);
    setSelectedProjectKey(projectKey);
    if (project && !datasetName.trim()) {
      const defaultName = project.manifest.title ?? project.manifest.name ?? project.id;
      setDatasetName(`${defaultName} ${text.datasetSuffix}`);
    }
  };

  const openDatasetDialogFromList = () => {
    setSelectedProject(null);
    setSelectedProjectKey(null);
    setDatasetName("");
    setImportDatasetFile(null);
    setCreateDialogOpen(true);
  };

  const openDatasetDialog = (project: PackageRecord) => {
    const defaultName = project.manifest.title ?? project.manifest.name ?? project.id;
    setSelectedProject(project);
    setSelectedProjectKey(project.key);
    setDatasetName(`${defaultName} ${text.datasetSuffix}`);
    setImportDatasetFile(null);
    setCreateDialogOpen(true);
  };

  const openImportDialog = (project: PackageRecord) => {
    const defaultName = project.manifest.title ?? project.manifest.name ?? project.id;
    setSelectedProject(project);
    setSelectedProjectKey(project.key);
    setDatasetName(`${defaultName} ${text.datasetSuffix}`);
    setImportDatasetFile(null);
    setImportDialogOpen(true);
  };

  const openProjectInEditor = (project: PackageRecord) => {
    router.push(`/project/${encodeURIComponent(project.key)}`);
  };

  const openExportDialog = async (project: PackageRecord) => {
    if (authored.keys.has(project.key)) {
      const source = authored.projects.find((entry) => entry.key === project.key);
      if (!source) return;
      const resources = await loadProjectResources(project.key);
      await exportAuthoredProject({
        project: source,
        resources,
        datasets: datasets.filter((entry) => entry.projectKey === project.key),
        graph,
        getResourcePayloadsByPackageKeys,
      });
      toast.success(text.projectExported);
      return;
    }
    setExportTarget(project);
    setExportScope("project");
    setExportIncludeDatasets(true);
    setExportFormat("json");
    setExportDatasetMode("package");
    const firstDataset = datasets.find((entry) => entry.projectKey === project.key);
    setExportDatasetId(firstDataset?.id ?? null);
    setExportDialogOpen(true);
  };

  const handleOpenDatasetInfo = (dataset: DatasetRecord) => {
    if (!isProjectDatasetSelectable(dataset.projectKey)) {
      toast.error(text.datasetActionsBlockedUntilImportComplete);
      return;
    }
    setDatasetInfoId(dataset.id);
    setDatasetInfoOpen(true);
  };

  const datasetInfoDataset = useMemo(() => {
    if (!datasetInfoId) return null;
    return datasets.find((entry) => entry.id === datasetInfoId) ?? null;
  }, [datasets, datasetInfoId]);

  const handleSaveDatasetInfo = (payload: { id: string; name: string; projectKey: string }) => {
    const existing = datasets.find((entry) => entry.id === payload.id);
    if (!existing) return;
    const nextDataset: DatasetRecord = { ...existing, name: payload.name, projectKey: payload.projectKey };
    setDatasets(upsertDataset(nextDataset));
  };

  const exportDatasetOptions = useMemo(() => {
    if (!exportTarget) return [];
    return datasets
      .filter((entry) => entry.projectKey === exportTarget.key)
      .map((entry) => ({ value: entry.id, label: entry.name, secondary: entry.id }));
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

  const handleConfirmCreateDataset = () => {
    createDatasetAction({
      selectedProject,
      datasetName,
      isProjectDatasetSelectable,
      text,
      setDatasets,
      onClose: () => setCreateDialogOpen(false),
    });
  };

  const handleConfirmImportDataset = async () => {
    await importDatasetAction({
      selectedProject,
      datasetName,
      importDatasetFile,
      isProjectDatasetSelectable,
      text,
      setDatasets,
      onClose: () => setImportDialogOpen(false),
      onClearImportFile: () => setImportDatasetFile(null),
    });
  };

  const handleDeleteProject = async (project: PackageRecord) => {
    if (authored.keys.has(project.key)) {
      const ok = window.confirm(
        formatText(text.confirmDeleteProject, { project: `${project.id}@${project.version}` })
      );
      if (!ok) return;
      removeProject(project.key);
      void clearProjectResources(project.key);
      for (const dataset of datasets.filter((entry) => entry.projectKey === project.key)) {
        clearDatasetResources(dataset.id);
      }
      setDatasets(removeDatasetsForProject(project.key));
      authored.refresh();
      toast.success(text.projectDeleted);
      return;
    }
    await deleteProjectAction({ project, canDeleteProject, text, deletePackage, datasets, setDatasets });
  };

  const handleExportConfirm = async () => {
    if (!exportTarget) return;
    if (exportScope === "dataset") {
      const dataset = datasets.find((entry) => entry.id === exportDatasetId);
      if (!dataset) {
        toast.error(text.noDatasetSelected);
        return;
      }
      await exportDatasetAction({ dataset, mode: exportDatasetMode, exportFormat, text });
      setExportDialogOpen(false);
      setExportTarget(null);
      return;
    }
    await exportProject({
      project: exportTarget,
      includeDatasets: exportIncludeDatasets,
      exportFormat,
      graph,
      datasets,
      getResourcePayloadsByPackageKeys,
      text,
    });
    setExportDialogOpen(false);
    setExportTarget(null);
  };

  const handleDeleteAllData = async () => {
    const ok = window.confirm(text.confirmDeleteAllData);
    if (!ok) return;
    try {
      await clearAllData();
      clearAllDatasetResources();
      clearDatasets();
      setDatasets([]);
      setSelectedProject(null);
      setSelectedProjectKey(null);
      toast.success(text.localDataCleared);
    } catch (error) {
      logger.error("Failed to clear local data", { error });
      toast.error(text.failedClearLocalData);
    }
  };

  return (
    <>
      <EditorOverviewLayout
        text={text as OverviewText}
        filter={filter}
        onFilterChange={setFilter}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        selectableProjectOptions={selectableProjectOptions}
        onCreateDatasetFromList={openDatasetDialogFromList}
        onNewProject={() => authored.setNewProjectOpen(true)}
        onOpenSettings={() => setSettingsDialogOpen(true)}
        onRefresh={() => void refresh()}
        targets={combinedTargets}
        filteredDependencies={filteredDependencies}
        datasets={filteredDatasets}
        projectByKey={projectByKey}
        datasetsByProject={datasetsByProject}
        authoredKeys={authored.keys}
        dependenciesByTarget={dependenciesByTarget}
        dependencyOwners={dependencyOwners}
        currentTargetKey={currentTargetKey}
        currentTargetImportInProgress={currentTargetImportInProgress}
        isProjectDatasetSelectable={isProjectDatasetSelectable}
        onCreateDataset={openDatasetDialog}
        onImportDataset={openImportDialog}
        onOpenDependencyTree={(project) => setDependencyTreeRootKey(project.key)}
        onOpenInProjectEditor={openProjectInEditor}
        onDuplicateProject={(project) => void authored.openDuplicate(project.key)}
        onOpenExportDialog={(project) => void openExportDialog(project)}
        onExportDataset={(dataset) => void exportDatasetAction({ dataset, mode: "package", exportFormat, text })}
        onOpenDatasetInfo={handleOpenDatasetInfo}
        onDuplicateDataset={(dataset) =>
          duplicateDatasetAction({ dataset, datasets, isProjectDatasetSelectable, text, setDatasets })
        }
        onDeleteDataset={(dataset) => deleteDatasetAction({ dataset, text, setDatasets })}
        onDeleteProject={(project) => void handleDeleteProject(project)}
        canDeleteProject={canDeleteProject}
        deleteReasonFor={deleteReasonFor}
        createDialogOpen={createDialogOpen}
        onCreateDialogOpenChange={setCreateDialogOpen}
        importDialogOpen={importDialogOpen}
        onImportDialogOpenChange={setImportDialogOpen}
        selectedProjectKey={selectedProjectKey}
        selectedProjectId={selectedProject?.id}
        datasetName={datasetName}
        onDatasetNameChange={setDatasetName}
        onSelectedProjectKeyChange={handleProjectSelection}
        importDatasetFile={importDatasetFile}
        onImportDatasetFileChange={setImportDatasetFile}
        onConfirmCreateDataset={handleConfirmCreateDataset}
        onConfirmImportDataset={() => void handleConfirmImportDataset()}
        exportDialogOpen={exportDialogOpen}
        onExportDialogOpenChange={(open) => {
          setExportDialogOpen(open);
          if (!open) setExportTarget(null);
        }}
        exportTarget={exportTarget}
        exportScope={exportScope}
        exportFormat={exportFormat}
        exportIncludeDatasets={exportIncludeDatasets}
        exportDatasetMode={exportDatasetMode}
        exportDatasetOptions={exportDatasetOptions}
        exportDatasetId={exportDatasetId}
        onExportScopeChange={setExportScope}
        onExportFormatChange={setExportFormat}
        onExportIncludeDatasetsChange={setExportIncludeDatasets}
        onExportDatasetModeChange={setExportDatasetMode}
        onExportDatasetChange={setExportDatasetId}
        onConfirmExport={() => void handleExportConfirm()}
        graph={graph}
        dependencyTreeRootKey={dependencyTreeRootKey}
        onDependencyTreeRootKeyChange={setDependencyTreeRootKey}
        datasetInfoOpen={datasetInfoOpen}
        onDatasetInfoOpenChange={(open) => {
          setDatasetInfoOpen(open);
          if (!open) setDatasetInfoId(null);
        }}
        datasetInfoDataset={datasetInfoDataset}
        datasetInfoProjectSuggestions={datasetInfoProjectSuggestions}
        onSaveDatasetInfo={handleSaveDatasetInfo}
        settingsOpen={settingsDialogOpen}
        onSettingsOpenChange={setSettingsDialogOpen}
        onDeleteAllData={() => void handleDeleteAllData()}
      />

      <NewProjectDialog
        open={authored.newProjectOpen}
        onOpenChange={authored.setNewProjectOpen}
        availablePackages={availablePackages}
        existingKeys={authored.keys}
        onCreate={authored.createFromManifest}
      />

      <NewProjectDialog
        open={Boolean(authored.duplicateSource)}
        onOpenChange={(open) => {
          if (!open) authored.setDuplicateSource(null);
        }}
        availablePackages={availablePackages}
        existingKeys={authored.keys}
        initialManifest={authored.duplicateSource?.manifest ?? null}
        isDuplicate
        onCreate={(manifest) => void authored.confirmDuplicate(manifest)}
      />
    </>
  );
}
