"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { VersionChoicesCard } from "@/components/importer/import-wizard/VersionChoicesCard";
import { DependenciesCard } from "@/components/importer/import-wizard/DependenciesCard";
import { deriveWizardStep } from "@/components/importer/import-wizard/helpers";
import { ImportConsentCard } from "@/components/importer/import-wizard/ImportConsentCard";
import { ImportGraphCard } from "@/components/importer/import-wizard/ImportGraphCard";
import { ImportHistoryCard } from "@/components/importer/import-wizard/ImportHistoryCard";
import { ImportLogCard } from "@/components/importer/import-wizard/ImportLogCard";
import { ImportSuccessCard } from "@/components/importer/import-wizard/ImportSuccessCard";
import { TargetPackageCard } from "@/components/importer/import-wizard/TargetPackageCard";
import { useAdvancedMode } from "@/components/importer/import-wizard/useAdvancedMode";
import { useImportSource } from "@/components/importer/import-wizard/useImportSource";
import { useImportWizardText } from "@/components/importer/import-wizard/text";
import { WizardHeader } from "@/components/importer/import-wizard/WizardHeader";
import { usePageFileDrop } from "@/components/importer/import-wizard/usePageFileDrop";
import { useFileImport } from "@/components/importer/import-wizard/useFileImport";
import { useRegistryImport } from "@/components/importer/import-wizard/useRegistryImport";
import { DependencyGraphDialog } from "@/components/dependency-graph/DependencyGraphDialog";
import { useDownloadLinks } from "@/components/importer/useDownloadLinks";
import { useImporter } from "@/components/importer/useImporter";
import { buildDependencyGraph, collectDependencies } from "@/lib/fhir-importer/dependency-graph";
import type { DependencyRequirement, PackageRecord } from "@/lib/fhir-importer/types";

type ImportSummary = {
  targetKey: string;
  log: string[];
};

const EMPTY_DEPENDENCIES: DependencyRequirement[] = [];
const EMPTY_PACKAGES: PackageRecord[] = [];
const EMPTY_IMPORT_HISTORY: Array<{ targetKey: string; completedAt: number }> = [];
const EMPTY_LOG: string[] = [];

export const ImportWizard = () => {
  const { text, format } = useImportWizardText();
  const {
    snapshot,
    progress,
    error,
    lastResult,
    setTarget,
    clearTarget,
    finalizeTarget,
    setVersionSelection,
    clearVersionSelection,
    importFile,
    importTargetFile,
    importFromRegistry,
    importComposeProject,
    addImportHistory,
    refresh,
    getDownloadUrl: buildDownloadUrl,
  } = useImporter();

  const [advancedMode, setAdvancedMode] = useAdvancedMode();
  // Reset per target: agreeing to import one package is not agreement to
  // import the next one the user names.
  const [consented, setConsented] = useState(false);
  const searchParams = useSearchParams();
  const router = useRouter();
  const [packageId, setPackageId] = useState("");
  const [version, setVersion] = useState("");
  const [versionDrafts, setVersionDrafts] = useState<Record<string, string>>({});
  const [uploadNotice, setUploadNotice] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [importLog, setImportLog] = useState<string[]>([]);
  const [completedSummary, setCompletedSummary] = useState<ImportSummary | null>(null);
  const [graphDialogRootKey, setGraphDialogRootKey] = useState<string | null>(null);
  const [highlightDependencyId, setHighlightDependencyId] = useState<string | null>(null);
  const lastNoticeRef = useRef<string | null>(null);
  const lastResultRef = useRef<string | null>(null);
  const progressToastId = useRef<string>("import-progress");
  const completionHandledRef = useRef<string | null>(null);

  const currentTarget = snapshot?.state.currentTarget;
  const importSource = useImportSource(currentTarget);

  useEffect(() => {
    if (currentTarget) return;
    const projectParam = searchParams.get("project")?.trim();
    const versionParam = searchParams.get("version")?.trim();
    if (projectParam && packageId.length === 0) {
      setPackageId(projectParam);
    }
    if (versionParam && version.length === 0) {
      setVersion(versionParam);
    }
  }, [searchParams, currentTarget, packageId.length, version.length]);

  const activeTargetKeyRef = useRef<string | null>(null);
  useEffect(() => {
    if (currentTarget) {
      const key = `${currentTarget.id}@${currentTarget.version}`;
      setPackageId(currentTarget.id);
      setVersion(currentTarget.version);
      // Only clear a previous success summary when a genuinely new target is
      // started — not on every snapshot refresh (which re-creates the target
      // object) so the completion effect's summary is not clobbered mid-finalize.
      if (activeTargetKeyRef.current !== key) {
        activeTargetKeyRef.current = key;
        setCompletedSummary(null);
      }
    } else {
      activeTargetKeyRef.current = null;
    }
  }, [currentTarget]);

  const dependencyState = snapshot?.dependencyState;
  const missing = dependencyState?.missing ?? EMPTY_DEPENDENCIES;
  const decisions = dependencyState?.decisions ?? EMPTY_DEPENDENCIES;
  const packages = snapshot?.packages ?? EMPTY_PACKAGES;
  const trimmedPackageId = packageId.trim();
  const trimmedVersion = version.trim();

  const targetKey = currentTarget ? `${currentTarget.id}@${currentTarget.version}` : null;
  const isTargetImported = targetKey ? packages.some((pkg) => pkg.key === targetKey) : false;

  // A new target is a new decision: agreeing to import one package is not
  // agreement to import the next one the user names.
  useEffect(() => {
    setConsented(false);
  }, [targetKey]);

  // Links point at a registry that has the version, not at the default mirror,
  // which carries only some of them.
  const getDownloadUrl = useDownloadLinks(currentTarget, missing, buildDownloadUrl);

  const targetDownloadUrl = currentTarget ? getDownloadUrl(currentTarget.id, currentTarget.version) : null;

  const missingCount = missing.length;
  const importedDefinitions = snapshot?.resourceIndexCount ?? 0;
  const allResolved = Boolean(currentTarget && isTargetImported && missing.length === 0);
  const isTargetReady = Boolean(currentTarget && isTargetImported);
  const importHistory = snapshot?.state.importHistory ?? EMPTY_IMPORT_HISTORY;
  const lastImportLog = completedSummary?.log ?? EMPTY_LOG;

  const handleCopy = useCallback(async (link: string) => {
    if (typeof navigator === "undefined") return;
    await navigator.clipboard.writeText(link);
  }, []);

  const addLog = useCallback((message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setImportLog((prev) => [`${timestamp} — ${message}`, ...prev].slice(0, 50));
  }, []);

  useEffect(() => {
    if (progress.phase !== "idle") {
      toast.loading(text.importingPackage, {
        id: progressToastId.current,
      });
    } else {
      toast.dismiss(progressToastId.current);
    }
  }, [progress.phase, text.importingPackage]);

  useEffect(() => {
    if (!lastResult) return;
    if (lastResultRef.current === lastResult.packageKey) return;
    lastResultRef.current = lastResult.packageKey;

    const message =
      lastResult.status === "duplicate"
        ? format(text.packageAlreadyImportedShort, { packageKey: lastResult.packageKey })
        : format(text.importedPackageShort, { packageKey: lastResult.packageKey });

    toast.success(message);
    addLog(message);
  }, [addLog, format, lastResult, text.importedPackageShort, text.packageAlreadyImportedShort]);

  useEffect(() => {
    if (!error) return;
    toast.error(error);
    addLog(format(text.errorPrefix, { error }));
  }, [addLog, error, format, text.errorPrefix]);

  useEffect(() => {
    if (!uploadNotice || uploadNotice === lastNoticeRef.current) return;
    lastNoticeRef.current = uploadNotice;
    toast.info(uploadNotice);
    addLog(uploadNotice);
  }, [addLog, uploadNotice]);

  const { handleUpload, handleTargetUpload } = useFileImport({
    importFile,
    importTargetFile,
    importComposeProject,
    currentTarget,
    missing,
    text,
    format,
    setUploadNotice,
    setIsUploading,
  });

  const handleCancel = useCallback(async () => {
    setConsented(false);
    await clearTarget();
    setPackageId("");
    setVersion("");
    setVersionDrafts({});
    setUploadNotice(null);
    setImportLog([]);
  }, [clearTarget]);

  useEffect(() => {
    if (!allResolved || !currentTarget) return;
    const nextTargetKey = `${currentTarget.id}@${currentTarget.version}`;
    if (completionHandledRef.current === nextTargetKey) return;
    completionHandledRef.current = nextTargetKey;
    setCompletedSummary({
      targetKey: nextTargetKey,
      log: importLog.slice(0, 100),
    });
    (async () => {
      await addImportHistory(nextTargetKey);
      await finalizeTarget();
      setPackageId("");
      setVersion("");
      setVersionDrafts({});
      setUploadNotice(null);
      setImportLog([]);
    })();
  }, [allResolved, currentTarget, importLog, finalizeTarget, addImportHistory]);

  const { activeStepIndex, importFinished } = deriveWizardStep({
    hasTarget: Boolean(currentTarget),
    isTargetImported,
    allResolved,
    hasCompletedSummary: Boolean(completedSummary),
  });

  const graph = useMemo(() => buildDependencyGraph(packages), [packages]);
  const graphRootKey = importFinished ? completedSummary?.targetKey ?? null : targetKey;
  const showGraph = Boolean(graphRootKey) && (isTargetReady || importFinished);
  const finishDependencyCount = useMemo(
    () =>
      importFinished && completedSummary
        ? collectDependencies(completedSummary.targetKey, graph).size
        : 0,
    [importFinished, completedSummary, graph]
  );

  const {
    handleImportFromRegistry,
    handleImportTarget,
    handleImportAllMissing,
    handleImportEverything,
  } = useRegistryImport({
      importFromRegistry,
      refresh,
      currentTarget,
      text,
      format,
      setUploadNotice,
      setIsUploading,
    });

  const handleResolveMissing = useCallback((dependencyId: string) => {
    setGraphDialogRootKey(null);
    setHighlightDependencyId(dependencyId);
    if (typeof document !== "undefined") {
      window.requestAnimationFrame(() => {
        const element = document.getElementById(`dependency-${dependencyId}`);
        element?.scrollIntoView({ behavior: "smooth", block: "center" });
      });
    }
    window.setTimeout(() => setHighlightDependencyId(null), 2400);
  }, []);

  // Route files dropped anywhere on the page to the right handler: while the
  // target is not imported yet they seed the target, otherwise they resolve
  // dependencies. Both handlers also detect FHIR-Explorer project exports.
  const handleGlobalFiles = useCallback(
    (files: File[]) => {
      if (files.length === 0) return;
      if (isTargetImported) {
        void handleUpload(files);
      } else {
        void handleTargetUpload(files);
      }
    },
    [isTargetImported, handleUpload, handleTargetUpload]
  );

  const { isDragging: isDraggingFile, dropHandlers } = usePageFileDrop(handleGlobalFiles);

  // After a successful import, briefly show the confirmation, then hand the user
  // off to the projects overview. Unmounting resets the wizard to its initial state.
  useEffect(() => {
    if (!importFinished) return;
    const timer = window.setTimeout(() => router.push("/"), 2200);
    return () => window.clearTimeout(timer);
  }, [importFinished, router]);

  const logToShow = currentTarget ? importLog : lastImportLog;

  const logCardConfig = useMemo(() => {
    if (currentTarget) {
      return { description: text.latestImportActions };
    }
    return { description: text.importLogHistory };
  }, [currentTarget, text.importLogHistory, text.latestImportActions]);

  return (
    <div
      className="relative mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-8"
      {...dropHandlers}
    >
      {isDraggingFile ? (
        <div className="pointer-events-none fixed inset-4 z-50 flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-primary bg-primary/5 backdrop-blur-sm">
          <p className="text-lg font-semibold text-foreground">{text.dropAnywhereTitle}</p>
          <p className="text-sm text-muted-foreground">{text.dropAnywhereHint}</p>
        </div>
      ) : null}

      <WizardHeader
        text={text}
        currentTarget={currentTarget}
        allResolved={allResolved}
        activeStepIndex={activeStepIndex}
        advancedMode={advancedMode}
        onAdvancedModeChange={setAdvancedMode}
        importFinished={importFinished}
        onCancel={handleCancel}
      />

      {importFinished && completedSummary ? (
        <ImportSuccessCard
          text={text}
          format={format}
          targetKey={completedSummary.targetKey}
          packageCount={finishDependencyCount + 1}
          dependencyCount={finishDependencyCount}
          definitionCount={importedDefinitions}
        />
      ) : (
        <>
          <TargetPackageCard
            text={text}
            currentTarget={currentTarget}
            isTargetReady={isTargetReady}
            allResolved={allResolved}
            targetDownloadUrl={targetDownloadUrl}
            isUploading={isUploading}
            packageId={packageId}
            version={version}
            trimmedPackageId={trimmedPackageId}
            trimmedVersion={trimmedVersion}
            onPackageIdChange={setPackageId}
            onVersionChange={setVersion}
            onSetTarget={(id, version) => void setTarget(id, version)}
            onCopy={(link) => void handleCopy(link)}
            onImportEverything={(id, version) => void setTarget(id, version)}
            advancedMode={advancedMode}
            onImportDirectly={handleImportTarget}
            onTargetUpload={(files) => void handleTargetUpload(files)}
          />

          {currentTarget && !consented && !allResolved ? (
            <ImportConsentCard
              text={text}
              format={format}
              target={currentTarget}
              source={importSource}
              isImporting={isUploading}
              onConfirm={() => {
                setConsented(true);
                void handleImportEverything();
              }}
              onCancel={() => void handleCancel()}
            />
          ) : null}

          {showGraph ? (
            <ImportGraphCard
              text={text}
              graph={graph}
              rootKey={graphRootKey}
              hasMissing={missingCount > 0}
              onExpand={() => setGraphDialogRootKey(graphRootKey)}
              onResolveMissing={handleResolveMissing}
            />
          ) : null}

          <DependenciesCard
            text={text}
            format={format}
            currentTarget={currentTarget}
            allResolved={allResolved}
            isTargetImported={isTargetImported}
            missing={missing}
            isUploading={isUploading}
            highlightDependencyId={highlightDependencyId}
            versionDrafts={versionDrafts}
            onDraftChange={(depId, value) =>
              setVersionDrafts((prev) => ({
                ...prev,
                [depId]: value,
              }))
            }
            onSetVersion={(depId, value) => void setVersionSelection(depId, value)}
            onClearVersion={(depId) => void clearVersionSelection(depId)}
            onCopy={(link) => void handleCopy(link)}
            getDownloadUrl={getDownloadUrl}
            onImportDirectly={(id, version) => void handleImportFromRegistry(id, version)}
            onImportAllMissing={() => void handleImportAllMissing()}
            onUpload={(files) => void handleUpload(files)}
            advancedMode={advancedMode}
          />

          {advancedMode ? (
            <VersionChoicesCard
              text={text}
              decisions={decisions}
              onPickVersion={(depId: string, value: string) =>
                void setVersionSelection(depId, value)
              }
            />
          ) : null}

          <ImportHistoryCard text={text} importHistory={importHistory} show={!currentTarget} />

          <ImportLogCard
            text={text}
            format={format}
            title={text.importLog}
            description={logCardConfig.description}
            log={logToShow}
          />
        </>
      )}

      <DependencyGraphDialog
        open={Boolean(graphDialogRootKey)}
        onOpenChange={(open) => {
          if (!open) setGraphDialogRootKey(null);
        }}
        graph={graph}
        rootKey={graphDialogRootKey}
        title={text.graphTitle}
        description={text.graphDescription}
        labels={{
          target: text.graphLegendTarget,
          resolved: text.graphLegendResolved,
          missing: text.graphLegendMissing,
          add: text.graphAddDependency,
          empty: text.graphEmpty,
        }}
        onResolveMissing={handleResolveMissing}
      />
    </div>
  );
};

