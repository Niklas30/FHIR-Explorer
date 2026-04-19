"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { GitBranch, MoreHorizontal, Plus, Upload } from "lucide-react";
import { formatText, formatTimestamp } from "@/components/overview/utils";
import type { ProjectCardProps } from "@/components/overview/types";

export const ProjectCard = ({
  kind,
  project,
  dependencyCount,
  owners,
  datasets,
  text,
  onCreateDataset,
  onImportDataset,
  onOpenDependencyTree,
  onOpenExportDialog,
  onExportDataset,
  onEditDatasetInfo,
  onDuplicateDataset,
  onDeleteProject,
  onDeleteDataset,
  canDeleteProject,
  deleteReason,
  datasetActionsDisabled = false,
  datasetActionsDisabledReason,
}: ProjectCardProps) => {
  const title = project.manifest.title ?? project.manifest.name ?? project.id;
  const description = project.manifest.description ?? text.noDescriptionProvided;

  return (
    <Card className="border-foreground/10">
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="text-xl">{title}</CardTitle>
            <CardDescription>{project.key}</CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={kind === "Target" ? "secondary" : "outline"}>
              {kind === "Target" ? text.kindTarget : text.kindDependency}
            </Badge>
            {datasetActionsDisabled ? <Badge variant="outline">{text.importInProgress}</Badge> : null}
            <Badge variant="outline">
              {formatText(text.resourcesCount, { count: project.resourceCount })}
            </Badge>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="icon-sm" variant="ghost" aria-label={text.projectActionsAria}>
                  <MoreHorizontal className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>{text.projectActions}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => onOpenDependencyTree(project)}>
                  <GitBranch className="mr-2 size-4" />
                  {text.showDependencyTree}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onOpenExportDialog(project)}>
                  {text.exportProject}
                </DropdownMenuItem>
                <DropdownMenuItem
                  variant="destructive"
                  disabled={!canDeleteProject}
                  onClick={() => onDeleteProject(project)}
                >
                  {text.deleteProject}
                </DropdownMenuItem>
                {!canDeleteProject && deleteReason ? (
                  <DropdownMenuLabel className="text-xs text-muted-foreground">
                    {deleteReason}
                  </DropdownMenuLabel>
                ) : null}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </CardHeader>
      <CardContent className="grid gap-4">
        <p className="text-sm text-muted-foreground">{description}</p>
        <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
          <span>
            {text.addedPrefix} {formatTimestamp(project.addedAt)}
          </span>
          {typeof dependencyCount === "number" ? (
            <span>
              {text.dependenciesPrefix} {dependencyCount}
            </span>
          ) : null}
          <span>
            {text.datasetsPrefix} {datasets.length}
          </span>
          {owners && owners.length > 0 ? (
            <span>
              {text.usedByPrefix} {owners.join(", ")}
            </span>
          ) : null}
        </div>
        <div className="rounded-lg border border-foreground/10 bg-muted/30 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-foreground">{text.datasetsSectionTitle}</p>
              <p className="text-xs text-muted-foreground">{text.datasetsSectionDescription}</p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="icon-sm"
                variant="secondary"
                disabled={datasetActionsDisabled}
                onClick={() => onCreateDataset(project)}
                aria-label={text.createDatasetAria}
              >
                <Plus className="size-4" />
              </Button>
              <Button
                size="icon-sm"
                variant="outline"
                disabled={datasetActionsDisabled}
                onClick={() => onImportDataset(project)}
                aria-label={text.importDatasetAria}
              >
                <Upload className="size-4" />
              </Button>
            </div>
          </div>
          {datasetActionsDisabled && datasetActionsDisabledReason ? (
            <p className="mt-2 text-xs text-muted-foreground">{datasetActionsDisabledReason}</p>
          ) : null}
          <div className="mt-3 grid gap-2">
            {datasets.length === 0 ? (
              <p className="text-xs text-muted-foreground">{text.noDatasetsYet}</p>
            ) : (
              datasets.map((dataset) => (
                <div
                  key={dataset.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-foreground/10 bg-background px-3 py-2 text-xs"
                >
                  <div>
                    <p className="text-sm font-medium text-foreground">{dataset.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {text.createdPrefix} {formatTimestamp(dataset.createdAt)}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button asChild size="sm" variant="secondary">
                      <Link href={`/${dataset.id}`}>{text.open}</Link>
                    </Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button size="icon-sm" variant="ghost" aria-label={text.datasetActionsAria}>
                          <MoreHorizontal className="size-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          disabled={datasetActionsDisabled}
                          onClick={() => onEditDatasetInfo(dataset)}
                        >
                          {text.editDatasetInfo}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          disabled={datasetActionsDisabled}
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
                </div>
              ))
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

