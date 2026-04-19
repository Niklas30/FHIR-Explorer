"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/components/i18n/I18nProvider";
import { useImporter } from "@/components/importer/useImporter";
import { EditorCommandPalette } from "@/components/editor/commands/EditorCommandPalette";
import { createEditorCommands } from "@/components/editor/commands/create-editor-commands";
import { useEditorCommandShortcuts } from "@/components/editor/commands/use-editor-command-shortcuts";
import { DatasetDiagramDialog } from "@/components/editor/DatasetDiagramDialog";
import { DatasetInfoDialog } from "@/components/editor/DatasetInfoDialog";
import { DependencyTreeDialog } from "@/components/editor/DependencyTreeDialog";
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
import type { Layout } from "react-resizable-panels";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { DatasetRecord } from "@/lib/datasets/storage";
import { upsertDataset } from "@/lib/datasets/storage";
import {
  createDatasetResourceId,
  removeDatasetResource,
  type DatasetResource,
} from "@/lib/datasets/content";
import { isDevModeEnabled } from "@/lib/dev-mode";
import { buildDependencyGraph } from "@/lib/fhir-importer/dependency-graph";
import type { PackageRecord } from "@/lib/fhir-importer/types";
import { byLocale } from "@/lib/i18n/select";
import { toast } from "sonner";
import { exportDatasetAction } from "@/components/overview/datasetActions";
import { exportProject } from "@/components/overview/exportActions";
import { datasetEditorText } from "@/components/editor/dataset-editor/text";
import { useDatasetEditorViewSettings } from "@/components/editor/dataset-editor/useViewSettings";
import { useDatasetEditorDatasetState } from "@/components/editor/dataset-editor/useDatasetState";
import { useDatasetEditorRegistryState } from "@/components/editor/dataset-editor/useRegistryState";

type DatasetEditorProps = {
  datasetId: string;
};

const EMPTY_PACKAGES: PackageRecord[] = [];

type ResourceNavigationState = {
  history: string[];
  index: number;
};

const downloadJson = (filename: string, payload: unknown) => {
  if (typeof window === "undefined") return;
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

const FullPageMessage = ({ children }: { children: ReactNode }) => {
  return (
    <div className="relative flex h-[100dvh] items-center justify-center bg-muted/20">
      <div className="rounded-lg border border-foreground/10 bg-background px-4 py-3 text-sm text-muted-foreground shadow-sm">
        {children}
      </div>
    </div>
  );
};

const DatasetNotFoundPanel = ({
  datasetId,
  text,
}: {
  datasetId: string;
  text: { datasetNotFoundTitle: string; datasetNotFoundDescription: string; missingIdPrefix: string };
}) => {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-10">
      <Card className="border-foreground/10">
        <CardHeader>
          <CardTitle className="text-2xl">{text.datasetNotFoundTitle}</CardTitle>
          <CardDescription>{text.datasetNotFoundDescription}</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            {text.missingIdPrefix} {datasetId}
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

const InitializationErrorPanel = ({
  error,
  text,
}: {
  error: Error;
  text: {
    editorInitErrorTitle: string;
    editorInitErrorDescription: string;
    devModeHintPrefix: string;
    devModeHintSuffix: string;
  };
}) => {
  const details = [`message: ${error.message}`, error.stack ? `\n${error.stack}` : ""].filter(Boolean);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-10">
      <Card className="border-foreground/10">
        <CardHeader>
          <CardTitle className="text-2xl">{text.editorInitErrorTitle}</CardTitle>
          <CardDescription>{text.editorInitErrorDescription}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {isDevModeEnabled() ? (
            <pre className="max-h-[45dvh] overflow-auto rounded-md border border-foreground/10 bg-muted/30 p-3 text-xs whitespace-pre-wrap">
              {details.join("\n")}
            </pre>
          ) : (
            <p className="text-sm text-muted-foreground">
              {text.devModeHintPrefix}{" "}
              <Link href="/devmode" className="underline">
                /devmode
              </Link>{" "}
              {text.devModeHintSuffix}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export const DatasetEditor = ({ datasetId }: DatasetEditorProps) => {
  const router = useRouter();
  const { locale } = useI18n();
  const resourceDetailRef = useRef<ResourceDetailPanelHandle | null>(null);
  const [focusSearchFn, setFocusSearchFn] = useState<(() => void) | null>(null);
  const [isCreateDialogOpen, setCreateDialogOpen] = useState(false);
  const [isDiagramOpen, setDiagramOpen] = useState(false);
  const [isExportDialogOpen, setExportDialogOpen] = useState(false);
  const [isDatasetInfoOpen, setDatasetInfoOpen] = useState(false);
  const [dependencyTreeRootKey, setDependencyTreeRootKey] = useState<string | null>(null);
  const [isCommandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [exportScope, setExportScope] = useState<"dataset" | "project">("dataset");
  const [exportFormat, setExportFormat] = useState<"json" | "zip">("json");
  const [exportDatasetMode, setExportDatasetMode] = useState<
    "package" | "resources" | "searchset"
  >("package");
  const [exportIncludeDatasets, setExportIncludeDatasets] = useState(true);
  const layoutStorageKey = "fhir-explorer-editor-layout";
  const {
    viewSettingsLoaded,
    zoomPercent,
    setZoomPercent,
    theme,
    setTheme,
    panelLayout,
    persistPanelLayout,
  } = useDatasetEditorViewSettings(layoutStorageKey);

  const { snapshot, getResourcePayloadsByPackageKeys } = useImporter();
  const packages = snapshot?.packages ?? EMPTY_PACKAGES;
  const graph = useMemo(() => buildDependencyGraph(packages), [packages]);
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
  const text = byLocale(locale, datasetEditorText);
  useEffect(() => {
    setFocusSearchFn(() => () => resourceDetailRef.current?.focusSearch());
  }, []);
  const {
    dataset,
    setDataset,
    datasets,
    setDatasets,
    datasetLoaded,
    resources,
    selectedResourceId,
    setSelectedResourceId,
    selectedResource,
    setResourceNavigation,
    persistResources,
    handleUpdateResource,
    handleSelectResource,
    canNavigateBack,
    canNavigateForward,
    handleNavigateBack,
    handleNavigateForward,
  } = useDatasetEditorDatasetState({ datasetId, title: text.titleEditor });

  const {
    registryLoaded,
    initializationError,
    registryState,
    profiles,
    fields,
    resolveStructureDefinition,
  } = useDatasetEditorRegistryState({
    dataset,
    datasetLoaded,
    packages,
    graph,
    selectedResource,
    getResourcePayloadsByPackageKeys,
    errorLoadingResourcesMessage: text.errorLoadingResources,
  });

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
    setDatasetInfoOpen(true);
  };

  const handleFocusFormSearch = () => {
    focusSearchFn?.();
  };

  const handleZoomIn = () => {
    setZoomPercent((prev) => Math.min(140, prev + 5));
  };

  const handleZoomOut = () => {
    setZoomPercent((prev) => Math.max(70, prev - 5));
  };

  const handleSaveDatasetInfo = (payload: { id: string; name: string; projectKey: string }) => {
    if (!dataset) return;
    if (dataset.id !== payload.id) return;
    const nextDataset: DatasetRecord = {
      ...dataset,
      name: payload.name,
      projectKey: payload.projectKey,
    };
    const nextDatasets = upsertDataset(nextDataset);
    setDataset(nextDataset);
    setDatasets(nextDatasets);
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
    locale,
    theme,
    setTheme,
  });

  useEditorCommandShortcuts({ commands: editorCommands });

  const handleRemoveResource = (resourceId: string) => {
    const ok = window.confirm(text.removeResourceConfirm);
    if (!ok) return;
    const nextResources = removeDatasetResource(datasetId, resourceId);
    persistResources(nextResources);
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

  const handleExportConfirm = async () => {
    if (!dataset) return;
    if (exportScope === "dataset") {
      await exportDatasetAction({
        dataset,
        mode: exportDatasetMode,
        exportFormat,
        text,
      });
      setExportDialogOpen(false);
      return;
    }

    const targetProject = packages.find((pkg) => pkg.key === dataset.projectKey);
    if (!targetProject) {
      toast.error(text.projectPackageNotFound);
      return;
    }

    await exportProject({
      project: targetProject,
      includeDatasets: exportIncludeDatasets,
      exportFormat,
      graph,
      datasets,
      getResourcePayloadsByPackageKeys,
      text,
    });
    setExportDialogOpen(false);
  };

  const handleCreateResource = (payload: { profileUrl: string; resourceId?: string }) => {
    if (!registryState) return;
    const profileDefinition = resolveStructureDefinition(payload.profileUrl);
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
    return <FullPageMessage>{text.loadingFallback}</FullPageMessage>;
  }

  if (!dataset) {
    return <DatasetNotFoundPanel datasetId={datasetId} text={text} />;
  }

  if (initializationError) {
    return <InitializationErrorPanel error={initializationError} text={text} />;
  }

  const zoomLabel = `${zoomPercent}%`;
  const isInitializing = dataset ? !registryLoaded : false;

  return (
    <div className="relative flex h-[100dvh] flex-col overflow-hidden bg-muted/20">
      {isInitializing ? (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-background/80 backdrop-blur-sm">
          <div className="rounded-lg border border-foreground/10 bg-background px-4 py-3 text-sm text-muted-foreground shadow-sm">
            {text.loadingEditorOverlay}
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
            onLayoutChanged={(layout: Layout) => persistPanelLayout(layout)}
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
        <DatasetInfoDialog
          open={isDatasetInfoOpen}
          onOpenChange={setDatasetInfoOpen}
          dataset={dataset}
          projectSuggestions={projectSuggestions}
          onOpenDependencyTree={setDependencyTreeRootKey}
          onSave={handleSaveDatasetInfo}
        />
        <EditorCommandPalette
          open={isCommandPaletteOpen}
          onOpenChange={setCommandPaletteOpen}
          commands={editorCommands}
        />
        <ExportDialog
          open={isExportDialogOpen}
          onOpenChange={setExportDialogOpen}
          title={text.exportDialogTitle}
          description={text.exportDialogDescription}
          scope={exportScope}
          scopeOptions={[
            { value: "dataset", label: text.exportScopeDataset },
            {
              value: "project",
              label: text.exportScopeProject,
              disabled: !dataset.projectKey,
              helper: !dataset.projectKey
                ? text.exportScopeProjectHelper
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
          confirmLabel={
            exportScope === "dataset"
              ? text.exportConfirmDataset
              : text.exportConfirmProject
          }
          onConfirm={handleExportConfirm}
        />
        <DependencyTreeDialog
          open={Boolean(dependencyTreeRootKey)}
          onOpenChange={(open) => {
            if (!open) {
              setDependencyTreeRootKey(null);
            }
          }}
          graph={graph}
          rootProjectKey={dependencyTreeRootKey}
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
