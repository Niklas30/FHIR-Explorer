"use client";

import Link from "next/link";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Database, FolderPlus, LayoutGrid, Settings, Upload } from "lucide-react";
import type { PackageRecord } from "@/lib/fhir-importer/types";
import type { DatasetRecord } from "@/lib/datasets/storage";
import type { DependencyGraph } from "@/lib/fhir-importer/dependency-graph";
import { DependencyGraphDialog } from "@/components/dependency-graph/DependencyGraphDialog";
import { DatasetInfoDialog } from "@/components/editor/DatasetInfoDialog";
import { ExportDialog } from "@/components/editor/ExportDialog";
import type { OverviewText, OverviewViewMode, ProjectEntry } from "@/components/overview/types";
import { formatText } from "@/components/overview/utils";
import { ProjectsView } from "@/components/overview/views/ProjectsView";
import { DatasetsView } from "@/components/overview/views/DatasetsView";
import { CreateDatasetDialog } from "@/components/overview/dialogs/CreateDatasetDialog";
import { ImportDatasetDialog } from "@/components/overview/dialogs/ImportDatasetDialog";
import { SettingsDialog } from "@/components/overview/dialogs/SettingsDialog";

type ExportScope = "project" | "dataset";
type ExportFormat = "json" | "zip";
type ExportDatasetMode = "package" | "resources" | "searchset";

type ExportDatasetOption = { value: string; label: string; secondary: string };

type Props = {
  text: OverviewText;

  filter: string;
  onFilterChange: (value: string) => void;

  viewMode: OverviewViewMode;
  onViewModeChange: (mode: OverviewViewMode) => void;

  selectableProjectOptions: PackageRecord[];
  onCreateDatasetFromList: () => void;
  onNewProject: () => void;
  onOpenSettings: () => void;
  onRefresh: () => void;

  targets: ProjectEntry[];
  filteredDependencies: PackageRecord[];
  datasets: DatasetRecord[];
  projectByKey: Map<string, PackageRecord>;
  datasetsByProject: Map<string, DatasetRecord[]>;
  authoredKeys: Set<string>;
  dependenciesByTarget: Map<string, Set<string>>;
  dependencyOwners: Map<string, Set<string>>;
  currentTargetKey: string | null;
  currentTargetImportInProgress: boolean;
  isProjectDatasetSelectable: (projectKey: string) => boolean;

  onCreateDataset: (project: PackageRecord) => void;
  onImportDataset: (project: PackageRecord) => void;
  onOpenDependencyTree: (project: PackageRecord) => void;
  onOpenInProjectEditor: (project: PackageRecord) => void;
  onDuplicateProject: (project: PackageRecord) => void;
  onOpenExportDialog: (project: PackageRecord) => void;
  onExportDataset: (dataset: DatasetRecord) => void;
  onOpenDatasetInfo: (dataset: DatasetRecord) => void;
  onDuplicateDataset: (dataset: DatasetRecord) => void;
  onDeleteDataset: (dataset: DatasetRecord) => void;
  onDeleteProject: (project: PackageRecord) => void;
  canDeleteProject: (projectKey: string) => boolean;
  deleteReasonFor: (projectKey: string) => string | undefined;

  createDialogOpen: boolean;
  onCreateDialogOpenChange: (open: boolean) => void;
  importDialogOpen: boolean;
  onImportDialogOpenChange: (open: boolean) => void;
  selectedProjectKey: string | null;
  selectedProjectId: string | undefined;
  datasetName: string;
  onDatasetNameChange: (name: string) => void;
  onSelectedProjectKeyChange: (projectKey: string) => void;
  importDatasetFile: File | null;
  onImportDatasetFileChange: (file: File | null) => void;
  onConfirmCreateDataset: () => void;
  onConfirmImportDataset: () => void;

  exportDialogOpen: boolean;
  onExportDialogOpenChange: (open: boolean) => void;
  exportTarget: PackageRecord | null;
  exportScope: ExportScope;
  exportFormat: ExportFormat;
  exportIncludeDatasets: boolean;
  exportDatasetMode: ExportDatasetMode;
  exportDatasetOptions: ExportDatasetOption[];
  exportDatasetId: string | null;
  onExportScopeChange: (scope: ExportScope) => void;
  onExportFormatChange: (format: ExportFormat) => void;
  onExportIncludeDatasetsChange: (include: boolean) => void;
  onExportDatasetModeChange: (mode: ExportDatasetMode) => void;
  onExportDatasetChange: (id: string | null) => void;
  onConfirmExport: () => void;

  graph: DependencyGraph;
  dependencyTreeRootKey: string | null;
  onDependencyTreeRootKeyChange: (key: string | null) => void;

  datasetInfoOpen: boolean;
  onDatasetInfoOpenChange: (open: boolean) => void;
  datasetInfoDataset: DatasetRecord | null;
  datasetInfoProjectSuggestions: Array<{ key: string; label: string }>;
  onSaveDatasetInfo: (payload: { id: string; name: string; projectKey: string }) => void;

  settingsOpen: boolean;
  onSettingsOpenChange: (open: boolean) => void;
  onDeleteAllData: () => void;
};

export const EditorOverviewLayout = ({
  text,
  filter,
  onFilterChange,
  viewMode,
  onViewModeChange,
  selectableProjectOptions,
  onCreateDatasetFromList,
  onNewProject,
  onOpenSettings,
  onRefresh,
  targets,
  filteredDependencies,
  datasets,
  projectByKey,
  datasetsByProject,
  authoredKeys,
  dependenciesByTarget,
  dependencyOwners,
  currentTargetKey,
  currentTargetImportInProgress,
  isProjectDatasetSelectable,
  onCreateDataset,
  onImportDataset,
  onOpenDependencyTree,
  onOpenInProjectEditor,
  onDuplicateProject,
  onOpenExportDialog,
  onExportDataset,
  onOpenDatasetInfo,
  onDuplicateDataset,
  onDeleteDataset,
  onDeleteProject,
  canDeleteProject,
  deleteReasonFor,
  createDialogOpen,
  onCreateDialogOpenChange,
  importDialogOpen,
  onImportDialogOpenChange,
  selectedProjectKey,
  selectedProjectId,
  datasetName,
  onDatasetNameChange,
  onSelectedProjectKeyChange,
  importDatasetFile,
  onImportDatasetFileChange,
  onConfirmCreateDataset,
  onConfirmImportDataset,
  exportDialogOpen,
  onExportDialogOpenChange,
  exportTarget,
  exportScope,
  exportFormat,
  exportIncludeDatasets,
  exportDatasetMode,
  exportDatasetOptions,
  exportDatasetId,
  onExportScopeChange,
  onExportFormatChange,
  onExportIncludeDatasetsChange,
  onExportDatasetModeChange,
  onExportDatasetChange,
  onConfirmExport,
  graph,
  dependencyTreeRootKey,
  onDependencyTreeRootKeyChange,
  datasetInfoOpen,
  onDatasetInfoOpenChange,
  datasetInfoDataset,
  datasetInfoProjectSuggestions,
  onSaveDatasetInfo,
  settingsOpen,
  onSettingsOpenChange,
  onDeleteAllData,
}: Props) => {
  useEffect(() => {
    if (typeof document === "undefined") return;
    document.title = text.pageBrowserTitle;
  }, [text.pageBrowserTitle]);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-10">
      <header className="flex flex-col gap-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground">{text.editorEyebrow}</p>
            <h1 className="text-3xl font-semibold text-foreground">{text.pageTitle}</h1>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" onClick={onNewProject}>
              <FolderPlus className="size-4" />
              {text.newProject}
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link href="/importer">
                <Upload className="size-4" />
                {text.importProject}
              </Link>
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={selectableProjectOptions.length === 0}
              onClick={onCreateDatasetFromList}
            >
              {text.createDataset}
            </Button>
            <Button size="icon-sm" variant="ghost" aria-label={text.settingsAria} onClick={onOpenSettings}>
              <Settings className="size-4" />
            </Button>
          </div>
        </div>
        <p className="max-w-3xl text-sm text-muted-foreground">{text.pageDescription}</p>
      </header>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div
          className="inline-flex items-center gap-1 rounded-lg border border-foreground/15 p-1"
          role="tablist"
          aria-label={text.projectViewAria}
        >
          <Button
            size="sm"
            role="tab"
            aria-selected={viewMode === "projects"}
            variant={viewMode === "projects" ? "secondary" : "ghost"}
            onClick={() => onViewModeChange("projects")}
          >
            <LayoutGrid className="size-4" />
            {text.viewProjectsLabel}
          </Button>
          <Button
            size="sm"
            role="tab"
            aria-selected={viewMode === "datasets"}
            variant={viewMode === "datasets" ? "secondary" : "ghost"}
            onClick={() => onViewModeChange("datasets")}
          >
            <Database className="size-4" />
            {text.viewDatasetsLabel}
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <Input
            id="project-filter"
            value={filter}
            onChange={(event) => onFilterChange(event.target.value)}
            placeholder={text.filterPlaceholder}
            className="h-9 w-48 sm:w-64"
          />
          <Button variant="ghost" size="sm" onClick={onRefresh}>
            {text.refresh}
          </Button>
        </div>
      </div>

      {viewMode === "projects" ? (
        <section className="grid gap-4">
          <p className="text-sm text-muted-foreground">{text.projectsSectionDescription}</p>
          <ProjectsView
            text={text}
            targets={targets}
            filteredDependencies={filteredDependencies}
            dependenciesByTarget={dependenciesByTarget}
            dependencyOwners={dependencyOwners}
            datasetsByProject={datasetsByProject}
            authoredKeys={authoredKeys}
            currentTargetKey={currentTargetKey}
            currentTargetImportInProgress={currentTargetImportInProgress}
            isProjectDatasetSelectable={isProjectDatasetSelectable}
            onCreateDataset={onCreateDataset}
            onImportDataset={onImportDataset}
            onOpenDependencyTree={onOpenDependencyTree}
            onOpenInProjectEditor={onOpenInProjectEditor}
            onDuplicateProject={onDuplicateProject}
            onOpenExportDialog={onOpenExportDialog}
            onExportDataset={onExportDataset}
            onEditDatasetInfo={onOpenDatasetInfo}
            onDuplicateDataset={onDuplicateDataset}
            onDeleteDataset={onDeleteDataset}
            onDeleteProject={onDeleteProject}
            canDeleteProject={canDeleteProject}
            deleteReasonFor={deleteReasonFor}
          />
        </section>
      ) : (
        <DatasetsView
          text={text}
          datasets={datasets}
          projectByKey={projectByKey}
          selectableProjectOptions={selectableProjectOptions}
          isProjectDatasetSelectable={isProjectDatasetSelectable}
          onCreateDatasetFromList={onCreateDatasetFromList}
          onOpenExportDialog={onOpenExportDialog}
          onOpenDatasetInfo={onOpenDatasetInfo}
          onDuplicateDataset={onDuplicateDataset}
          onExportDataset={onExportDataset}
          onDeleteDataset={onDeleteDataset}
        />
      )}

      <CreateDatasetDialog
        open={createDialogOpen}
        onOpenChange={onCreateDialogOpenChange}
        text={text}
        projectId={selectedProjectId}
        selectedProjectKey={selectedProjectKey}
        selectableProjectOptions={selectableProjectOptions}
        datasetName={datasetName}
        onDatasetNameChange={onDatasetNameChange}
        onProjectChange={onSelectedProjectKeyChange}
        onConfirm={onConfirmCreateDataset}
      />

      <ImportDatasetDialog
        open={importDialogOpen}
        onOpenChange={onImportDialogOpenChange}
        text={text}
        projectId={selectedProjectId}
        selectedProjectKey={selectedProjectKey}
        selectableProjectOptions={selectableProjectOptions}
        datasetName={datasetName}
        onDatasetNameChange={onDatasetNameChange}
        onProjectChange={onSelectedProjectKeyChange}
        importDatasetFile={importDatasetFile}
        onImportDatasetFileChange={onImportDatasetFileChange}
        onConfirm={onConfirmImportDataset}
      />

      <ExportDialog
        open={exportDialogOpen}
        onOpenChange={onExportDialogOpenChange}
        title={text.exportProjectDialogTitle}
        description={formatText(text.exportProjectDialogDescription, {
          project: exportTarget?.id ?? text.thisProject,
        })}
        scope={exportScope}
        scopeOptions={[
          { value: "project", label: text.scopeProjectDependencies },
          {
            value: "dataset",
            label: text.scopeDatasetOnly,
            disabled: exportDatasetOptions.length === 0,
            helper: exportDatasetOptions.length === 0 ? text.scopeNoDatasetHelper : undefined,
          },
        ]}
        onScopeChange={onExportScopeChange}
        exportFormat={exportFormat}
        onExportFormatChange={onExportFormatChange}
        datasetMode={exportDatasetMode}
        onDatasetModeChange={onExportDatasetModeChange}
        datasetOptions={exportDatasetOptions}
        selectedDataset={exportDatasetId}
        onDatasetChange={onExportDatasetChange}
        includeDatasets={exportIncludeDatasets}
        onIncludeDatasetsChange={onExportIncludeDatasetsChange}
        confirmLabel={exportScope === "dataset" ? text.exportDatasetConfirm : text.exportProjectConfirm}
        confirmDisabled={!exportTarget || (exportScope === "dataset" && !exportDatasetId)}
        onConfirm={onConfirmExport}
      />

      <DependencyGraphDialog
        open={Boolean(dependencyTreeRootKey)}
        onOpenChange={(open) => {
          if (!open) onDependencyTreeRootKeyChange(null);
        }}
        graph={graph}
        rootKey={dependencyTreeRootKey}
        title={text.graphTitle}
        labels={{
          target: text.graphNodeTarget,
          resolved: text.graphNodeResolved,
          missing: text.graphNodeMissing,
          add: "",
          empty: text.graphEmpty,
        }}
      />

      <DatasetInfoDialog
        open={datasetInfoOpen}
        onOpenChange={onDatasetInfoOpenChange}
        dataset={datasetInfoDataset}
        projectSuggestions={datasetInfoProjectSuggestions}
        onOpenDependencyTree={(projectKey) => onDependencyTreeRootKeyChange(projectKey)}
        onSave={onSaveDatasetInfo}
      />

      <SettingsDialog
        open={settingsOpen}
        onOpenChange={onSettingsOpenChange}
        text={text}
        onDeleteAllData={onDeleteAllData}
      />
    </div>
  );
};

