"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
  currentTargetKey: string | null;
  currentTargetImportInProgress: boolean;
  isProjectDatasetSelectable: (projectKey: string) => boolean;
  onCreateDataset: (project: PackageRecord) => void;
  onImportDataset: (project: PackageRecord) => void;
  onOpenDependencyTree: (project: PackageRecord) => void;
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
  currentTargetKey,
  currentTargetImportInProgress,
  isProjectDatasetSelectable,
  onCreateDataset,
  onImportDataset,
  onOpenDependencyTree,
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
            <CardHeader>
              <CardTitle>{text.noTargetsTitle}</CardTitle>
              <CardDescription>{text.noTargetsDescription}</CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild>
                <Link href="/importer">{text.goToImporter}</Link>
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
                  text={text}
                  dependencyCount={dependenciesByTarget.get(target.key)?.size ?? 0}
                  datasets={datasetsByProject.get(target.key) ?? []}
                  onCreateDataset={onCreateDataset}
                  onImportDataset={onImportDataset}
                  onOpenDependencyTree={onOpenDependencyTree}
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
                  <CardHeader>
                    <CardTitle className="text-lg">{text.missingTargetTitle}</CardTitle>
                    <CardDescription>
                      {formatText(text.missingTargetDescription, {
                        targetKey: target.key,
                      })}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Button asChild variant="outline">
                      <Link href="/importer">{text.reimportInImporter}</Link>
                    </Button>
                  </CardContent>
                </Card>
              )
            )}
          </div>
        )}
      </section>

      <section className="grid gap-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-foreground">{text.dependencyProjectsTitle}</h2>
            <p className="text-sm text-muted-foreground">{text.dependencyProjectsDescription}</p>
          </div>
        </div>

        {filteredDependencies.length === 0 ? (
          <Card className="border-dashed border-foreground/20">
            <CardHeader>
              <CardTitle>{text.noDependenciesTitle}</CardTitle>
              <CardDescription>{text.noDependenciesDescription}</CardDescription>
            </CardHeader>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filteredDependencies.map((project) => (
              <ProjectCard
                key={project.key}
                kind="Dependency"
                project={project}
                text={text}
                owners={Array.from(dependencyOwners.get(project.key) ?? []).sort()}
                datasets={datasetsByProject.get(project.key) ?? []}
                onCreateDataset={onCreateDataset}
                onImportDataset={onImportDataset}
                onOpenDependencyTree={onOpenDependencyTree}
                onOpenExportDialog={onOpenExportDialog}
                onExportDataset={onExportDataset}
                onEditDatasetInfo={onEditDatasetInfo}
                onDuplicateDataset={onDuplicateDataset}
                onDeleteDataset={onDeleteDataset}
                onDeleteProject={onDeleteProject}
                canDeleteProject={canDeleteProject(project.key)}
                deleteReason={deleteReasonFor(project.key)}
                datasetActionsDisabled={!isProjectDatasetSelectable(project.key)}
                datasetActionsDisabledReason={
                  !isProjectDatasetSelectable(project.key)
                    ? text.datasetActionsBlockedUntilImportComplete
                    : undefined
                }
              />
            ))}
          </div>
        )}
      </section>
    </>
  );
};

