"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { PackageRecord } from "@/lib/fhir-importer/types";
import type { DatasetRecord } from "@/lib/datasets/storage";
import type { OverviewText } from "@/components/overview/types";
import { MoreHorizontal } from "lucide-react";
import { formatTimestamp } from "@/components/overview/utils";

type Props = {
  text: OverviewText;
  datasets: DatasetRecord[];
  projectByKey: Map<string, PackageRecord>;
  selectableProjectOptions: PackageRecord[];
  isProjectDatasetSelectable: (projectKey: string) => boolean;
  onCreateDatasetFromList: () => void;
  onOpenExportDialog: (project: PackageRecord) => void;
  onOpenDatasetInfo: (dataset: DatasetRecord) => void;
  onDuplicateDataset: (dataset: DatasetRecord) => void;
  onExportDataset: (dataset: DatasetRecord) => void;
  onDeleteDataset: (dataset: DatasetRecord) => void;
};

export const DatasetsView = ({
  text,
  datasets,
  projectByKey,
  selectableProjectOptions,
  isProjectDatasetSelectable,
  onCreateDatasetFromList,
  onOpenExportDialog,
  onOpenDatasetInfo,
  onDuplicateDataset,
  onExportDataset,
  onDeleteDataset,
}: Props) => {
  return (
    <section className="grid gap-4">
      {datasets.length === 0 ? (
        <Card className="border-dashed border-foreground/20">
          <CardHeader>
            <CardTitle>{text.noDatasetsTitle}</CardTitle>
            <CardDescription>{text.noDatasetsDescription}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Button asChild size="sm" variant="outline">
              <Link href="/importer">{text.importProject}</Link>
            </Button>
            <Button
              size="sm"
              variant="secondary"
              disabled={selectableProjectOptions.length === 0}
              onClick={onCreateDatasetFromList}
            >
              {text.createDataset}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {datasets.map((dataset) => {
            const project = projectByKey.get(dataset.projectKey);
            return (
              <Card key={dataset.id} className="border-foreground/10">
                <CardHeader>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <CardTitle className="text-lg">{dataset.name}</CardTitle>
                      <CardDescription>{dataset.projectKey}</CardDescription>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button size="icon-sm" variant="ghost" aria-label={text.datasetActionsAria}>
                          <MoreHorizontal className="size-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          disabled={!isProjectDatasetSelectable(dataset.projectKey)}
                          onClick={() => onOpenDatasetInfo(dataset)}
                        >
                          {text.editDatasetInfo}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          disabled={!isProjectDatasetSelectable(dataset.projectKey)}
                          onClick={() => onDuplicateDataset(dataset)}
                        >
                          {text.duplicateDataset}
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => onExportDataset(dataset)}>
                          {text.exportDataset}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem variant="destructive" onClick={() => onDeleteDataset(dataset)}>
                          {text.deleteDataset}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </CardHeader>
                <CardContent className="grid gap-3">
                  <div className="text-xs text-muted-foreground">
                    <div>
                      {text.createdPrefix}: {formatTimestamp(dataset.createdAt)}
                    </div>
                    <div>
                      {text.projectPrefix}{" "}
                      {project?.manifest.title ?? project?.manifest.name ?? project?.id ?? text.unknownProject}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button asChild size="sm" variant="secondary">
                      <Link href={`/${dataset.id}`}>{text.open}</Link>
                    </Button>
                    {project ? (
                      <Button size="sm" variant="outline" onClick={() => onOpenExportDialog(project)}>
                        {text.exportProjectButton}
                      </Button>
                    ) : null}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </section>
  );
};

