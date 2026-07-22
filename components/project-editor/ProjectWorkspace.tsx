"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Check, Copy, Download, Lock, Share2 } from "lucide-react";
import { useI18n } from "@/components/i18n/I18nProvider";
import { byLocale } from "@/lib/i18n/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { DependencyGraphDialog } from "@/components/dependency-graph/DependencyGraphDialog";
import { MermaidDiagramDialog } from "@/components/editor/MermaidDiagramDialog";
import { buildPackageKey } from "@/lib/fhir-importer/utils";
import type { DependencyGraph } from "@/lib/fhir-importer/dependency-graph";
import type { PackageRecord, ResourcePayload } from "@/lib/fhir-importer/types";
import { getStructureDefinitionByCanonical, type StructureDefinition } from "@/lib/fhir-editor/registry";
import type { DatasetRecord } from "@/lib/datasets/storage";
import type {
  AuthoredProjectRecord,
  AuthoredResource,
  AuthoredResourceKind,
} from "@/lib/projects/types";
import { resourceLabel } from "@/lib/projects/content";
import { analyzeProject, type CanonicalResolvers } from "@/lib/projects/analysis";
import { buildProjectMermaid } from "@/lib/projects/project-mermaid";
import { projectEditorText } from "@/components/project-editor/project-editor/text";
import type { ProjectNodeSelection } from "@/components/project-editor/project-editor/useProjectState";
import { useProjectRegistryState } from "@/components/project-editor/project-editor/useProjectRegistryState";
import { ProjectExplorerPanel } from "@/components/project-editor/ProjectExplorerPanel";
import { ManifestEditor } from "@/components/project-editor/ManifestEditor";
import { DependencyManagerPanel } from "@/components/project-editor/DependencyManagerPanel";
import { NewConformanceDialog } from "@/components/project-editor/NewConformanceDialog";
import { ProjectDashboardPanel } from "@/components/project-editor/ProjectDashboardPanel";
import { ProjectIssuesPanel } from "@/components/project-editor/ProjectIssuesPanel";
import { ResourceDetailArea, type DetailMode } from "@/components/project-editor/ResourceDetailArea";

const CORE_PATIENT = "http://hl7.org/fhir/StructureDefinition/Patient";

type Props = {
  record: AuthoredProjectRecord;
  resources: AuthoredResource[];
  readOnly: boolean;
  packages: PackageRecord[];
  graph: DependencyGraph;
  getResourcePayloadsByPackageKeys: (keys: string[]) => Promise<ResourcePayload[]>;
  datasets: DatasetRecord[];
  savedAt: number | null;
  onUpdateManifest: (manifest: AuthoredProjectRecord["manifest"]) => void;
  onAddResource: (resource: AuthoredResource) => void;
  onUpdateResource: (resource: AuthoredResource) => void;
  onRemoveResource: (resourceId: string) => void;
  onExport: () => void;
  onDuplicate: () => void;
};

export const ProjectWorkspace = ({
  record,
  resources,
  readOnly,
  packages,
  graph,
  getResourcePayloadsByPackageKeys,
  datasets,
  savedAt,
  onUpdateManifest,
  onAddResource,
  onUpdateResource,
  onRemoveResource,
  onExport,
  onDuplicate,
}: Props) => {
  const { locale } = useI18n();
  const t = byLocale(locale, projectEditorText);

  const [selection, setSelection] = useState<ProjectNodeSelection>({ kind: "dashboard" });
  const [conformanceOpen, setConformanceOpen] = useState(false);
  const [presetKind, setPresetKind] = useState<AuthoredResourceKind>("profile");
  const [graphOpen, setGraphOpen] = useState(false);
  const [mapOpen, setMapOpen] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const [detailMode, setDetailMode] = useState<DetailMode>("constraints");

  const selectedResource = useMemo(
    () =>
      selection.kind === "resource"
        ? resources.find((r) => r.id === selection.resourceId) ?? null
        : null,
    [selection, resources]
  );

  useEffect(() => {
    if (selection.kind === "resource" && !resources.some((r) => r.id === selection.resourceId)) {
      setSelection({ kind: "dashboard" });
    }
  }, [selection, resources]);

  const { registryState, profiles, schemaCtx, schemaTree } = useProjectRegistryState({
    project: record,
    resources,
    selectedResource,
    packages,
    graph,
    getResourcePayloadsByPackageKeys,
  });

  const resolvers = useMemo<CanonicalResolvers>(
    () => ({
      hasStructureDefinition: (url) =>
        registryState ? Boolean(getStructureDefinitionByCanonical(registryState, url)) : false,
      hasValueSet: (url) =>
        registryState
          ? registryState.valueSetsByUrl.has(url) ||
            registryState.valueSetsByUrl.has(url.replace(/\/+$/, ""))
          : false,
      hasCore:
        Boolean(record.manifest.dependencies?.["hl7.fhir.r4.core"]) ||
        (registryState ? Boolean(getStructureDefinitionByCanonical(registryState, CORE_PATIENT)) : false),
    }),
    [registryState, record.manifest.dependencies]
  );

  const resolveStructureDefinition = useMemo(
    () => (url: string): StructureDefinition | null =>
      registryState ? getStructureDefinitionByCanonical(registryState, url) ?? null : null,
    [registryState]
  );

  const analysis = useMemo(
    () => analyzeProject({ manifest: record.manifest, resources, resolvers }),
    [record.manifest, resources, resolvers]
  );

  const valueSetOptions = useMemo(
    () =>
      resources
        .filter((r) => r.kind === "valueset")
        .map((r) => ({
          url: (r.content as Record<string, unknown>).url as string,
          label: resourceLabel(r),
        }))
        .filter((o) => Boolean(o.url)),
    [resources]
  );

  const usedByResources = useMemo(() => {
    if (!selectedResource) return [];
    const ids = analysis.usedBy[selectedResource.id] ?? [];
    return ids
      .map((id) => resources.find((r) => r.id === id))
      .filter((r): r is AuthoredResource => Boolean(r));
  }, [selectedResource, analysis, resources]);

  const projectDiagram = useMemo(
    () =>
      buildProjectMermaid(analysis, {
        empty: t.mapEmpty,
        edgeDerives: t.edgeDerives,
        edgeConforms: t.edgeConforms,
        edgeBinds: t.edgeBinds,
        edgeIncludes: t.edgeIncludes,
        edgeExtends: t.edgeExtends,
      }),
    [analysis, t]
  );

  // Reset the detail view to the primary view whenever the selected resource changes.
  useEffect(() => {
    if (!selectedResource) return;
    const isProfileLike =
      selectedResource.kind === "profile" || selectedResource.kind === "extension";
    setDetailMode(isProfileLike ? "constraints" : readOnly ? "summary" : "form");
  }, [selectedResource, readOnly]);

  useEffect(() => {
    if (savedAt === null) return;
    setJustSaved(true);
    const timeout = setTimeout(() => setJustSaved(false), 1200);
    return () => clearTimeout(timeout);
  }, [savedAt]);

  useEffect(() => {
    if (typeof document === "undefined") return;
    document.title = `${t.editorEyebrow} - ${record.manifest.title ?? record.id}`;
  }, [record, t.editorEyebrow]);

  const openAddDialog = (kind: AuthoredResourceKind) => {
    setPresetKind(kind);
    setConformanceOpen(true);
  };

  const graphRootKey = useMemo(() => {
    const dependencies = record.manifest.dependencies ?? {};
    for (const [id, version] of Object.entries(dependencies)) {
      const directKey = buildPackageKey(id, version);
      if (graph.byKey.get(directKey)) return directKey;
      const byId = packages.find((pkg) => pkg.id === id);
      if (byId) return byId.key;
    }
    return null;
  }, [record, graph, packages]);

  const handleContentChange = (next: Record<string, unknown>) => {
    if (!selectedResource) return;
    onUpdateResource({ ...selectedResource, content: next, updatedAt: Date.now() });
  };

  const isProfileLike =
    selectedResource?.kind === "profile" || selectedResource?.kind === "extension";

  const detailModes: DetailMode[] = selectedResource
    ? isProfileLike
      ? readOnly
        ? ["constraints", "json"]
        : ["constraints", "form", "json"]
      : readOnly
        ? ["summary", "json"]
        : ["form", "json"]
    : [];

  return (
    <div className="flex h-[100dvh] flex-col overflow-hidden">
      <header className="border-b border-foreground/10 bg-background/90 px-3 py-3 sm:px-6 sm:py-4">
        <div className="flex min-w-0 items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2 text-sm text-muted-foreground">
            <Link href="/" className="font-medium text-foreground">
              {t.backToOverview}
            </Link>
            <span>/</span>
            <span className="truncate font-semibold text-foreground sm:text-base">
              {record.manifest.title ?? record.id}
            </span>
            <span className="truncate font-mono text-xs">{record.key}</span>
            {readOnly ? (
              <Badge variant="outline" className="gap-1">
                <Lock className="size-3" />
                {t.readOnlyBadge}
              </Badge>
            ) : null}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {justSaved ? (
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <Check className="size-3.5" />
                {t.saved}
              </span>
            ) : null}
            <Button variant="outline" size="sm" onClick={() => setMapOpen(true)}>
              <Share2 className="size-4" />
              {t.showRelationships}
            </Button>
            {readOnly ? (
              <Button size="sm" onClick={onDuplicate}>
                <Copy className="size-4" />
                {t.duplicateToEditable}
              </Button>
            ) : (
              <Button variant="outline" size="sm" onClick={onDuplicate}>
                <Copy className="size-4" />
                {t.duplicate}
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={onExport}>
              <Download className="size-4" />
              {t.exportProject}
            </Button>
          </div>
        </div>
      </header>

      {readOnly ? (
        <div className="flex items-center gap-2 border-b border-amber-500/30 bg-amber-500/10 px-4 py-2 text-xs text-amber-700 dark:text-amber-400">
          <Lock className="size-3.5 shrink-0" />
          {t.readOnlyBanner}
        </div>
      ) : null}

      <div className="min-h-0 flex-1 overflow-hidden">
        <ResizablePanelGroup direction="horizontal" className="h-full min-h-0">
          <ResizablePanel defaultSize={22} minSize={16} className="min-h-0 min-w-0 bg-muted/10">
            <ProjectExplorerPanel
              text={t}
              resources={resources}
              datasets={datasets}
              selection={selection}
              readOnly={readOnly}
              issueCount={analysis.issues.length}
              onSelect={setSelection}
              onAdd={openAddDialog}
              onRemove={(resourceId) => {
                if (window.confirm(t.removeResourceConfirm)) onRemoveResource(resourceId);
              }}
            />
          </ResizablePanel>
          <ResizableHandle withHandle />
          <ResizablePanel defaultSize={78} minSize={30} className="min-h-0 min-w-0">
            {selection.kind === "dashboard" ? (
              <ProjectDashboardPanel
                text={t}
                manifest={record.manifest}
                analysis={analysis}
                datasetCount={datasets.length}
                readOnly={readOnly}
                onAdd={openAddDialog}
                onShowMap={() => setMapOpen(true)}
                onOpenIssues={() => setSelection({ kind: "issues" })}
              />
            ) : selection.kind === "issues" ? (
              <ProjectIssuesPanel
                text={t}
                issues={analysis.issues}
                onSelectResource={(id) => setSelection({ kind: "resource", resourceId: id })}
              />
            ) : selection.kind === "manifest" ? (
              <ManifestEditor
                text={t}
                manifest={record.manifest}
                onChange={onUpdateManifest}
                readOnly={readOnly}
              />
            ) : selection.kind === "dependencies" ? (
              <DependencyManagerPanel
                text={t}
                dependencies={record.manifest.dependencies ?? {}}
                availablePackages={packages}
                readOnly={readOnly}
                onAdd={(id, version) =>
                  onUpdateManifest({
                    ...record.manifest,
                    dependencies: { ...(record.manifest.dependencies ?? {}), [id]: version },
                  })
                }
                onRemove={(id) => {
                  const next = { ...(record.manifest.dependencies ?? {}) };
                  delete next[id];
                  onUpdateManifest({
                    ...record.manifest,
                    dependencies: Object.keys(next).length ? next : undefined,
                  });
                }}
                onShowGraph={() => {
                  if (!graphRootKey) {
                    toast.error(t.noDependencies);
                    return;
                  }
                  setGraphOpen(true);
                }}
              />
            ) : selectedResource ? (
              <ResourceDetailArea
                text={t}
                resource={selectedResource}
                isProfileLike={isProfileLike}
                readOnly={readOnly}
                detailMode={detailMode}
                detailModes={detailModes}
                onModeChange={setDetailMode}
                resources={resources}
                schemaCtx={schemaCtx}
                schemaTree={schemaTree}
                resolveStructureDefinition={resolveStructureDefinition}
                valueSetOptions={valueSetOptions}
                usedBy={usedByResources}
                onContentChange={handleContentChange}
                onSelectResource={(id) => setSelection({ kind: "resource", resourceId: id })}
                onUpdateResource={onUpdateResource}
                onRemoveResource={onRemoveResource}
              />
            ) : (
              <ProjectDashboardPanel
                text={t}
                manifest={record.manifest}
                analysis={analysis}
                datasetCount={datasets.length}
                readOnly={readOnly}
                onAdd={openAddDialog}
                onShowMap={() => setMapOpen(true)}
                onOpenIssues={() => setSelection({ kind: "issues" })}
              />
            )}
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>

      {readOnly ? null : (
        <NewConformanceDialog
          open={conformanceOpen}
          onOpenChange={setConformanceOpen}
          presetKind={presetKind}
          canonicalBase={record.manifest.canonical}
          profiles={profiles}
          onCreate={(resource) => {
            onAddResource(resource);
            setSelection({ kind: "resource", resourceId: resource.id });
          }}
        />
      )}

      <DependencyGraphDialog
        open={graphOpen}
        onOpenChange={setGraphOpen}
        graph={graph}
        rootKey={graphRootKey}
        title={t.showDependencyGraph}
        labels={{ target: "", resolved: "", missing: "", add: "", empty: t.noDependencies }}
      />

      <MermaidDiagramDialog
        open={mapOpen}
        onOpenChange={setMapOpen}
        title={t.mapTitle}
        diagram={projectDiagram}
        downloadFilename={`${record.id}-relationships.svg`}
        failedToRenderMessage={t.mapEmpty}
        ariaZoomIn="Zoom in"
        ariaZoomOut="Zoom out"
        ariaResetZoom="Reset zoom"
        ariaFitToView="Fit to view"
        ariaDownloadDiagram="Download diagram"
        nodeSpacing={40}
        rankSpacing={60}
      />
    </div>
  );
};
