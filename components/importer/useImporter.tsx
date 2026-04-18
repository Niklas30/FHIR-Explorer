"use client";

import { useCallback, useEffect, useState } from "react";
import type { ImportProgress, ImporterSnapshot, ImportResult } from "@/lib/fhir-importer/types";
import { ImporterClient } from "@/lib/fhir-importer/client";
import { registryStrategies } from "@/lib/fhir-importer/registry";

type UseImporterResult = {
  snapshot: ImporterSnapshot | null;
  progress: ImportProgress;
  error: string | null;
  lastResult: ImportResult | null;
  setTarget: (id: string, version: string) => Promise<void>;
  clearTarget: () => Promise<void>;
  setVersionSelection: (depId: string, version: string) => Promise<void>;
  clearVersionSelection: (depId: string) => Promise<void>;
  importFile: (file: File) => Promise<ImportResult | null>;
  importTargetFile: (file: File) => Promise<ImportResult | null>;
  addImportHistory: (targetKey: string) => Promise<void>;
  getDownloadUrl: (id: string, version: string) => string;
  refresh: () => Promise<void>;
};

const defaultProgress: ImportProgress = { phase: "idle" };

export const useImporter = (): UseImporterResult => {
  const [client, setClient] = useState<ImporterClient | null>(null);

  const [snapshot, setSnapshot] = useState<ImporterSnapshot | null>(null);
  const [progress, setProgress] = useState<ImportProgress>(defaultProgress);
  const [error, setError] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<ImportResult | null>(null);

  const refresh = useCallback(async () => {
    if (!client) return;
    const latest = await client.loadSnapshot();
    setSnapshot(latest);
  }, [client]);

  useEffect(() => {
    if (!client) return;
    refresh().catch((err) => {
      setError(err instanceof Error ? err.message : "Failed to load importer state");
    });
  }, [client, refresh]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const nextClient = new ImporterClient({
      registry: registryStrategies.packages2,
      useWorker: true,
      storeResourcePayloads: true,
    });
    setClient(nextClient);
  }, []);

  const setTarget = useCallback(
    async (id: string, version: string) => {
      setError(null);
      if (!client) return;
      await client.setCurrentTarget(id, version);
      await refresh();
    },
    [client, refresh]
  );

  const clearTarget = useCallback(async () => {
    setError(null);
    if (!client) return;
    await client.clearCurrentTarget();
    await refresh();
  }, [client, refresh]);

  const setVersionSelection = useCallback(
    async (depId: string, version: string) => {
      setError(null);
      if (!client) return;
      await client.setVersionSelection(depId, version);
      await refresh();
    },
    [client, refresh]
  );

  const clearVersionSelection = useCallback(
    async (depId: string) => {
      setError(null);
      if (!client) return;
      await client.clearVersionSelection(depId);
      await refresh();
    },
    [client, refresh]
  );

  const importFile = useCallback(
    async (file: File) => {
      setError(null);
      setLastResult(null);
      if (!client) return null;
      try {
        const result = await client.importPackageFile(file, (update) => {
          setProgress(update);
        });
        setLastResult(result);
        await refresh();
        return result;
      } catch (err) {
        setError(err instanceof Error ? err.message : "Import failed");
        return null;
      } finally {
        setProgress({ phase: "idle" });
      }
    },
    [client, refresh]
  );

  const importTargetFile = useCallback(
    async (file: File) => {
      setError(null);
      setLastResult(null);
      if (!client) return null;
      try {
        const result = await client.importTargetFile(file, (update) => {
          setProgress(update);
        });
        setLastResult(result);
        await refresh();
        return result;
      } catch (err) {
        setError(err instanceof Error ? err.message : "Import failed");
        return null;
      } finally {
        setProgress({ phase: "idle" });
      }
    },
    [client, refresh]
  );

  const addImportHistory = useCallback(
    async (targetKey: string) => {
      if (!client) return;
      await client.addImportHistory(targetKey);
      await refresh();
    },
    [client, refresh]
  );

  return {
    snapshot,
    progress,
    error,
    lastResult,
    setTarget,
    clearTarget,
    setVersionSelection,
    clearVersionSelection,
    importFile,
    importTargetFile,
    addImportHistory,
    getDownloadUrl: client ? client.getDownloadUrl.bind(client) : () => "",
    refresh,
  };
};
