"use client";

import type { ChangeEvent } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FileDropzone } from "@/components/ui/file-dropzone";
import type { PackageRecord } from "@/lib/fhir-importer/types";
import type { OverviewText } from "@/components/overview/types";
import { formatText } from "@/components/overview/utils";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  text: OverviewText;
  projectId: string | undefined;
  selectedProjectKey: string | null;
  selectableProjectOptions: PackageRecord[];
  datasetName: string;
  onDatasetNameChange: (name: string) => void;
  onProjectChange: (projectKey: string) => void;
  importDatasetFile: File | null;
  onImportDatasetFileChange: (file: File | null) => void;
  onConfirm: () => void;
};

export const ImportDatasetDialog = ({
  open,
  onOpenChange,
  text,
  projectId,
  selectedProjectKey,
  selectableProjectOptions,
  datasetName,
  onDatasetNameChange,
  onProjectChange,
  importDatasetFile,
  onImportDatasetFileChange,
  onConfirm,
}: Props) => {
  const handleProjectChange = (event: ChangeEvent<HTMLSelectElement>) => {
    onProjectChange(event.target.value);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{text.importDatasetDialogTitle}</DialogTitle>
          <DialogDescription>
            {formatText(text.importDatasetDialogDescription, {
              project: projectId ?? text.thisProject,
            })}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="grid gap-2">
            <Label htmlFor="dataset-import-project">{text.projectLabel}</Label>
            <select
              id="dataset-import-project"
              value={selectedProjectKey ?? ""}
              onChange={handleProjectChange}
              className="h-9 rounded-md border border-foreground/20 bg-background px-3 text-sm"
            >
              <option value="">{text.selectProject}</option>
              {selectableProjectOptions.map((project) => (
                <option key={project.key} value={project.key}>
                  {project.id}@{project.version}
                </option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground">{text.chooseProjectHint}</p>
          </div>
          <div className="grid gap-2">
            <Label>{text.datasetFileLabel}</Label>
            <FileDropzone
              label={text.uploadDatasetFileLabel}
              helperText={text.uploadDatasetHelper}
              accept=".json,.zip,application/json,application/zip,application/x-zip-compressed"
              hint={text.uploadDatasetHint}
              chooseButtonLabel={text.chooseFile}
              multiple={false}
              enableClipboard
              clipboardButtonLabel={text.pasteJson}
              clipboardHint={text.clipboardHint}
              clipboardFilename={text.clipboardFilename}
              onFiles={(files) => onImportDatasetFileChange(files[0] ?? null)}
            />
            {importDatasetFile ? (
              <div className="flex items-center justify-between rounded-md border border-foreground/10 bg-muted/20 px-3 py-2 text-xs">
                <span className="truncate text-foreground" title={importDatasetFile.name}>
                  {text.selectedPrefix} {importDatasetFile.name}
                </span>
                <Button type="button" size="sm" variant="ghost" onClick={() => onImportDatasetFileChange(null)}>
                  {text.clear}
                </Button>
              </div>
            ) : null}
            <p className="text-xs text-muted-foreground">{text.datasetFileSupportHint}</p>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="dataset-import-name">{text.fallbackNameLabel}</Label>
            <Input
              id="dataset-import-name"
              value={datasetName}
              onChange={(event) => onDatasetNameChange(event.target.value)}
              placeholder={text.datasetNamePlaceholder}
            />
            <p className="text-xs text-muted-foreground">{text.fallbackNameHint}</p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {text.cancel}
          </Button>
          <Button variant="secondary" onClick={onConfirm}>
            {text.importDatasetConfirm}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

