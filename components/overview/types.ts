import type { PackageRecord } from "@/lib/fhir-importer/types";
import type { DatasetRecord } from "@/lib/datasets/storage";
import type { OverviewText } from "@/components/overview/text";
export type { OverviewText } from "@/components/overview/text";

export type OverviewViewMode = "projects" | "datasets";

export type ProjectEntry = {
  key: string;
  record?: PackageRecord;
};

export type ProjectCardKind = "Target" | "Dependency";

export type ProjectCardProps = {
  kind: ProjectCardKind;
  project: PackageRecord;
  /** True for user-authored projects (vs read-only imported packages). */
  isAuthored?: boolean;
  dependencyCount?: number;
  owners?: string[];
  datasets: DatasetRecord[];
  text: OverviewText;
  onCreateDataset: (project: PackageRecord) => void;
  onImportDataset: (project: PackageRecord) => void;
  onOpenDependencyTree: (project: PackageRecord) => void;
  onOpenInProjectEditor: (project: PackageRecord) => void;
  onDuplicateProject: (project: PackageRecord) => void;
  onOpenExportDialog: (project: PackageRecord) => void;
  onExportDataset: (dataset: DatasetRecord) => void;
  onEditDatasetInfo: (dataset: DatasetRecord) => void;
  onDuplicateDataset: (dataset: DatasetRecord) => void;
  onDeleteProject: (project: PackageRecord) => void;
  onDeleteDataset: (dataset: DatasetRecord) => void;
  canDeleteProject: boolean;
  deleteReason?: string;
  datasetActionsDisabled?: boolean;
  datasetActionsDisabledReason?: string;
};
