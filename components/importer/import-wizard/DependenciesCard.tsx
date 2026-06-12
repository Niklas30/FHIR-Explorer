"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FileDropzone } from "@/components/ui/file-dropzone";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatRequirement } from "@/components/importer/import-wizard/helpers";
import type { DependencyRequirement, PackageRef } from "@/lib/fhir-importer/types";
import type { useImportWizardText } from "@/components/importer/import-wizard/text";

export type DependenciesCardProps = {
  text: ReturnType<typeof useImportWizardText>["text"];
  format: ReturnType<typeof useImportWizardText>["format"];
  currentTarget?: PackageRef;
  allResolved: boolean;
  isTargetImported: boolean;
  missing: DependencyRequirement[];
  isUploading: boolean;
  versionDrafts: Record<string, string>;
  onDraftChange: (depId: string, value: string) => void;
  onSetVersion: (depId: string, value: string) => void;
  onClearVersion: (depId: string) => void;
  onCopy: (link: string) => void;
  getDownloadUrl: (id: string, version: string) => string;
  onUpload: (files: File[]) => void;
};

export const DependenciesCard = ({
  text,
  format,
  currentTarget,
  allResolved,
  isTargetImported,
  missing,
  isUploading,
  versionDrafts,
  onDraftChange,
  onSetVersion,
  onClearVersion,
  onCopy,
  getDownloadUrl,
  onUpload,
}: DependenciesCardProps) => {
  if (!currentTarget || allResolved) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{text.dependencies}</CardTitle>
        <CardDescription>{text.dependenciesDescription}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        {!isTargetImported ? (
          <div className="rounded-lg border border-foreground/10 bg-muted/30 px-4 py-3">
            <p className="text-sm text-foreground">{text.uploadTargetToDetect}</p>
          </div>
        ) : missing.length === 0 ? (
          <div className="rounded-lg border border-foreground/10 bg-muted/30 px-4 py-3">
            <p className="text-sm text-foreground">{text.allDependenciesResolved}</p>
          </div>
        ) : (
          <div className="grid gap-3">
            {missing.map((dependency) => {
              const selectedVersion = dependency.exactVersion ?? dependency.chosenVersion;
              const link = selectedVersion
                ? getDownloadUrl(dependency.id, selectedVersion)
                : null;
              const draftValue = versionDrafts[dependency.id] ?? dependency.chosenVersion ?? "";
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
                        {format(text.required, { value: formatRequirement(dependency) })}
                      </p>
                    </div>
                  </div>

                  {needsSelection ? (
                    <div className="mt-3 grid gap-3 md:grid-cols-[1fr_auto_auto]">
                      <div className="grid gap-2">
                        <Label htmlFor={`version-${dependency.id}`}>{text.chooseVersion}</Label>
                        <Input
                          id={`version-${dependency.id}`}
                          value={draftValue}
                          onChange={(event) => onDraftChange(dependency.id, event.target.value)}
                          placeholder="1.2.3"
                        />
                      </div>
                      <div className="flex items-end">
                        <Button
                          variant="secondary"
                          disabled={!draftValue}
                          onClick={() => onSetVersion(dependency.id, draftValue)}
                        >
                          {text.setVersion}
                        </Button>
                      </div>
                      {dependency.chosenVersion ? (
                        <div className="flex items-end">
                          <Button variant="ghost" onClick={() => onClearVersion(dependency.id)}>
                            {text.clear}
                          </Button>
                        </div>
                      ) : null}
                    </div>
                  ) : null}

                  <div className="mt-3 flex flex-col gap-2">
                    <div className="flex flex-wrap items-center gap-2 text-sm">
                      <span className="font-medium text-foreground">{text.download}</span>
                      <span className="text-muted-foreground">{link ?? text.selectVersionForLink}</span>
                      {link ? (
                        <div className="flex flex-wrap items-center gap-2">
                          <Button asChild size="sm" variant="secondary">
                            <a href={link} target="_blank" rel="noreferrer">
                              {text.openLink}
                            </a>
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => onCopy(link)}>
                            {text.copyLink}
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
            label={text.uploadPackageOrExplorer}
            helperText={text.uploadPackageOrExplorerHelper}
            disabled={!currentTarget || isUploading}
            accept=".tar,.tgz,.json,.zip,application/x-tar,application/tar,application/gzip,application/x-gzip,application/json,application/zip"
            hint={text.uploadPackageOrExplorerHint}
            onFiles={onUpload}
          />
        ) : null}
      </CardContent>
    </Card>
  );
};
