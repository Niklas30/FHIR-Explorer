"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FileDropzone } from "@/components/ui/file-dropzone";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { PackageRef } from "@/lib/fhir-importer/types";
import type { useImportWizardText } from "@/components/importer/import-wizard/text";

export type TargetPackageCardProps = {
  text: ReturnType<typeof useImportWizardText>["text"];
  currentTarget?: PackageRef;
  isTargetReady: boolean;
  allResolved: boolean;
  targetDownloadUrl: string | null;
  isUploading: boolean;
  packageId: string;
  version: string;
  trimmedPackageId: string;
  trimmedVersion: string;
  onPackageIdChange: (next: string) => void;
  onVersionChange: (next: string) => void;
  onSetTarget: (id: string, version: string) => void;
  onCopy: (link: string) => void;
  onTargetUpload: (files: File[]) => void;
};

export const TargetPackageCard = ({
  text,
  currentTarget,
  isTargetReady,
  allResolved,
  targetDownloadUrl,
  isUploading,
  packageId,
  version,
  trimmedPackageId,
  trimmedVersion,
  onPackageIdChange,
  onVersionChange,
  onSetTarget,
  onCopy,
  onTargetUpload,
}: TargetPackageCardProps) => {
  if (isTargetReady && !allResolved) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{text.targetPackage}</CardTitle>
        <CardDescription>
          {currentTarget ? text.targetSetDescription : text.targetUploadOrEnter}
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        {currentTarget ? (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-foreground/10 bg-muted/30 px-4 py-3 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium text-foreground">{text.importStartedFor}</span>
                <span className="text-foreground">
                  {currentTarget.id}@{currentTarget.version}
                </span>
              </div>
              {targetDownloadUrl ? (
                <div className="flex flex-wrap items-center gap-2">
                  <Button asChild size="sm" variant="secondary">
                    <a href={targetDownloadUrl} target="_blank" rel="noreferrer">
                      {text.downloadPackages}
                    </a>
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => onCopy(targetDownloadUrl)}>
                    {text.copyLink}
                  </Button>
                </div>
              ) : null}
            </div>
            <FileDropzone
              label={text.uploadTargetPackage}
              helperText={text.uploadTargetHelper}
              disabled={isUploading}
              accept=".tgz,.json,.zip,application/gzip,application/x-gzip,application/json,application/zip"
              hint={text.uploadTargetHint}
              onFiles={onTargetUpload}
            />
          </>
        ) : (
          <>
            <FileDropzone
              label={text.uploadTargetOrCompose}
              helperText={text.uploadTargetOrComposeHelper}
              disabled={isUploading}
              accept=".tgz,.json,.zip,application/gzip,application/x-gzip,application/json,application/zip"
              hint={text.uploadTargetOrComposeHint}
              onFiles={onTargetUpload}
            />
            <div className="grid gap-4 md:grid-cols-3">
              <div className="grid gap-2">
                <Label htmlFor="package-id">{text.packageId}</Label>
                <Input
                  id="package-id"
                  value={packageId}
                  onChange={(event) => onPackageIdChange(event.target.value)}
                  placeholder="de.gematik.fhir.directory"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="package-version">{text.version}</Label>
                <Input
                  id="package-version"
                  value={version}
                  onChange={(event) => onVersionChange(event.target.value)}
                  placeholder="1.0.0"
                />
              </div>
              <div className="flex items-end">
                <Button
                  className="w-full"
                  disabled={!trimmedPackageId || !trimmedVersion}
                  onClick={() => onSetTarget(trimmedPackageId, trimmedVersion)}
                >
                  {text.setTarget}
                </Button>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};

