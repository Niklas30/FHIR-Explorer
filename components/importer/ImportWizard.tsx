"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FileDropzone } from "@/components/importer/FileDropzone";
import { useImporter } from "@/components/importer/useImporter";
import type { DependencyRequirement } from "@/lib/fhir-importer/types";
import {
  isComposeProjectArchive,
  isComposeProjectExport,
  type ComposeDatasetExport,
  type ComposePackageExport,
  type ComposeProjectExport,
} from "@/lib/fhir-importer/compose";
import { upsertDataset, type DatasetRecord } from "@/lib/datasets/storage";
import { hydrateDatasetResources, saveDatasetResources } from "@/lib/datasets/content";
import { toast } from "sonner";
import JSZip from "jszip";

const formatRequirement = (dependency: DependencyRequirement) => {
  if (dependency.exactVersion) {
    return dependency.exactVersion;
  }
  if (dependency.ranges.length === 1) {
    return dependency.ranges[0];
  }
  return dependency.ranges.join(", ");
};

export const ImportWizard = () => {
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
    importComposeProject,
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
  const [completedSummary, setCompletedSummary] = useState<{
    targetKey: string;
    log: string[];
  } | null>(null);
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
  }, [currentTarget?.id, currentTarget?.version]);

  const dependencyState = snapshot?.dependencyState;
  const missing = dependencyState?.missing ?? [];
  const conflicts = dependencyState?.conflicts ?? [];
  const packages = snapshot?.packages ?? [];
  const trimmedPackageId = packageId.trim();
  const trimmedVersion = version.trim();

  const targetKey = currentTarget ? `${currentTarget.id}@${currentTarget.version}` : null;
  const isTargetImported = targetKey
    ? packages.some((pkg) => pkg.key === targetKey)
    : false;
  const targetDownloadUrl = currentTarget
    ? getDownloadUrl(currentTarget.id, currentTarget.version)
    : null;

  const handleCopy = async (link: string) => {
    if (typeof navigator === "undefined") return;
    await navigator.clipboard.writeText(link);
  };

  const importedCount = packages.length;
  const missingCount = missing.length;
  const allResolved = Boolean(
    currentTarget && isTargetImported && missing.length === 0 && conflicts.length === 0
  );
  const importedDependencies = packages.filter((pkg) => pkg.key !== targetKey);
  const importedTargetText = currentTarget
    ? `${currentTarget.id}@${currentTarget.version}`
    : "None";
  const isTargetReady = Boolean(currentTarget && isTargetImported);
  const importedDefinitions = snapshot?.resourceIndexCount ?? 0;
  const lastImport = completedSummary;
  const lastImportLog = completedSummary?.log ?? [];
  const importHistory = snapshot?.state.importHistory ?? [];

  const parsePackageKey = (key: string) => {
    const index = key.lastIndexOf("@");
    if (index <= 0) return { id: key, version: "" };
    return { id: key.slice(0, index), version: key.slice(index + 1) };
  };

  const createDatasetId = () =>
    `dataset-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

  const importComposeBundle = async (bundle: ComposeProjectExport) => {
    const result = await importComposeProject(bundle);
    if (!result) {
      return "Failed to import compose project file.";
    }
    const datasets = bundle.datasets ?? [];

    if (datasets.length > 0) {
      for (const dataset of datasets) {
        if (!dataset?.name) continue;
        const datasetId = dataset.id ?? createDatasetId();
        const record: DatasetRecord = {
          id: datasetId,
          name: dataset.name,
          projectKey: dataset.projectKey ?? bundle.targetKey ?? "imported",
          createdAt: Date.now(),
        };
        upsertDataset(record);
        const resources = hydrateDatasetResources(
          Array.isArray(dataset.resources) ? dataset.resources : []
        );
        saveDatasetResources(datasetId, resources);
      }
    }

    return `Compose project imported (${result.imported} packages, ${result.skipped} skipped).`;
  };

  const parseComposeZip = async (file: File): Promise<ComposeProjectExport | null> => {
    try {
      const buffer = await file.arrayBuffer();
      const zip = await JSZip.loadAsync(buffer);
      const manifestFile = zip.file("compose-project.json");
      if (!manifestFile) return null;

      const manifestText = await manifestFile.async("text");
      const manifest = JSON.parse(manifestText);

      if (isComposeProjectExport(manifest)) {
        return manifest;
      }

      if (!isComposeProjectArchive(manifest)) return null;

      const packages: ComposePackageExport[] = [];
      for (const entry of manifest.packages) {
        const pkgFile = zip.file(entry.file);
        if (!pkgFile) continue;
        const pkgText = await pkgFile.async("text");
        packages.push(JSON.parse(pkgText) as ComposePackageExport);
      }

      const datasets: ComposeDatasetExport[] = [];
      for (const entry of manifest.datasets ?? []) {
        const datasetFile = zip.file(entry.file);
        if (!datasetFile) continue;
        const datasetText = await datasetFile.async("text");
        datasets.push(JSON.parse(datasetText) as ComposeDatasetExport);
      }

      return {
        type: "fhir-explorer-project",
        version: 1,
        targetKey: manifest.targetKey,
        exportedAt: manifest.exportedAt,
        packages,
        datasets,
      };
    } catch (err) {
      console.error(err);
      return null;
    }
  };

  const maybeImportComposeProject = async (file: File) => {
    const name = file.name.toLowerCase();
    const isJson =
      name.endsWith(".json") ||
      file.type === "application/json" ||
      file.type === "text/json";
    const isZip = name.endsWith(".zip") || file.type === "application/zip";

    try {
      if (isZip) {
        const bundle = await parseComposeZip(file);
        if (!bundle) return null;
        return await importComposeBundle(bundle);
      }

      if (!isJson) return null;
      const text = await file.text();
      const parsed = JSON.parse(text);
      if (!isComposeProjectExport(parsed)) {
        return null;
      }
      return await importComposeBundle(parsed);
    } catch (err) {
      console.error(err);
      return "Failed to import compose project file.";
    }
  };

  const handleUpload = async (files: File[]) => {
    setUploadNotice(null);
    const missingIds = new Set(missing.map((dep) => dep.id));
    setIsUploading(true);
    const notices: string[] = [];

    for (const file of files) {
      const composeNotice = await maybeImportComposeProject(file);
      if (composeNotice) {
        notices.push(composeNotice);
        continue;
      }

      const result = await importFile(file);
      if (!result) continue;
      const parsed = parsePackageKey(result.packageKey);

      if (result.status === "duplicate") {
        notices.push(`Package ${result.packageKey} is already imported.`);
      } else if (
        currentTarget &&
        parsed.id === currentTarget.id &&
        parsed.version === currentTarget.version
      ) {
        notices.push(`Target package ${result.packageKey} imported.`);
      } else if (missingIds.has(parsed.id)) {
        notices.push(`Dependency ${result.packageKey} imported.`);
      } else {
        notices.push(
          `Package ${result.packageKey} imported, but it was not listed as missing.`
        );
      }
    }

    setIsUploading(false);
    if (notices.length > 0) {
      setUploadNotice(notices.join(" "));
    }
  };

  const handleTargetUpload = async (files: File[]) => {
    setUploadNotice(null);
    setIsUploading(true);
    const notices: string[] = [];

    for (const file of files) {
      const composeNotice = await maybeImportComposeProject(file);
      if (composeNotice) {
        notices.push(composeNotice);
        continue;
      }

      const result = await importTargetFile(file);
      if (!result) continue;

      if (result.status === "duplicate") {
        notices.push(`Target package ${result.packageKey} is already imported.`);
      } else {
        notices.push(`Target package ${result.packageKey} imported.`);
      }
    }

    setIsUploading(false);
    if (notices.length > 0) {
      setUploadNotice(notices.join(" "));
    }
  };

  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setImportLog((prev) => [`${timestamp} — ${message}`, ...prev].slice(0, 50));
  };

  useEffect(() => {
    if (progress.phase !== "idle") {
      toast.loading(progress.message ?? "Importing package", {
        id: progressToastId.current,
      });
    } else {
      toast.dismiss(progressToastId.current);
    }
  }, [progress.phase, progress.message]);

  useEffect(() => {
    if (!lastResult) return;
    if (lastResultRef.current === lastResult.packageKey) return;
    lastResultRef.current = lastResult.packageKey;

    const message =
      lastResult.status === "duplicate"
        ? `Package ${lastResult.packageKey} already imported.`
        : `Imported ${lastResult.packageKey}.`;

    toast.success(message);
    addLog(message);
  }, [lastResult]);

  useEffect(() => {
    if (!error) return;
    toast.error(error);
    addLog(`Error: ${error}`);
  }, [error]);

  useEffect(() => {
    if (!uploadNotice || uploadNotice === lastNoticeRef.current) return;
    lastNoticeRef.current = uploadNotice;
    toast.info(uploadNotice);
    addLog(uploadNotice);
  }, [uploadNotice]);

  useEffect(() => {
    if (!allResolved || !currentTarget) return;
    const targetKey = `${currentTarget.id}@${currentTarget.version}`;
    if (completionHandledRef.current === targetKey) return;
    completionHandledRef.current = targetKey;
    setCompletedSummary({
      targetKey,
      log: importLog.slice(0, 100),
    });
    (async () => {
      await addImportHistory(targetKey);
      await finalizeTarget();
      setPackageId("");
      setVersion("");
      setVersionDrafts({});
      setUploadNotice(null);
      setImportLog([]);
    })();
  }, [allResolved, currentTarget, importLog, finalizeTarget, addImportHistory]);

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-8">
      <header className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground">
              FHIR Importer
            </p>
            <h1 className="text-3xl font-semibold text-foreground">Package Import</h1>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {currentTarget ? (
              !allResolved ? (
                <Button
                  variant="outline"
                  onClick={async () => {
                    await clearTarget();
                    setPackageId("");
                    setVersion("");
                    setVersionDrafts({});
                    setUploadNotice(null);
                    setImportLog([]);
                  }}
                >
                  Cancel Import
                </Button>
              ) : null
            ) : null}
            <Button asChild variant="ghost" size="sm">
              <Link href="/">Projects Overview</Link>
            </Button>
            <Button asChild variant="ghost" size="sm">
              <Link href="/">Home</Link>
            </Button>
          </div>
        </div>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Import FHIR packages and every transitive dependency entirely in the browser.
          The wizard updates after each upload.
        </p>
        <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
          <span>Imported: {importedCount}</span>
          <span>Missing: {missingCount}</span>
          <span>Definitions: {importedDefinitions}</span>
          <span>
            Target: {currentTarget ? `${currentTarget.id}@${currentTarget.version}` : "None"}
          </span>
        </div>
        {lastImport ? (
          <Card className="border-foreground/20 bg-muted/20">
            <CardHeader>
              <CardTitle>Import Successful</CardTitle>
              <CardDescription>
                {lastImport.targetKey} was imported successfully. You can start a new import below or go to the Projects Overview.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild size="lg" className="w-full">
                <Link href="/">Go to Projects Overview</Link>
              </Button>
            </CardContent>
          </Card>
        ) : null}
        {isTargetReady ? (
          <div className="rounded-lg border border-foreground/10 bg-muted/30 px-4 py-3 text-xs text-muted-foreground">
            Target imported: {importedTargetText}
          </div>
        ) : null}
      </header>

      {!isTargetReady || allResolved ? (
        <Card>
          <CardHeader>
            <CardTitle>Target Package</CardTitle>
            <CardDescription>
              {currentTarget
                ? "Target set. Download the package and upload it to start the import."
                : "Upload the target package directly or enter id + version."}
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            {currentTarget ? (
              <>
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-foreground/10 bg-muted/30 px-4 py-3 text-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-foreground">Import started for:</span>
                    <span className="text-foreground">
                      {currentTarget.id}@{currentTarget.version}
                    </span>
                  </div>
                  {targetDownloadUrl ? (
                    <div className="flex flex-wrap items-center gap-2">
                      <Button asChild size="sm" variant="secondary">
                        <a href={targetDownloadUrl} target="_blank" rel="noreferrer">
                          Download (packages2.fhir.org)
                        </a>
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleCopy(targetDownloadUrl)}
                      >
                        Copy Link
                      </Button>
                    </div>
                  ) : null}
                </div>
                <FileDropzone
                  label="Upload target package (.tgz)"
                  helperText="Download the target from packages2.fhir.org, then upload it here to start the import."
                  disabled={isUploading}
                  accept=".tgz,.json,.zip,application/gzip,application/x-gzip,application/json,application/zip"
                  hint="Drag & drop the target .tgz file here"
                  onFiles={handleTargetUpload}
                />
              </>
            ) : (
              <>
                <FileDropzone
                  label="Upload target package (.tgz) or compose project (.json/.zip)"
                  helperText="The package must contain package/package.json"
                  disabled={isUploading}
                  accept=".tgz,.json,.zip,application/gzip,application/x-gzip,application/json,application/zip"
                  hint="Drag & drop .tgz, .json, or .zip files here"
                  onFiles={handleTargetUpload}
                />
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="grid gap-2">
                    <Label htmlFor="package-id">Package ID</Label>
                    <Input
                      id="package-id"
                      value={packageId}
                      onChange={(event) => setPackageId(event.target.value)}
                      placeholder="de.gematik.fhir.directory"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="package-version">Version</Label>
                    <Input
                      id="package-version"
                      value={version}
                      onChange={(event) => setVersion(event.target.value)}
                      placeholder="1.0.0"
                    />
                  </div>
                  <div className="flex items-end">
                    <Button
                      className="w-full"
                      disabled={!trimmedPackageId || !trimmedVersion}
                      onClick={() => setTarget(trimmedPackageId, trimmedVersion)}
                    >
                      Set Target
                    </Button>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      ) : null}

      {currentTarget && !allResolved ? (
        <Card>
          <CardHeader>
            <CardTitle>Dependencies</CardTitle>
            <CardDescription>
              Upload any missing dependency in any order. You can start multiple downloads at once.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            {!isTargetImported ? (
              <div className="rounded-lg border border-foreground/10 bg-muted/30 px-4 py-3">
                <p className="text-sm text-foreground">
                  Upload the target package to detect its dependencies.
                </p>
              </div>
            ) : missing.length === 0 ? (
              <div className="rounded-lg border border-foreground/10 bg-muted/30 px-4 py-3">
                <p className="text-sm text-foreground">All dependencies resolved.</p>
              </div>
            ) : (
              <div className="grid gap-3">
                {missing.map((dependency) => {
                  const selectedVersion = dependency.exactVersion ?? dependency.chosenVersion;
                  const link = selectedVersion
                    ? getDownloadUrl(dependency.id, selectedVersion)
                    : null;
                  const draftValue =
                    versionDrafts[dependency.id] ?? dependency.chosenVersion ?? "";
                  const needsSelection = !dependency.exactVersion;

                  return (
                    <div
                      key={dependency.id}
                      className="rounded-xl border border-foreground/10 bg-background px-4 py-4"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-foreground">{dependency.id}</p>
                          <p className="text-xs text-muted-foreground">
                            Required: {formatRequirement(dependency)}
                          </p>
                        </div>
                      </div>

                      {needsSelection ? (
                        <div className="mt-3 grid gap-3 md:grid-cols-[1fr_auto_auto]">
                          <div className="grid gap-2">
                            <Label htmlFor={`version-${dependency.id}`}>Choose version</Label>
                            <Input
                              id={`version-${dependency.id}`}
                              value={draftValue}
                              onChange={(event) =>
                                setVersionDrafts((prev) => ({
                                  ...prev,
                                  [dependency.id]: event.target.value,
                                }))
                              }
                              placeholder="1.2.3"
                            />
                          </div>
                          <div className="flex items-end">
                            <Button
                              variant="secondary"
                              disabled={!draftValue}
                              onClick={() => setVersionSelection(dependency.id, draftValue)}
                            >
                              Set Version
                            </Button>
                          </div>
                          {dependency.chosenVersion ? (
                            <div className="flex items-end">
                              <Button
                                variant="ghost"
                                onClick={() => clearVersionSelection(dependency.id)}
                              >
                                Clear
                              </Button>
                            </div>
                          ) : null}
                        </div>
                      ) : null}

                      <div className="mt-3 flex flex-col gap-2">
                        <div className="flex flex-wrap items-center gap-2 text-sm">
                          <span className="font-medium text-foreground">Download:</span>
                          <span className="text-muted-foreground">
                            {link ?? "Select a version to generate a link"}
                          </span>
                          {link ? (
                            <div className="flex flex-wrap items-center gap-2">
                              <Button asChild size="sm" variant="secondary">
                                <a href={link} target="_blank" rel="noreferrer">
                                  Open Link
                                </a>
                              </Button>
                              <Button size="sm" variant="outline" onClick={() => handleCopy(link)}>
                                Copy Link
                              </Button>
                            </div>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            {missing.length > 0 ? (
              <FileDropzone
                label="Upload package (.tgz) or compose project (.json/.zip)"
                helperText="Upload target or dependency packages. The importer will detect matches."
                disabled={!currentTarget || isUploading}
                accept=".tgz,.json,.zip,application/gzip,application/x-gzip,application/json,application/zip"
                hint="Drag & drop .tgz, .json, or .zip files here"
                onFiles={handleUpload}
              />
            ) : null}
            {null}
          </CardContent>
        </Card>
      ) : null}

      {!currentTarget ? (
        <Card>
          <CardHeader>
            <CardTitle>Import History</CardTitle>
            <CardDescription>Previously imported target packages.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-2 text-sm text-muted-foreground">
            {importHistory.length === 0 ? (
              <div className="rounded-lg border border-foreground/10 px-3 py-2 text-xs text-muted-foreground">
                No imports yet.
              </div>
            ) : (
              importHistory.map((entry) => (
                <div
                  key={`${entry.targetKey}-${entry.completedAt}`}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-foreground/10 px-3 py-2"
                >
                  <span className="text-foreground">{entry.targetKey}</span>
                  <span className="text-xs text-muted-foreground">
                    {new Date(entry.completedAt).toLocaleString()}
                  </span>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      ) : null}

      {currentTarget ? (
        <Card>
          <CardHeader>
            <CardTitle>Import Log</CardTitle>
            <CardDescription>Latest actions during this import.</CardDescription>
          </CardHeader>
          <CardContent>
            <details className="rounded-lg border border-foreground/10 bg-muted/30 px-4 py-3">
              <summary className="cursor-pointer text-sm font-medium text-foreground">
                Show log ({importLog.length})
              </summary>
              <div className="mt-3 flex max-h-64 flex-col gap-2 overflow-auto text-xs text-muted-foreground">
                {importLog.length === 0 ? (
                  <span>No log entries yet.</span>
                ) : (
                  importLog.map((entry, index) => <span key={index}>{entry}</span>)
                )}
              </div>
            </details>
          </CardContent>
        </Card>
      ) : lastImportLog.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Import Log</CardTitle>
            <CardDescription>History of the last completed import.</CardDescription>
          </CardHeader>
          <CardContent>
            <details className="rounded-lg border border-foreground/10 bg-muted/30 px-4 py-3">
              <summary className="cursor-pointer text-sm font-medium text-foreground">
                Show log ({lastImportLog.length})
              </summary>
              <div className="mt-3 flex max-h-64 flex-col gap-2 overflow-auto text-xs text-muted-foreground">
                {lastImportLog.map((entry, index) => (
                  <span key={index}>{entry}</span>
                ))}
              </div>
            </details>
          </CardContent>
        </Card>
      ) : null}

      {conflicts.length > 0 && (
        <Card className="border-destructive/40">
          <CardHeader>
            <CardTitle>Conflicts</CardTitle>
            <CardDescription>Resolve these before the import is complete.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-2">
            {conflicts.map((conflict) => (
              <div
                key={conflict.id}
                className="rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2"
              >
                <p className="text-sm font-semibold text-foreground">{conflict.id}</p>
                <p className="text-xs text-muted-foreground">
                  {conflict.conflictReason ?? "Version conflict"}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
};
