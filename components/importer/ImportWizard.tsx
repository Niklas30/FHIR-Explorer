"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { ConflictsCard } from "@/components/importer/import-wizard/ConflictsCard";
import { maybeImportFhirExplorerProject } from "@/components/importer/import-wizard/fhirExplorerProjectImport";
import { DependenciesCard } from "@/components/importer/import-wizard/DependenciesCard";
import { parsePackageKey } from "@/components/importer/import-wizard/helpers";
import { ImportHistoryCard } from "@/components/importer/import-wizard/ImportHistoryCard";
import { ImportLogCard } from "@/components/importer/import-wizard/ImportLogCard";
import { TargetPackageCard } from "@/components/importer/import-wizard/TargetPackageCard";
import { useImportWizardText } from "@/components/importer/import-wizard/text";
import { WizardHeader } from "@/components/importer/import-wizard/WizardHeader";
import { useImporter } from "@/components/importer/useImporter";
import type { DependencyRequirement } from "@/lib/fhir-importer/types";

type ImportSummary = {
  targetKey: string;
  log: string[];
};

const EMPTY_DEPENDENCIES: DependencyRequirement[] = [];
const EMPTY_PACKAGES: Array<{ key: string }> = [];
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
    importFhirExplorerProject,
    addImportHistory,
    getDownloadUrl,
  } = useImporter();

  const searchParams = useSearchParams();
  const [packageId, setPackageId] = useState("");
  const [version, setVersion] = useState("");
  const [versionDrafts, setVersionDrafts] = useState<Record<string, string>>({});
  const [uploadNotice, setUploadNotice] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [importLog, setImportLog] = useState<string[]>([]);
  const [completedSummary, setCompletedSummary] = useState<ImportSummary | null>(null);
  const lastNoticeRef = useRef<string | null>(null);
  const lastResultRef = useRef<string | null>(null);
  const progressToastId = useRef<string>("import-progress");
  const completionHandledRef = useRef<string | null>(null);

  const currentTarget = snapshot?.state.currentTarget;

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

  useEffect(() => {
    if (currentTarget) {
      setPackageId(currentTarget.id);
      setVersion(currentTarget.version);
      setCompletedSummary(null);
    }
  }, [currentTarget]);

  const dependencyState = snapshot?.dependencyState;
  const missing = dependencyState?.missing ?? EMPTY_DEPENDENCIES;
  const conflicts = dependencyState?.conflicts ?? EMPTY_DEPENDENCIES;
  const packages = snapshot?.packages ?? EMPTY_PACKAGES;
  const trimmedPackageId = packageId.trim();
  const trimmedVersion = version.trim();

  const targetKey = currentTarget ? `${currentTarget.id}@${currentTarget.version}` : null;
  const isTargetImported = targetKey ? packages.some((pkg) => pkg.key === targetKey) : false;
  const targetDownloadUrl = currentTarget ? getDownloadUrl(currentTarget.id, currentTarget.version) : null;

  const importedCount = packages.length;
  const missingCount = missing.length;
  const importedDefinitions = snapshot?.resourceIndexCount ?? 0;
  const allResolved = Boolean(
    currentTarget && isTargetImported && missing.length === 0 && conflicts.length === 0
  );
  const importedTargetText = currentTarget
    ? `${currentTarget.id}@${currentTarget.version}`
    : text.none;
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

  const handleUpload = useCallback(
    async (files: File[]) => {
      setUploadNotice(null);
      const missingIds = new Set(missing.map((dep) => dep.id));
      setIsUploading(true);
      const notices: string[] = [];

      for (const file of files) {
        const explorerNotice = await maybeImportFhirExplorerProject({
          file,
          importFhirExplorerProject,
          text,
          format,
        });
        if (explorerNotice) {
          notices.push(explorerNotice);
          continue;
        }

        const result = await importFile(file);
        if (!result) continue;
        const parsed = parsePackageKey(result.packageKey);

        if (result.status === "duplicate") {
          notices.push(format(text.packageAlreadyImported, { packageKey: result.packageKey }));
        } else if (
          currentTarget &&
          parsed.id === currentTarget.id &&
          parsed.version === currentTarget.version
        ) {
          notices.push(format(text.targetPackageImported, { packageKey: result.packageKey }));
        } else if (missingIds.has(parsed.id)) {
          notices.push(format(text.dependencyImported, { packageKey: result.packageKey }));
        } else {
          notices.push(format(text.packageImportedButNotMissing, { packageKey: result.packageKey }));
        }
      }

      setIsUploading(false);
      if (notices.length > 0) {
        setUploadNotice(notices.join(" "));
      }
    },
    [currentTarget, format, importFhirExplorerProject, importFile, missing, text]
  );

  const handleTargetUpload = useCallback(
    async (files: File[]) => {
      setUploadNotice(null);
      setIsUploading(true);
      const notices: string[] = [];

      for (const file of files) {
        const explorerNotice = await maybeImportFhirExplorerProject({
          file,
          importFhirExplorerProject,
          text,
          format,
        });
        if (explorerNotice) {
          notices.push(explorerNotice);
          continue;
        }

        const result = await importTargetFile(file);
        if (!result) continue;

        if (result.status === "duplicate") {
          notices.push(
            format(text.targetPackageAlreadyImported, { packageKey: result.packageKey })
          );
        } else {
          notices.push(format(text.targetPackageImported, { packageKey: result.packageKey }));
        }
      }

      setIsUploading(false);
      if (notices.length > 0) {
        setUploadNotice(notices.join(" "));
      }
    },
    [format, importFhirExplorerProject, importTargetFile, text]
  );

  const handleCancel = useCallback(async () => {
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

  const logToShow = currentTarget ? importLog : lastImportLog;

  const logCardConfig = useMemo(() => {
    if (currentTarget) {
      return { description: text.latestImportActions };
    }
    return { description: text.importLogHistory };
  }, [currentTarget, text.importLogHistory, text.latestImportActions]);

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-8">
      <WizardHeader
        text={text}
        format={format}
        currentTarget={currentTarget}
        allResolved={allResolved}
        importedCount={importedCount}
        missingCount={missingCount}
        importedDefinitions={importedDefinitions}
        lastImport={completedSummary}
        isTargetReady={isTargetReady}
        importedTargetText={importedTargetText}
        onCancel={handleCancel}
      />

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
        onTargetUpload={(files) => void handleTargetUpload(files)}
      />

      <DependenciesCard
        text={text}
        format={format}
        currentTarget={currentTarget}
        allResolved={allResolved}
        isTargetImported={isTargetImported}
        missing={missing}
        isUploading={isUploading}
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
        onUpload={(files) => void handleUpload(files)}
      />

      <ImportHistoryCard text={text} importHistory={importHistory} show={!currentTarget} />

      <ImportLogCard
        text={text}
        format={format}
        title={text.importLog}
        description={logCardConfig.description}
        log={logToShow}
      />

      <ConflictsCard text={text} conflicts={conflicts} />
    </div>
  );
};

