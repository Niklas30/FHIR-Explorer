"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/components/i18n/I18nProvider";
import { useImporter } from "@/components/importer/useImporter";
import type { PackageRecord } from "@/lib/fhir-importer/types";
import type { DatasetRecord } from "@/lib/datasets/storage";
import { clearDatasets, loadDatasets, upsertDataset } from "@/lib/datasets/storage";
import { clearAllDatasetResources } from "@/lib/datasets/content";
import { byLocale } from "@/lib/i18n/select";
import { toast } from "sonner";
import { logger } from "@/lib/logger";
import { EditorOverviewLayout } from "@/components/overview/EditorOverviewLayout";
import { AuthoredProjectsSection } from "@/components/overview/AuthoredProjectsSection";
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

export default function EditorOverviewPage() {
  const router = useRouter();
  const { locale } = useI18n();
  const text = byLocale(locale, localizedOverviewText);
  const { snapshot, refresh, deletePackage, getResourcePayloadsByPackageKeys, clearAllData } = useImporter();

  const [filter, setFilter] = useState("");
  const { viewMode, setViewMode } = usePersistedViewMode("health-compose-overview-viewmode");
  const [datasets, setDatasets] = useState<DatasetRecord[]>([]);

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
  } = useOverviewDerived({ snapshot, datasets, filter });

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
    const project = projectByKey.get(projectKey) ?? null;
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

  const openDependencyTree = (project: PackageRecord) => {
    setDependencyTreeRootKey(project.key);
  };

  const openProjectInEditor = (project: PackageRecord) => {
    router.push(`/project/${encodeURIComponent(project.key)}`);
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
    const next = upsertDataset(nextDataset);
    setDatasets(next);
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

  const handleExportDataset = async (dataset: DatasetRecord) => {
    await exportDatasetAction({ dataset, mode: "package", exportFormat, text });
  };

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

  const handleDeleteDataset = (dataset: DatasetRecord) => {
    deleteDatasetAction({ dataset, text, setDatasets });
  };

  const handleDuplicateDataset = (dataset: DatasetRecord) => {
    duplicateDatasetAction({
      dataset,
      datasets,
      isProjectDatasetSelectable,
      text,
      setDatasets,
    });
  };

  const handleDeleteProject = async (project: PackageRecord) => {
    await deleteProjectAction({
      project,
      canDeleteProject,
      text,
      deletePackage,
      datasets,
      setDatasets,
    });
  };

  const handleExportConfirm = async () => {
    if (!exportTarget) return;
    if (exportScope === "dataset") {
      const dataset = datasets.find((entry) => entry.id === exportDatasetId);
      if (!dataset) {
        toast.error(text.noDatasetSelected);
        return;
      }
      await exportDatasetAction({
        dataset,
        mode: exportDatasetMode,
        exportFormat,
        text,
      });
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

  const handleExportDialogOpenChange = (open: boolean) => {
    setExportDialogOpen(open);
    if (!open) setExportTarget(null);
  };

  const handleDatasetInfoOpenChange = (open: boolean) => {
    setDatasetInfoOpen(open);
    if (!open) setDatasetInfoId(null);
  };

  const selectedProjectId = selectedProject?.id;

  return (
    <EditorOverviewLayout
      text={text as OverviewText}
      filter={filter}
      onFilterChange={setFilter}
      viewMode={viewMode}
      onViewModeChange={setViewMode}
      selectableProjectOptions={selectableProjectOptions}
      onCreateDatasetFromList={openDatasetDialogFromList}
      onOpenSettings={() => setSettingsDialogOpen(true)}
      onRefresh={() => void refresh()}
      targets={filteredTargets}
      filteredDependencies={filteredDependencies}
      datasets={filteredDatasets}
      projectByKey={projectByKey}
      datasetsByProject={datasetsByProject}
      dependenciesByTarget={dependenciesByTarget}
      dependencyOwners={dependencyOwners}
      currentTargetKey={currentTargetKey}
      currentTargetImportInProgress={currentTargetImportInProgress}
      isProjectDatasetSelectable={isProjectDatasetSelectable}
      onCreateDataset={openDatasetDialog}
      onImportDataset={openImportDialog}
      onOpenDependencyTree={openDependencyTree}
      onOpenInProjectEditor={openProjectInEditor}
      onOpenExportDialog={openExportDialog}
      onExportDataset={(dataset) => void handleExportDataset(dataset)}
      onOpenDatasetInfo={handleOpenDatasetInfo}
      onDuplicateDataset={handleDuplicateDataset}
      onDeleteDataset={handleDeleteDataset}
      onDeleteProject={(project) => void handleDeleteProject(project)}
      canDeleteProject={canDeleteProject}
      deleteReasonFor={deleteReasonFor}
      createDialogOpen={createDialogOpen}
      onCreateDialogOpenChange={setCreateDialogOpen}
      importDialogOpen={importDialogOpen}
      onImportDialogOpenChange={setImportDialogOpen}
      selectedProjectKey={selectedProjectKey}
      selectedProjectId={selectedProjectId}
      datasetName={datasetName}
      onDatasetNameChange={setDatasetName}
      onSelectedProjectKeyChange={handleProjectSelection}
      importDatasetFile={importDatasetFile}
      onImportDatasetFileChange={setImportDatasetFile}
      onConfirmCreateDataset={handleConfirmCreateDataset}
      onConfirmImportDataset={() => void handleConfirmImportDataset()}
      exportDialogOpen={exportDialogOpen}
      onExportDialogOpenChange={handleExportDialogOpenChange}
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
      onDatasetInfoOpenChange={handleDatasetInfoOpenChange}
      datasetInfoDataset={datasetInfoDataset}
      datasetInfoProjectSuggestions={datasetInfoProjectSuggestions}
      onSaveDatasetInfo={handleSaveDatasetInfo}
      settingsOpen={settingsDialogOpen}
      onSettingsOpenChange={setSettingsDialogOpen}
      onDeleteAllData={() => void handleDeleteAllData()}
      authoredProjectsSlot={
        <AuthoredProjectsSection availablePackages={snapshot?.packages ?? []} />
      }
    />
  );
}
