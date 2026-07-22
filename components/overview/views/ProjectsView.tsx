"use client";

import Link from "next/link";
import { GitBranch, MoreHorizontal, PackagePlus, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { PackageRecord } from "@/lib/fhir-importer/types";
import type { DatasetRecord } from "@/lib/datasets/storage";
import type { OverviewText, ProjectEntry } from "@/components/overview/types";
import { ProjectCard } from "@/components/overview/ProjectCard";
import { formatText } from "@/components/overview/utils";

type Props = {
  text: OverviewText;
  targets: ProjectEntry[];
  filteredDependencies: PackageRecord[];
  dependenciesByTarget: Map<string, Set<string>>;
  dependencyOwners: Map<string, Set<string>>;
  datasetsByProject: Map<string, DatasetRecord[]>;
  authoredKeys: Set<string>;
  currentTargetKey: string | null;
  currentTargetImportInProgress: boolean;
  isProjectDatasetSelectable: (projectKey: string) => boolean;
  onCreateDataset: (project: PackageRecord) => void;
  onImportDataset: (project: PackageRecord) => void;
  onOpenDependencyTree: (project: PackageRecord) => void;
  onOpenInProjectEditor: (project: PackageRecord) => void;
  onDuplicateProject: (project: PackageRecord) => void;
  onOpenExportDialog: (project: PackageRecord) => void;
  onExportDataset: (dataset: DatasetRecord) => void;
  onEditDatasetInfo: (dataset: DatasetRecord) => void;
  onDuplicateDataset: (dataset: DatasetRecord) => void;
  onDeleteDataset: (dataset: DatasetRecord) => void;
  onDeleteProject: (project: PackageRecord) => void;
  canDeleteProject: (projectKey: string) => boolean;
  deleteReasonFor: (projectKey: string) => string | undefined;
};

export const ProjectsView = ({
  text,
  targets,
  filteredDependencies,
  dependenciesByTarget,
  dependencyOwners,
  datasetsByProject,
  authoredKeys,
  currentTargetKey,
  currentTargetImportInProgress,
  isProjectDatasetSelectable,
  onCreateDataset,
  onImportDataset,
  onOpenDependencyTree,
  onOpenInProjectEditor,
  onDuplicateProject,
  onOpenExportDialog,
  onExportDataset,
  onEditDatasetInfo,
  onDuplicateDataset,
  onDeleteDataset,
  onDeleteProject,
  canDeleteProject,
  deleteReasonFor,
}: Props) => {
  const hasTargets = targets.some((entry) => Boolean(entry.record));

  return (
    <>
      <section className="grid gap-4">
        {!hasTargets ? (
          <Card className="border-dashed border-foreground/20">
            <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
              <div className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
                <PackagePlus className="size-6" />
              </div>
              <div className="grid gap-1">
                <p className="text-lg font-semibold text-foreground">{text.noTargetsTitle}</p>
                <p className="mx-auto max-w-md text-sm text-muted-foreground">{text.noTargetsDescription}</p>
              </div>
              <Button asChild>
                <Link href="/importer">
                  <Upload className="size-4" />
                  {text.goToImporter}
                </Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {targets.map((target) =>
              target.record ? (
                <ProjectCard
                  key={target.key}
                  kind="Target"
                  project={target.record}
                  isAuthored={authoredKeys.has(target.key)}
                  text={text}
                  dependencyCount={
                    authoredKeys.has(target.key)
                      ? Object.keys(target.record.manifest.dependencies ?? {}).length
                      : dependenciesByTarget.get(target.key)?.size ?? 0
                  }
                  datasets={datasetsByProject.get(target.key) ?? []}
                  onCreateDataset={onCreateDataset}
                  onImportDataset={onImportDataset}
                  onOpenDependencyTree={onOpenDependencyTree}
                  onOpenInProjectEditor={onOpenInProjectEditor}
                  onDuplicateProject={onDuplicateProject}
                  onOpenExportDialog={onOpenExportDialog}
                  onExportDataset={onExportDataset}
                  onEditDatasetInfo={onEditDatasetInfo}
                  onDuplicateDataset={onDuplicateDataset}
                  onDeleteDataset={onDeleteDataset}
                  onDeleteProject={onDeleteProject}
                  canDeleteProject={canDeleteProject(target.key)}
                  deleteReason={deleteReasonFor(target.key)}
                  datasetActionsDisabled={target.key === currentTargetKey && currentTargetImportInProgress}
                  datasetActionsDisabledReason={
                    target.key === currentTargetKey && currentTargetImportInProgress
                      ? text.datasetActionsBlockedUntilImportComplete
                      : undefined
                  }
                />
              ) : (
                <Card key={target.key} className="border-destructive/40">
                  <CardContent className="grid gap-3 py-6">
                    <div>
                      <p className="text-base font-semibold text-foreground">{text.missingTargetTitle}</p>
                      <p className="text-sm text-muted-foreground">
                        {formatText(text.missingTargetDescription, { targetKey: target.key })}
                      </p>
                    </div>
                    <Button asChild variant="outline" className="w-fit">
                      <Link href="/importer">{text.reimportInImporter}</Link>
                    </Button>
                  </CardContent>
                </Card>
              )
            )}
          </div>
        )}
      </section>

      {hasTargets && filteredDependencies.length > 0 ? (
        <details className="group rounded-xl border border-foreground/10 bg-muted/20">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-medium text-foreground [&::-webkit-details-marker]:hidden">
            <span>
              {formatText(text.dependencyPackagesCount, { count: filteredDependencies.length })}
            </span>
            <span className="text-xs text-muted-foreground transition-transform group-open:rotate-180">
              ▾
            </span>
          </summary>
          <div className="border-t border-foreground/10 px-4 py-3">
            <p className="mb-3 text-xs text-muted-foreground">{text.dependencyProjectsDescription}</p>
            <div className="grid gap-2">
              {filteredDependencies.map((project) => {
                const owners = Array.from(dependencyOwners.get(project.key) ?? []).sort();
                const canDelete = canDeleteProject(project.key);
                const title = project.manifest.title ?? project.manifest.name ?? project.id;
                return (
                  <div
                    key={project.key}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-foreground/10 bg-background px-4 py-3"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground" title={title}>
                        {title}
                      </p>
                      <p className="truncate font-mono text-xs text-muted-foreground">{project.key}</p>
                      {owners.length > 0 ? (
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {text.usedByPrefix} {owners.join(", ")}
                        </p>
                      ) : null}
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-muted-foreground">
                        {formatText(text.resourcesCount, { count: project.resourceCount })}
                      </span>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button size="icon-sm" variant="ghost" aria-label={text.projectActionsAria}>
                            <MoreHorizontal className="size-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => onOpenDependencyTree(project)}>
                            <GitBranch className="mr-2 size-4" />
                            {text.showDependencyTree}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            disabled={!isProjectDatasetSelectable(project.key)}
                            onClick={() => onCreateDataset(project)}
                          >
                            {text.createDataset}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => onOpenExportDialog(project)}>
                            {text.exportProject}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            variant="destructive"
                            disabled={!canDelete}
                            onClick={() => onDeleteProject(project)}
                          >
                            {text.deleteProject}
                          </DropdownMenuItem>
                          {!canDelete && deleteReasonFor(project.key) ? (
                            <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
                              {deleteReasonFor(project.key)}
                            </DropdownMenuLabel>
                          ) : null}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </details>
      ) : null}
    </>
  );
};
