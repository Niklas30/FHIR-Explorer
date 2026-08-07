"use client";

import { useCallback, useEffect, useState } from "react";
import { useI18n } from "@/components/i18n/I18nProvider";
import type {
  ImportProgress,
  ImporterSnapshot,
  ImportResult,
  ResourcePayload,
} from "@/lib/fhir-importer/types";
import type { ComposeProjectExport } from "@/lib/fhir-importer/compose";
import { ImporterClient } from "@/lib/fhir-importer/client";
import { registryStrategies, resolveImportUrl } from "@/lib/fhir-importer/registry";
import { byLocale } from "@/lib/i18n/select";

type UseImporterResult = {
  snapshot: ImporterSnapshot | null;
  progress: ImportProgress;
  error: string | null;
  lastResult: ImportResult | null;
  setTarget: (id: string, version: string) => Promise<void>;
  clearTarget: () => Promise<void>;
  finalizeTarget: () => Promise<void>;
  setVersionSelection: (depId: string, version: string) => Promise<void>;
  clearVersionSelection: (depId: string) => Promise<void>;
  importFile: (file: File) => Promise<ImportResult | null>;
  importTargetFile: (file: File) => Promise<ImportResult | null>;
  /**
   * Fetch a package straight from a registry and import it, skipping the
   * download-and-upload round trip. Null when no registry the browser may
   * read carries the version, or when the fetch failed.
   */
  importFromRegistry: (
    id: string,
    version: string,
    options?: { asTarget?: boolean; url?: string }
  ) => Promise<ImportResult | null>;
  addImportHistory: (targetKey: string) => Promise<void>;
  deletePackage: (packageKey: string) => Promise<void>;
  clearAllData: () => Promise<void>;
  importComposeProject: (bundle: ComposeProjectExport) => Promise<{
    imported: number;
    skipped: number;
  } | null>;
  getResourcePayloadsByPackageKeys: (packageKeys: string[]) => Promise<ResourcePayload[]>;
  getDownloadUrl: (id: string, version: string) => string;
  /** Reloads and returns the snapshot, so a caller can act on what changed. */
  refresh: () => Promise<ImporterSnapshot | null>;
};

const defaultProgress: ImportProgress = { phase: "idle" };

export const useImporter = (): UseImporterResult => {
  const { locale } = useI18n();
  const [client, setClient] = useState<ImporterClient | null>(null);

  const [snapshot, setSnapshot] = useState<ImporterSnapshot | null>(null);
  const [progress, setProgress] = useState<ImportProgress>(defaultProgress);
  const [error, setError] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<ImportResult | null>(null);
  const text = byLocale(locale, {
    de: {
      failedToLoadState: "Importer-Status konnte nicht geladen werden",
      importFailed: "Import fehlgeschlagen",
      clientNotReady: "Importer-Client ist noch nicht bereit.",
      composeImportFailed: "Import der Projektdatei fehlgeschlagen",
      notFetchable:
        "Dieses Paket kann der Browser nicht selbst laden. Lade es über den Link herunter und hier hoch.",
    },
    en: {
      failedToLoadState: "Failed to load importer state",
      importFailed: "Import failed",
      clientNotReady: "Importer client is not ready yet.",
      composeImportFailed: "Project import failed",
      notFetchable:
        "This package cannot be fetched by the browser. Download it with the link and upload it here.",
    },
    fr: {
      failedToLoadState: "Impossible de charger l'état de l'importateur",
      importFailed: "Échec de l'import",
      clientNotReady: "Le client importateur n'est pas encore prêt.",
      composeImportFailed: "Échec de l'import du projet",
      notFetchable:
        "Le navigateur ne peut pas recuperer ce paquet. Telechargez-le via le lien et televersez-le ici.",
    },
    es: {
      failedToLoadState: "No se pudo cargar el estado del importador",
      importFailed: "Error de importación",
      clientNotReady: "El cliente importador aún no está listo.",
      composeImportFailed: "Error al importar el proyecto",
      notFetchable:
        "El navegador no puede descargar este paquete. Usa el enlace y subelo aqui.",
    },
    it: {
      failedToLoadState: "Impossibile caricare lo stato dell'importatore",
      importFailed: "Importazione non riuscita",
      clientNotReady: "Il client importatore non è ancora pronto.",
      composeImportFailed: "Importazione progetto non riuscita",
      notFetchable:
        "Il browser non puo scaricare questo pacchetto. Usa il link e caricalo qui.",
    },
  });

  const refresh = useCallback(async () => {
    if (!client) return null;
    const latest = await client.loadSnapshot();
    setSnapshot(latest);
    return latest;
  }, [client]);

  useEffect(() => {
    if (!client) return;
    refresh().catch((err) => {
      setError(err instanceof Error ? err.message : text.failedToLoadState);
    });
  }, [client, refresh, text.failedToLoadState]);

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

  const finalizeTarget = useCallback(async () => {
    setError(null);
    if (!client) return;
    await client.finalizeCurrentTarget();
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
        setError(err instanceof Error ? err.message : text.importFailed);
        return null;
      } finally {
        setProgress({ phase: "idle" });
      }
    },
    [client, refresh, text.importFailed]
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
        setError(err instanceof Error ? err.message : text.importFailed);
        return null;
      } finally {
        setProgress({ phase: "idle" });
      }
    },
    [client, refresh, text.importFailed]
  );

  const importFromRegistry = useCallback(
    async (id: string, version: string, options: { asTarget?: boolean; url?: string } = {}) => {
      setError(null);
      setLastResult(null);
      if (!client) return null;
      try {
        setProgress({ phase: "reading", message: `Fetching ${id}@${version}` });
        // An explicit url means the user picked the registry themselves, and
        // that choice is not second-guessed by resolving one again.
        const source = options.url
          ? { url: options.url, registry: options.url, found: true }
          : await resolveImportUrl(id, version);
        if (!source) {
          setError(text.notFetchable);
          return null;
        }

        const response = await fetch(source.url);
        if (!response.ok) {
          throw new Error(`${source.registry} answered ${response.status}`);
        }

        const result = await client.importPackageBuffer(
          await response.arrayBuffer(),
          (update) => setProgress(update),
          { asTarget: options.asTarget }
        );
        setLastResult(result);
        await refresh();
        return result;
      } catch (err) {
        setError(err instanceof Error ? err.message : text.importFailed);
        return null;
      } finally {
        setProgress({ phase: "idle" });
      }
    },
    [client, refresh, text.importFailed, text.notFetchable]
  );

  const addImportHistory = useCallback(
    async (targetKey: string) => {
      if (!client) return;
      await client.addImportHistory(targetKey);
      await refresh();
    },
    [client, refresh]
  );

  const deletePackage = useCallback(
    async (packageKey: string) => {
      if (!client) return;
      await client.deletePackage(packageKey);
      await refresh();
    },
    [client, refresh]
  );

  const clearAllData = useCallback(async () => {
    if (!client) {
      throw new Error(text.clientNotReady);
    }
    await client.clearAllData();
    await refresh();
  }, [client, refresh, text.clientNotReady]);

  const importComposeProject = useCallback(
    async (bundle: ComposeProjectExport) => {
      if (!client) return null;
      try {
        const result = await client.importComposeProject(bundle, (update) => {
          setProgress(update);
        });
        await refresh();
        return result;
      } catch (err) {
        setError(err instanceof Error ? err.message : text.composeImportFailed);
        return null;
      } finally {
        setProgress({ phase: "idle" });
      }
    },
    [client, refresh, text.composeImportFailed]
  );

  const getResourcePayloadsByPackageKeys = useCallback(
    async (packageKeys: string[]) => {
      if (!client) return [];
      return await client.getResourcePayloadsByPackageKeys(packageKeys);
    },
    [client]
  );

  return {
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
    addImportHistory,
    deletePackage,
    clearAllData,
    importComposeProject,
    getResourcePayloadsByPackageKeys,
    getDownloadUrl: client ? client.getDownloadUrl.bind(client) : () => "",
    refresh,
  };
};
