"use client";

import { useCallback } from "react";
import { maybeImportComposeProject } from "@/components/importer/import-wizard/composeProjectImport";
import { parsePackageKey } from "@/components/importer/import-wizard/helpers";
import type { ComposeProjectExport } from "@/lib/fhir-importer/compose";
import type {
  DependencyRequirement,
  ImportResult,
  PackageRef,
} from "@/lib/fhir-importer/types";
import type { useImportWizardText } from "@/components/importer/import-wizard/text";

/**
 * Importing packages the user hands over as files.
 *
 * Still the way in for a package no registry serves, an archive from a
 * colleague, or a whole project export — so it stays, alongside the registry
 * path, rather than being replaced by it.
 */

type FileImportOptions = {
  importFile: (file: File) => Promise<ImportResult | null>;
  importTargetFile: (file: File) => Promise<ImportResult | null>;
  importComposeProject: (
    bundle: ComposeProjectExport
  ) => Promise<{ imported: number; skipped: number } | null>;
  currentTarget?: PackageRef;
  missing: DependencyRequirement[];
  text: ReturnType<typeof useImportWizardText>["text"];
  format: ReturnType<typeof useImportWizardText>["format"];
  setUploadNotice: (notice: string | null) => void;
  setIsUploading: (uploading: boolean) => void;
};

export const useFileImport = ({
  importFile,
  importTargetFile,
  importComposeProject,
  currentTarget,
  missing,
  text,
  format,
  setUploadNotice,
  setIsUploading,
}: FileImportOptions) => {
  const handleUpload = useCallback(
    async (files: File[]) => {
      setUploadNotice(null);
      const missingIds = new Set(missing.map((dep) => dep.id));
      setIsUploading(true);
      const notices: string[] = [];

      for (const file of files) {
        const composeNotice = await maybeImportComposeProject({
          file,
          importComposeProject,
          text,
          format,
        });
        if (composeNotice) {
          notices.push(composeNotice);
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
    [currentTarget, format, importComposeProject, importFile, missing, setIsUploading, setUploadNotice, text]
  );

  const handleTargetUpload = useCallback(
    async (files: File[]) => {
      setUploadNotice(null);
      setIsUploading(true);
      const notices: string[] = [];

      for (const file of files) {
        const composeNotice = await maybeImportComposeProject({
          file,
          importComposeProject,
          text,
          format,
        });
        if (composeNotice) {
          notices.push(composeNotice);
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
    [format, importComposeProject, importTargetFile, setIsUploading, setUploadNotice, text]
  );

  return { handleUpload, handleTargetUpload };
};
