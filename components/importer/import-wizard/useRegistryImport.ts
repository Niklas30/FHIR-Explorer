"use client";

import { useCallback } from "react";
import type { ImporterSnapshot, ImportResult, PackageRef } from "@/lib/fhir-importer/types";
import type { useImportWizardText } from "@/components/importer/import-wizard/text";

/**
 * Importing straight from a package registry, without the download-and-upload
 * round trip the browser used to force on the user.
 *
 * Kept out of the wizard component because it is the only part of it that
 * talks to the network on its own, and because walking a dependency tree is a
 * loop with its own termination rules rather than a click handler.
 */

type RegistryImportOptions = {
  importFromRegistry: (
    id: string,
    version: string,
    options?: { asTarget?: boolean; url?: string }
  ) => Promise<ImportResult | null>;
  refresh: () => Promise<ImporterSnapshot | null>;
  currentTarget?: PackageRef;
  text: ReturnType<typeof useImportWizardText>["text"];
  format: ReturnType<typeof useImportWizardText>["format"];
  setUploadNotice: (notice: string | null) => void;
  setIsUploading: (uploading: boolean) => void;
};

export const useRegistryImport = ({
  importFromRegistry,
  refresh,
  currentTarget,
  text,
  format,
  setUploadNotice,
  setIsUploading,
}: RegistryImportOptions) => {
  /**
   * Fetch one package from a registry and import it, no download required.
   *
   * Only the registries that answer archive requests with CORS headers can be
   * read from the browser, so this can come up empty — the download link is
   * still there for those, and the error says so.
   */
  const handleImportFromRegistry = useCallback(
    async (id: string, version: string, asTarget = false, url?: string) => {
      setUploadNotice(null);
      setIsUploading(true);
      const result = await importFromRegistry(id, version, { asTarget, url });
      setIsUploading(false);
      if (result) {
        setUploadNotice(
          result.status === "duplicate"
            ? format(text.packageAlreadyImported, { packageKey: result.packageKey })
            : format(text.importedPackageShort, { packageKey: result.packageKey })
        );
      }
    },
    [format, importFromRegistry, setIsUploading, setUploadNotice, text]
  );

  /** The target package itself, which the user would otherwise upload first. */
  const handleImportTarget = useCallback(() => {
    if (!currentTarget) return;
    void handleImportFromRegistry(currentTarget.id, currentTarget.version, true);
  }, [currentTarget, handleImportFromRegistry]);

  /**
   * Import every missing dependency, then whatever those turned out to need.
   *
   * The tree is only known one layer at a time — a package's dependencies are
   * read from its manifest, which arrives with the package — so this walks
   * layer by layer, re-reading the snapshot after each one. The round limit is
   * a guard against a cycle, not an expected depth.
   */
  const handleImportAllMissing = useCallback(async () => {
    setUploadNotice(null);
    setIsUploading(true);
    let imported = 0;

    for (let round = 0; round < 12; round += 1) {
      const snapshot = await refresh();
      const pending = (snapshot?.dependencyState.missing ?? [])
        .map((dependency) => ({
          id: dependency.id,
          version: dependency.exactVersion ?? dependency.chosenVersion,
        }))
        // A range with no version chosen yet needs the user to pick one first.
        .filter((entry): entry is { id: string; version: string } => Boolean(entry.version));
      if (pending.length === 0) break;

      let progressed = false;
      for (const entry of pending) {
        const result = await importFromRegistry(entry.id, entry.version);
        if (result) {
          imported += 1;
          progressed = true;
        }
      }
      // Nothing in this layer could be fetched; another round would only
      // repeat the same failures.
      if (!progressed) break;
    }

    setIsUploading(false);
    if (imported > 0) {
      setUploadNotice(format(text.importedFromRegistry, { count: imported }));
    }
  }, [format, importFromRegistry, refresh, setIsUploading, setUploadNotice, text]);

  /**
   * The whole tree in one action, once the user has agreed to it: the package,
   * then everything it turns out to need. The layer-by-layer mechanics are an
   * implementation detail, not a workflow to walk anyone through — but they
   * are only started from the consent step, never from naming a package.
   */
  const handleImportEverything = useCallback(async () => {
    if (!currentTarget) return;
    await handleImportFromRegistry(currentTarget.id, currentTarget.version, true);
    await handleImportAllMissing();
  }, [currentTarget, handleImportAllMissing, handleImportFromRegistry]);

  return {
    handleImportFromRegistry,
    handleImportTarget,
    handleImportAllMissing,
    handleImportEverything,
  };
};
