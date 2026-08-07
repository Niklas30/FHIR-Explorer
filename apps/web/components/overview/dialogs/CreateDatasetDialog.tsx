"use client";

import type { ChangeEvent } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  onConfirm: () => void;
};

export const CreateDatasetDialog = ({
  open,
  onOpenChange,
  text,
  projectId,
  selectedProjectKey,
  selectableProjectOptions,
  datasetName,
  onDatasetNameChange,
  onProjectChange,
  onConfirm,
}: Props) => {
  const handleChange = (event: ChangeEvent<HTMLSelectElement>) => {
    onProjectChange(event.target.value);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{text.createDatasetDialogTitle}</DialogTitle>
          <DialogDescription>
            {formatText(text.createDatasetDialogDescription, {
              project: projectId ?? text.thisProject,
            })}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="grid gap-2">
            <Label htmlFor="dataset-project">{text.projectLabel}</Label>
            <select
              id="dataset-project"
              value={selectedProjectKey ?? ""}
              onChange={handleChange}
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
          <Label htmlFor="dataset-name">{text.datasetNameLabel}</Label>
          <Input
            id="dataset-name"
            value={datasetName}
            onChange={(event) => onDatasetNameChange(event.target.value)}
            placeholder={text.datasetNamePlaceholder}
          />
          <p className="text-xs text-muted-foreground">{text.createDatasetHint}</p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {text.cancel}
          </Button>
          <Button onClick={onConfirm}>{text.createDatasetConfirm}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

