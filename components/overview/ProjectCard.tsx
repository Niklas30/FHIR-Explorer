"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { GitBranch, MoreHorizontal, PencilRuler, Plus, Upload } from "lucide-react";
import { formatText, formatTimestamp } from "@/components/overview/utils";
import type { ProjectCardProps } from "@/components/overview/types";

export const ProjectCard = ({
  project,
  dependencyCount,
  datasets,
  text,
  onCreateDataset,
  onImportDataset,
  onOpenDependencyTree,
  onOpenInProjectEditor,
  onOpenExportDialog,
  onEditDatasetInfo,
  onDuplicateDataset,
  onDeleteProject,
  onDeleteDataset,
  onExportDataset,
  canDeleteProject,
  deleteReason,
  datasetActionsDisabled = false,
  datasetActionsDisabledReason,
}: ProjectCardProps) => {
  const title = project.manifest.title ?? project.manifest.name ?? project.id;
  const hasDatasets = datasets.length > 0;

  return (
    <Card className="border-foreground/10">
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="truncate text-lg font-semibold text-foreground" title={title}>
              {title}
            </h3>
            <p className="truncate font-mono text-xs text-muted-foreground" title={project.key}>
              {project.key}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {datasetActionsDisabled ? (
              <Badge variant="outline" className="text-amber-600">
                {text.importInProgress}
              </Badge>
            ) : null}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="icon-sm" variant="ghost" aria-label={text.projectActionsAria}>
                  <MoreHorizontal className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>{text.projectActions}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => onOpenInProjectEditor(project)}>
                  <PencilRuler className="mr-2 size-4" />
                  {text.openInProjectEditor}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onOpenDependencyTree(project)}>
                  <GitBranch className="mr-2 size-4" />
                  {text.showDependencyTree}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onOpenExportDialog(project)}>
                  {text.exportProject}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  variant="destructive"
                  disabled={!canDeleteProject}
                  onClick={() => onDeleteProject(project)}
                >
                  {text.deleteProject}
                </DropdownMenuItem>
                {!canDeleteProject && deleteReason ? (
                  <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
                    {deleteReason}
                  </DropdownMenuLabel>
                ) : null}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </CardHeader>
      <CardContent className="grid gap-4">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <span>{formatText(text.resourcesCount, { count: project.resourceCount })}</span>
          {typeof dependencyCount === "number" && dependencyCount > 0 ? (
            <button
              type="button"
              onClick={() => onOpenDependencyTree(project)}
              className="inline-flex items-center gap-1 rounded underline-offset-2 hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <GitBranch className="size-3.5" />
              {formatText(text.dependencyCountLabel, { count: dependencyCount })}
            </button>
          ) : null}
          <span>
            {text.addedPrefix} {formatTimestamp(project.addedAt)}
          </span>
        </div>

        <div className="rounded-lg border border-foreground/10 bg-muted/30 p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-semibold text-foreground">
              {formatText(text.datasetsWithCount, { count: datasets.length })}
            </p>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="secondary"
                disabled={datasetActionsDisabled}
                onClick={() => onCreateDataset(project)}
              >
                <Plus className="size-4" />
                {text.newDataset}
              </Button>
              <Button
                size="icon-sm"
                variant="outline"
                disabled={datasetActionsDisabled}
                onClick={() => onImportDataset(project)}
                aria-label={text.importDatasetAria}
                title={text.importDatasetAria}
              >
                <Upload className="size-4" />
              </Button>
            </div>
          </div>

          {datasetActionsDisabled && datasetActionsDisabledReason ? (
            <p className="mt-2 text-xs text-muted-foreground">{datasetActionsDisabledReason}</p>
          ) : !hasDatasets ? (
            <p className="mt-3 text-xs text-muted-foreground">{text.datasetsEmptyHint}</p>
          ) : (
            <div className="mt-3 grid gap-2">
              {datasets.map((dataset) => (
                <div
                  key={dataset.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-foreground/10 bg-background px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">{dataset.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {text.createdPrefix} {formatTimestamp(dataset.createdAt)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
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
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
