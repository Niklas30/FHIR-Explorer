"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useI18n } from "@/components/i18n/I18nProvider";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { FileDropzone } from "@/components/ui/file-dropzone";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useImporter } from "@/components/importer/useImporter";
import { DatasetInfoDialog } from "@/components/editor/DatasetInfoDialog";
import { DependencyTreeDialog } from "@/components/editor/DependencyTreeDialog";
import { ExportDialog } from "@/components/editor/ExportDialog";
import type { PackageRecord } from "@/lib/fhir-importer/types";
import { buildDependencyGraph, collectDependencies } from "@/lib/fhir-importer/dependency-graph";
import {
  getCurrentTargetKey,
  isProjectSelectableForDatasets,
  isTargetImportInProgress,
} from "@/lib/fhir-importer/target-status";
import type {
  ComposeDatasetExport,
  ComposePackageExport,
  ComposeProjectArchiveManifest,
  ComposeProjectExport,
} from "@/lib/fhir-importer/compose";
import {
  loadDatasets,
  clearDatasets,
  removeDataset,
  removeDatasetsForProject,
  upsertDataset,
  type DatasetRecord,
} from "@/lib/datasets/storage";
import {
  clearAllDatasetResources,
  clearDatasetResources,
  hydrateDatasetResources,
  loadDatasetResources,
  saveDatasetResources,
} from "@/lib/datasets/content";
import { byLocale } from "@/lib/i18n/select";
import { toast } from "sonner";
import { Database, GitBranch, LayoutGrid, MoreHorizontal, Plus, Settings, Upload } from "lucide-react";
import JSZip from "jszip";

type ProjectEntry = {
  key: string;
  record?: PackageRecord;
};

type ImportHistoryEntry = {
  targetKey: string;
};

const EMPTY_PACKAGES: PackageRecord[] = [];
const EMPTY_IMPORT_HISTORY: ImportHistoryEntry[] = [];

const createDatasetId = () => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `dataset-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
};

const getTimestamp = () => Date.now();


const matchesFilter = (
  filter: string,
  record: PackageRecord | undefined,
  fallbackKey: string
) => {
  if (!filter) return true;
  const haystack = [
    fallbackKey,
    record?.id,
    record?.version,
    record?.manifest.title,
    record?.manifest.name,
    record?.manifest.description,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return haystack.includes(filter);
};

const formatTimestamp = (timestamp: number) => new Date(timestamp).toLocaleString();

const downloadBlob = (filename: string, blob: Blob) => {
  if (typeof window === "undefined") return;
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
};

const downloadJson = (filename: string, payload: unknown) => {
  if (typeof window === "undefined") return;
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json",
  });
  downloadBlob(filename, blob);
};

const toSafeFilename = (value: string) =>
  value
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+/, "")
    .replace(/-+$/, "");

const overviewText = {
  de: {
    pageBrowserTitle: "Projekte",
    datasetSuffix: "Datensatz",
    noDescriptionProvided: "Keine Beschreibung verfügbar.",
    kindTarget: "Ziel",
    kindDependency: "Abhängigkeit",
    resourcesCount: "{count} Ressourcen",
    projectActionsAria: "Projektaktionen",
    projectActions: "Projektaktionen",
    showDependencyTree: "Abhängigkeitsbaum anzeigen",
    exportProject: "Projekt exportieren...",
    deleteProject: "Projekt löschen",
    addedPrefix: "Hinzugefügt:",
    dependenciesPrefix: "Abhängigkeiten:",
    datasetsPrefix: "Datasets:",
    usedByPrefix: "Verwendet von:",
    datasetsSectionTitle: "Datasets",
    datasetsSectionDescription:
      "Erstelle Datasets für dieses Projekt und öffne sie im Editor.",
    createDatasetAria: "Dataset erstellen",
    importDatasetAria: "Dataset importieren",
    importInProgress: "Import läuft",
    noDatasetsYet: "Noch keine Datasets.",
    createdPrefix: "Erstellt",
    open: "Öffnen",
    datasetActionsAria: "Datasetaktionen",
    editDatasetInfo: "Dataset-Info",
    duplicateDataset: "Dataset duplizieren",
    exportDataset: "Dataset exportieren",
    deleteDataset: "Dataset löschen",
    duplicateDatasetName: "{name} (Kopie)",
    datasetDuplicated: 'Dataset "{name}" dupliziert.',
    selectProjectForDataset: "Wähle ein Projekt für dieses Dataset aus.",
    datasetNameRequired: "Dataset-Name ist erforderlich.",
    datasetCreated: "Dataset erstellt.",
    datasetActionsBlockedUntilImportComplete:
      "Dataset-Aktionen sind erst nach abgeschlossenem Import verfügbar.",
    chooseDatasetFile: "Wähle eine Dataset-Datei zum Importieren aus.",
    zipNoJson: "ZIP enthält keine JSON-Dataset-Datei.",
    datasetNameMissingImport: "Dataset-Name fehlt in der Importdatei.",
    datasetImported: "Dataset importiert.",
    datasetImportFailed: "Dataset-Datei konnte nicht importiert werden.",
    confirmDeleteDataset:
      'Dataset "{name}" löschen? Diese Aktion kann nicht rückgängig gemacht werden.',
    datasetDeleted: "Dataset gelöscht.",
    projectRequiredByOthers: "Dieses Projekt wird von anderen Projekten benötigt.",
    confirmDeleteProject:
      'Projekt "{project}" löschen? Dabei werden gespeicherte Ressourcen entfernt.',
    projectDeleted: "Projekt gelöscht.",
    datasetExported: "Dataset exportiert.",
    noPackagesToExport: "Keine Pakete für den Export verfügbar.",
    projectExported: "Projekt exportiert.",
    noDatasetSelected: "Kein Dataset ausgewählt.",
    cannotDeleteUsedBy:
      "Löschen nicht möglich, solange verwendet von {projects}.",
    confirmDeleteAllData:
      "Alle lokal gespeicherten Daten löschen? Dabei werden importierte Projekte, Ressourcen und Datasets entfernt.",
    localDataCleared: "Lokale Daten gelöscht.",
    failedClearLocalData:
      "Lokale Daten konnten nicht gelöscht werden. Bitte erneut versuchen.",
    editorEyebrow: "Editor",
    pageTitle: "Projektübersicht",
    refresh: "Aktualisieren",
    pageDescription:
      "Prüfe importierte Zielpakete, inspiziere Abhängigkeiten und starte Datasets. Öffne ein Dataset, um Ressourcen mit profilbasierten Formularen zu erstellen.",
    projectsOverviewTitle: "Projektübersicht",
    datasetsOverviewTitle: "Datasetübersicht",
    projectsOverviewDescription:
      "Prüfe importierte Zielprojekte und deren Abhängigkeiten.",
    datasetsOverviewDescription:
      "Verwalte Datasets und sieh, zu welchem Projekt sie gehören.",
    importProject: "Projekt importieren",
    createDataset: "Dataset erstellen",
    settingsAria: "Einstellungen",
    filterPlaceholder: "Filtern",
    projectViewAria: "Projektansicht",
    datasetViewAria: "Datasetansicht",
    noTargetsTitle: "Noch keine Ziele",
    noTargetsDescription:
      "Importiere ein Zielpaket, um Datasets und Abhängigkeiten aufzubauen.",
    goToImporter: "Zum Importer",
    missingTargetTitle: "Fehlendes Zielpaket",
    missingTargetDescription:
      "{targetKey} ist in der Historie, aber nicht mehr im Speicher verfügbar.",
    reimportInImporter: "Im Importer erneut importieren",
    dependencyProjectsTitle: "Abhängigkeitsprojekte",
    dependencyProjectsDescription:
      "Pakete, die zur Erfüllung von Zielabhängigkeiten importiert wurden.",
    noDependenciesTitle: "Keine Abhängigkeiten sichtbar",
    noDependenciesDescription:
      "Importiere ein Ziel mit Abhängigkeiten oder entferne den Filter.",
    noDatasetsTitle: "Keine Datasets sichtbar",
    noDatasetsDescription:
      "Erstelle oder importiere Datasets über eine Projektkarte, um diese Ansicht zu füllen.",
    projectPrefix: "Projekt:",
    unknownProject: "Unbekannt",
    exportProjectButton: "Projekt exportieren",
    createDatasetDialogTitle: "Dataset erstellen",
    createDatasetDialogDescription:
      "Erstelle ein Dataset-Grundgerüst für {project} und beginne mit dem Erstellen von Ressourcen.",
    projectLabel: "Projekt",
    selectProject: "Projekt auswählen",
    chooseProjectHint: "Wähle das Projekt, zu dem dieses Dataset gehört.",
    datasetNameLabel: "Dataset-Name",
    datasetNamePlaceholder: "Projekt-Dataset",
    createDatasetHint:
      "Nutze dies, wenn du ein komplett neues Dataset anlegen willst.",
    cancel: "Abbrechen",
    createDatasetConfirm: "Dataset erstellen",
    importDatasetDialogTitle: "Dataset importieren",
    importDatasetDialogDescription:
      "Importiere ein Dataset-JSON für {project}.",
    datasetFileLabel: "Dataset-Datei (.json/.zip)",
    uploadDatasetFileLabel: "Dataset-Datei hochladen",
    uploadDatasetHelper:
      "Du kannst Dateien hier hineinziehen oder JSON aus der Zwischenablage einfügen.",
    uploadDatasetHint: ".json oder .zip hierher ziehen",
    chooseFile: "Datei auswählen",
    pasteJson: "JSON einfügen",
    clipboardHint:
      "Nutze den Button oder fokussiere dieses Feld und drücke Strg/Cmd+V.",
    clipboardFilename: "dataset-aus-zwischenablage.json",
    selectedPrefix: "Ausgewählt:",
    clear: "Leeren",
    datasetFileSupportHint:
      "Unterstützt JSON/ZIP-Dataset-Exporte, Ressourcenlisten oder FHIR-Searchset-Bundles.",
    fallbackNameLabel: "Fallback-Name (optional)",
    fallbackNameHint:
      "Wird nur genutzt, wenn die Importdatei keinen Namen enthält.",
    importDatasetConfirm: "Dataset importieren",
    exportProjectDialogTitle: "Projekt exportieren",
    exportProjectDialogDescription:
      "Exportiere {project} oder eines seiner Datasets.",
    scopeProjectDependencies: "Projekt + Abhängigkeiten",
    scopeDatasetOnly: "Nur Dataset",
    scopeNoDatasetHelper: "Keine Datasets für dieses Projekt verfügbar.",
    exportDatasetConfirm: "Dataset exportieren",
    exportProjectConfirm: "Projekt exportieren",
    settingsTitle: "Einstellungen",
    settingsDescription:
      "Verwalte lokal gespeicherte Daten in diesem Browser.",
    settingsDeleteInfo:
      "Beim Löschen werden importierte Pakete, Abhängigkeitsmetadaten, gecachte Ressourcen und alle in diesem Browser gespeicherten Datasets entfernt.",
    close: "Schließen",
    deleteAllLocalData: "Alle lokalen Daten löschen",
    thisProject: "dieses Projekt",
  },
  en: {
    pageBrowserTitle: "Projects",
    datasetSuffix: "Dataset",
    noDescriptionProvided: "No description provided.",
    kindTarget: "Target",
    kindDependency: "Dependency",
    resourcesCount: "{count} resources",
    projectActionsAria: "Project actions",
    projectActions: "Project actions",
    showDependencyTree: "Show dependency tree",
    exportProject: "Export project...",
    deleteProject: "Delete project",
    addedPrefix: "Added:",
    dependenciesPrefix: "Dependencies:",
    datasetsPrefix: "Datasets:",
    usedByPrefix: "Used by:",
    datasetsSectionTitle: "Datasets",
    datasetsSectionDescription:
      "Create datasets for this project and open them in the editor.",
    createDatasetAria: "Create dataset",
    importDatasetAria: "Import dataset",
    importInProgress: "Import in progress",
    noDatasetsYet: "No datasets yet.",
    createdPrefix: "Created",
    open: "Open",
    datasetActionsAria: "Dataset actions",
    editDatasetInfo: "Dataset info",
    duplicateDataset: "Duplicate dataset",
    exportDataset: "Export dataset",
    deleteDataset: "Delete dataset",
    duplicateDatasetName: "{name} (Copy)",
    datasetDuplicated: 'Dataset "{name}" duplicated.',
    selectProjectForDataset: "Select a project for this dataset.",
    datasetNameRequired: "Dataset name is required.",
    datasetCreated: "Dataset created.",
    datasetActionsBlockedUntilImportComplete:
      "Dataset actions are available after the import is complete.",
    chooseDatasetFile: "Choose a dataset file to import.",
    zipNoJson: "ZIP does not contain a JSON dataset file.",
    datasetNameMissingImport: "Dataset name is missing in the import file.",
    datasetImported: "Dataset imported.",
    datasetImportFailed: "Failed to import dataset file.",
    confirmDeleteDataset:
      'Delete dataset "{name}"? This cannot be undone.',
    datasetDeleted: "Dataset deleted.",
    projectRequiredByOthers: "This project is required by other projects.",
    confirmDeleteProject:
      'Delete project "{project}"? This removes stored resources.',
    projectDeleted: "Project deleted.",
    datasetExported: "Dataset exported.",
    noPackagesToExport: "No packages available to export.",
    projectExported: "Project exported.",
    noDatasetSelected: "No dataset selected.",
    cannotDeleteUsedBy: "Cannot delete while used by {projects}.",
    confirmDeleteAllData:
      "Delete all locally stored data? This removes imported projects, resources, and datasets.",
    localDataCleared: "Local data cleared.",
    failedClearLocalData: "Failed to clear local data. Please try again.",
    editorEyebrow: "Editor",
    pageTitle: "Projects Overview",
    refresh: "Refresh",
    pageDescription:
      "Review imported target packages, inspect dependencies, and start datasets. Open a dataset to compose resources with profile-driven forms.",
    projectsOverviewTitle: "Project Overview",
    datasetsOverviewTitle: "Dataset Overview",
    projectsOverviewDescription:
      "Review imported target projects and their dependencies.",
    datasetsOverviewDescription:
      "Manage datasets and see which project they belong to.",
    importProject: "Import Project",
    createDataset: "Create dataset",
    settingsAria: "Settings",
    filterPlaceholder: "Filter",
    projectViewAria: "Project view",
    datasetViewAria: "Dataset view",
    noTargetsTitle: "No targets yet",
    noTargetsDescription:
      "Import a target package to start building datasets and dependencies.",
    goToImporter: "Go to Importer",
    missingTargetTitle: "Missing target package",
    missingTargetDescription:
      "{targetKey} is in history but no longer available in storage.",
    reimportInImporter: "Re-import in Importer",
    dependencyProjectsTitle: "Dependency Projects",
    dependencyProjectsDescription:
      "Packages pulled in to satisfy target dependencies.",
    noDependenciesTitle: "No dependencies to show",
    noDependenciesDescription:
      "Import a target with dependencies or clear the filter to see more.",
    noDatasetsTitle: "No datasets to show",
    noDatasetsDescription:
      "Create or import datasets from a project card to populate this view.",
    projectPrefix: "Project:",
    unknownProject: "Unknown",
    exportProjectButton: "Export project",
    createDatasetDialogTitle: "Create dataset",
    createDatasetDialogDescription:
      "Create a dataset shell for {project} and start composing resources.",
    projectLabel: "Project",
    selectProject: "Select project",
    chooseProjectHint: "Choose the project this dataset belongs to.",
    datasetNameLabel: "Dataset name",
    datasetNamePlaceholder: "Project dataset",
    createDatasetHint: "Use this when you want to create a brand new dataset.",
    cancel: "Cancel",
    createDatasetConfirm: "Create dataset",
    importDatasetDialogTitle: "Import dataset",
    importDatasetDialogDescription:
      "Import a dataset JSON for {project}.",
    datasetFileLabel: "Dataset file (.json/.zip)",
    uploadDatasetFileLabel: "Upload dataset file",
    uploadDatasetHelper:
      "You can drag files here or paste JSON from your clipboard.",
    uploadDatasetHint: "Drag & drop .json or .zip here",
    chooseFile: "Choose file",
    pasteJson: "Paste JSON",
    clipboardHint: "Use the button or focus this box and press Ctrl/Cmd+V.",
    clipboardFilename: "dataset-from-clipboard.json",
    selectedPrefix: "Selected:",
    clear: "Clear",
    datasetFileSupportHint:
      "Supports JSON/ZIP dataset exports, resource lists, or FHIR searchset bundles.",
    fallbackNameLabel: "Fallback name (optional)",
    fallbackNameHint:
      "Used only if the import file does not include a name.",
    importDatasetConfirm: "Import dataset",
    exportProjectDialogTitle: "Export project",
    exportProjectDialogDescription:
      "Export {project} or one of its datasets.",
    scopeProjectDependencies: "Project + dependencies",
    scopeDatasetOnly: "Dataset only",
    scopeNoDatasetHelper: "No datasets available for this project.",
    exportDatasetConfirm: "Export dataset",
    exportProjectConfirm: "Export project",
    settingsTitle: "Settings",
    settingsDescription: "Manage locally stored data for this browser.",
    settingsDeleteInfo:
      "Deleting data removes imported packages, dependency metadata, cached resources, and all datasets saved in this browser.",
    close: "Close",
    deleteAllLocalData: "Delete all local data",
    thisProject: "this project",
  },
};

type OverviewText = Record<keyof (typeof overviewText)["en"], string>;
const localizedOverviewText = {
  ...overviewText,
  fr: {
    ...overviewText.en,
    pageBrowserTitle: "Projets",
    pageTitle: "Vue d'ensemble des projets",
    pageDescription:
      "Consultez les paquets cibles importes, examinez les dependances et demarrez des datasets. Ouvrez un dataset pour composer des ressources avec des formulaires guides par profil.",
    projectsOverviewTitle: "Vue d'ensemble des projets",
    datasetsOverviewTitle: "Vue d'ensemble des datasets",
    projectsOverviewDescription:
      "Consultez les projets cibles importes et leurs dependances.",
    datasetsOverviewDescription:
      "Gerez les datasets et voyez a quel projet ils appartiennent.",
    importProject: "Importer un projet",
    createDataset: "Creer un dataset",
    refresh: "Actualiser",
    filterPlaceholder: "Filtrer",
    projectViewAria: "Vue projet",
    datasetViewAria: "Vue dataset",
    noTargetsTitle: "Aucune cible pour le moment",
    noTargetsDescription:
      "Importez un paquet cible pour commencer a construire des datasets et des dependances.",
    goToImporter: "Aller a l'importateur",
    dependencyProjectsTitle: "Projets de dependance",
    dependencyProjectsDescription:
      "Paquets importes pour satisfaire les dependances des cibles.",
    noDependenciesTitle: "Aucune dependance a afficher",
    noDatasetsTitle: "Aucun dataset a afficher",
    open: "Ouvrir",
    exportProject: "Exporter le projet...",
    deleteProject: "Supprimer le projet",
    editDatasetInfo: "Infos du dataset",
    duplicateDataset: "Dupliquer le dataset",
    exportDataset: "Exporter le dataset",
    deleteDataset: "Supprimer le dataset",
    duplicateDatasetName: "{name} (Copie)",
    datasetDuplicated: 'Dataset "{name}" dupliqué.',
  },
  es: {
    ...overviewText.en,
    pageBrowserTitle: "Proyectos",
    pageTitle: "Resumen de proyectos",
    pageDescription:
      "Revisa los paquetes objetivo importados, inspecciona dependencias y comienza datasets. Abre un dataset para componer recursos con formularios guiados por perfil.",
    projectsOverviewTitle: "Resumen de proyectos",
    datasetsOverviewTitle: "Resumen de datasets",
    projectsOverviewDescription:
      "Revisa los proyectos objetivo importados y sus dependencias.",
    datasetsOverviewDescription:
      "Gestiona datasets y ve a que proyecto pertenecen.",
    importProject: "Importar proyecto",
    createDataset: "Crear dataset",
    refresh: "Actualizar",
    filterPlaceholder: "Filtrar",
    projectViewAria: "Vista de proyectos",
    datasetViewAria: "Vista de datasets",
    noTargetsTitle: "Sin objetivos todavia",
    noTargetsDescription:
      "Importa un paquete objetivo para empezar a crear datasets y dependencias.",
    goToImporter: "Ir al importador",
    dependencyProjectsTitle: "Proyectos de dependencia",
    dependencyProjectsDescription:
      "Paquetes importados para cumplir dependencias del objetivo.",
    noDependenciesTitle: "No hay dependencias para mostrar",
    noDatasetsTitle: "No hay datasets para mostrar",
    open: "Abrir",
    exportProject: "Exportar proyecto...",
    deleteProject: "Eliminar proyecto",
    editDatasetInfo: "Informacion del dataset",
    duplicateDataset: "Duplicar dataset",
    exportDataset: "Exportar dataset",
    deleteDataset: "Eliminar dataset",
    duplicateDatasetName: "{name} (Copia)",
    datasetDuplicated: 'Dataset "{name}" duplicado.',
  },
  it: {
    ...overviewText.en,
    pageBrowserTitle: "Progetti",
    pageTitle: "Panoramica progetti",
    pageDescription:
      "Controlla i pacchetti target importati, ispeziona le dipendenze e avvia i dataset. Apri un dataset per comporre risorse con moduli guidati dal profilo.",
    projectsOverviewTitle: "Panoramica progetti",
    datasetsOverviewTitle: "Panoramica dataset",
    projectsOverviewDescription:
      "Controlla i progetti target importati e le loro dipendenze.",
    datasetsOverviewDescription:
      "Gestisci i dataset e vedi a quale progetto appartengono.",
    importProject: "Importa progetto",
    createDataset: "Crea dataset",
    refresh: "Aggiorna",
    filterPlaceholder: "Filtra",
    projectViewAria: "Vista progetti",
    datasetViewAria: "Vista dataset",
    noTargetsTitle: "Nessun target per ora",
    noTargetsDescription:
      "Importa un pacchetto target per iniziare a creare dataset e dipendenze.",
    goToImporter: "Vai all'importatore",
    dependencyProjectsTitle: "Progetti dipendenza",
    dependencyProjectsDescription:
      "Pacchetti importati per soddisfare le dipendenze del target.",
    noDependenciesTitle: "Nessuna dipendenza da mostrare",
    noDatasetsTitle: "Nessun dataset da mostrare",
    open: "Apri",
    exportProject: "Esporta progetto...",
    deleteProject: "Elimina progetto",
    editDatasetInfo: "Info dataset",
    duplicateDataset: "Duplica dataset",
    exportDataset: "Esporta dataset",
    deleteDataset: "Elimina dataset",
    duplicateDatasetName: "{name} (Copia)",
    datasetDuplicated: 'Dataset "{name}" duplicato.',
  },
} satisfies Record<"de" | "en" | "fr" | "es" | "it", OverviewText>;

const formatText = (template: string, values: Record<string, string | number>) =>
  template.replace(/\{(\w+)\}/g, (_, key) => String(values[key] ?? ""));

type ProjectCardProps = {
  kind: "Target" | "Dependency";
  project: PackageRecord;
  dependencyCount?: number;
  owners?: string[];
  datasets: DatasetRecord[];
  text: OverviewText;
  onCreateDataset: (project: PackageRecord) => void;
  onImportDataset: (project: PackageRecord) => void;
  onOpenDependencyTree: (project: PackageRecord) => void;
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

const ProjectCard = ({
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
            {datasetActionsDisabled ? (
              <Badge variant="outline">{text.importInProgress}</Badge>
            ) : null}
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
              <p className="text-xs text-muted-foreground">
                {text.datasetsSectionDescription}
              </p>
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
                        <DropdownMenuItem
                          variant="destructive"
                          onClick={() => onDeleteDataset(dataset)}
                        >
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

export default function EditorOverviewPage() {
  const { locale } = useI18n();
  const text = byLocale(locale, localizedOverviewText);
  const { snapshot, refresh, deletePackage, getResourcePayloadsByPackageKeys, clearAllData } = useImporter();
  const [filter, setFilter] = useState("");
  const [viewMode, setViewMode] = useState<"projects" | "datasets">("projects");
  const [viewModeLoaded, setViewModeLoaded] = useState(false);
  const [datasets, setDatasets] = useState<DatasetRecord[]>([]);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [settingsDialogOpen, setSettingsDialogOpen] = useState(false);
  const [selectedProject, setSelectedProject] = useState<PackageRecord | null>(null);
  const [selectedProjectKey, setSelectedProjectKey] = useState<string | null>(null);
  const [exportTarget, setExportTarget] = useState<PackageRecord | null>(null);
  const [dependencyTreeRootKey, setDependencyTreeRootKey] = useState<string | null>(null);
  const [datasetName, setDatasetName] = useState("");
  const [importDatasetFile, setImportDatasetFile] = useState<File | null>(null);
  const [exportIncludeDatasets, setExportIncludeDatasets] = useState(true);
  const [exportFormat, setExportFormat] = useState<"json" | "zip">("json");
  const [exportScope, setExportScope] = useState<"project" | "dataset">("project");
  const [exportDatasetMode, setExportDatasetMode] = useState<
    "package" | "resources" | "searchset"
  >("package");
  const [exportDatasetId, setExportDatasetId] = useState<string | null>(null);
  const [datasetInfoOpen, setDatasetInfoOpen] = useState(false);
  const [datasetInfoId, setDatasetInfoId] = useState<string | null>(null);

  useEffect(() => {
    if (typeof document === "undefined") return;
    document.title = text.pageBrowserTitle;
  }, [text.pageBrowserTitle]);

  useEffect(() => {
    setDatasets(loadDatasets());
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const storedView = window.localStorage.getItem("fhir-explorer-overview-viewmode");
    if (storedView === "projects" || storedView === "datasets") {
      setViewMode(storedView);
    }
    setViewModeLoaded(true);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!viewModeLoaded) return;
    window.localStorage.setItem("fhir-explorer-overview-viewmode", viewMode);
  }, [viewMode, viewModeLoaded]);

  const packages = snapshot?.packages ?? EMPTY_PACKAGES;
  const dependencyState = snapshot?.dependencyState;
  const importHistory = snapshot?.state.importHistory ?? EMPTY_IMPORT_HISTORY;
  const currentTarget = snapshot?.state.currentTarget;
  const targetStatus = useMemo(
    () => ({
      packages,
      state: { currentTarget },
      dependencyState,
    }),
    [packages, currentTarget, dependencyState]
  );
  const currentTargetKey = getCurrentTargetKey(targetStatus.state);
  const currentTargetImportInProgress = isTargetImportInProgress(targetStatus);
  const isProjectDatasetSelectable = (projectKey: string) =>
    isProjectSelectableForDatasets(projectKey, targetStatus);

  const graph = useMemo(() => buildDependencyGraph(packages), [packages]);
  const exportDatasetOptions = useMemo(() => {
    if (!exportTarget) return [];
    return datasets
      .filter((entry) => entry.projectKey === exportTarget.key)
      .map((entry) => ({
        value: entry.id,
        label: entry.name,
        secondary: entry.id,
      }));
  }, [datasets, exportTarget]);

  useEffect(() => {
    if (!exportTarget) {
      setExportDatasetId(null);
      return;
    }
    const list = datasets.filter((entry) => entry.projectKey === exportTarget.key);
    if (list.length === 0) {
      setExportDatasetId(null);
      return;
    }
    if (!exportDatasetId || !list.some((entry) => entry.id === exportDatasetId)) {
      setExportDatasetId(list[0].id);
    }
  }, [datasets, exportTarget, exportDatasetId]);

  const targetKeys = useMemo(() => {
    const keys: string[] = [];
    const seen = new Set<string>();

    for (const entry of importHistory) {
      if (!seen.has(entry.targetKey)) {
        keys.push(entry.targetKey);
        seen.add(entry.targetKey);
      }
    }

    return keys;
  }, [importHistory]);

  const targets = useMemo<ProjectEntry[]>(
    () => targetKeys.map((key) => ({ key, record: graph.byKey.get(key) })),
    [targetKeys, graph]
  );

  const dependenciesByTarget = useMemo(() => {
    const map = new Map<string, Set<string>>();
    for (const target of targets) {
      if (!target.record) continue;
      map.set(target.key, collectDependencies(target.key, graph));
    }
    return map;
  }, [targets, graph]);

  const dependencyOwners = useMemo(() => {
    const map = new Map<string, Set<string>>();
    for (const [targetKey, deps] of dependenciesByTarget) {
      for (const depKey of deps) {
        if (!map.has(depKey)) {
          map.set(depKey, new Set());
        }
        map.get(depKey)!.add(targetKey);
      }
    }
    return map;
  }, [dependenciesByTarget]);

  const dependencyProjects = useMemo(() => {
    const projects: PackageRecord[] = [];
    for (const depKey of dependencyOwners.keys()) {
      const pkg = graph.byKey.get(depKey);
      if (pkg) projects.push(pkg);
    }
    return projects.sort((a, b) => {
      const idCompare = a.id.localeCompare(b.id);
      if (idCompare !== 0) return idCompare;
      return a.version.localeCompare(b.version);
    });
  }, [dependencyOwners, graph]);

  const datasetsByProject = useMemo(() => {
    const map = new Map<string, DatasetRecord[]>();
    for (const dataset of datasets) {
      const list = map.get(dataset.projectKey) ?? [];
      list.push(dataset);
      map.set(dataset.projectKey, list);
    }
    for (const list of map.values()) {
      list.sort((a, b) => b.createdAt - a.createdAt);
    }
    return map;
  }, [datasets]);

  const projectByKey = useMemo(() => {
    const map = new Map<string, PackageRecord>();
    for (const pkg of packages) {
      map.set(pkg.key, pkg);
    }
    return map;
  }, [packages]);

  const projectOptions = useMemo(() => {
    return [...packages].sort((a, b) => {
      const idCompare = a.id.localeCompare(b.id);
      if (idCompare !== 0) return idCompare;
      return a.version.localeCompare(b.version);
    });
  }, [packages]);
  const datasetInfoProjectSuggestions = useMemo(
    () =>
      projectOptions.map((entry) => ({
        key: entry.key,
        label: `${entry.id}@${entry.version}`,
      })),
    [projectOptions]
  );
  const selectableProjectOptions = projectOptions.filter((project) =>
    isProjectDatasetSelectable(project.key)
  );

  const normalizedFilter = filter.trim().toLowerCase();
  const filteredTargets = targets.filter(
    (target) => target.record && matchesFilter(normalizedFilter, target.record, target.key)
  );
  const filteredDependencies = dependencyProjects.filter((project) =>
    matchesFilter(normalizedFilter, project, project.key)
  );

  const filteredDatasets = useMemo(() => {
    if (!normalizedFilter) return datasets;
    return datasets.filter((dataset) => {
      const project = projectByKey.get(dataset.projectKey);
      const haystack = [
        dataset.name,
        dataset.projectKey,
        project?.id,
        project?.manifest.title,
        project?.manifest.name,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(normalizedFilter);
    });
  }, [datasets, normalizedFilter, projectByKey]);

  const dependentsByProject = useMemo(() => {
    const map = new Map<string, Set<string>>();
    for (const [ownerKey, deps] of dependenciesByTarget) {
      for (const depKey of deps) {
        if (!map.has(depKey)) map.set(depKey, new Set());
        map.get(depKey)!.add(ownerKey);
      }
    }
    return map;
  }, [dependenciesByTarget]);

  const canDeleteProject = (projectKey: string) => {
    const dependents = dependentsByProject.get(projectKey);
    return !dependents || dependents.size === 0;
  };

  const deleteReasonFor = (projectKey: string) => {
    const dependents = dependentsByProject.get(projectKey);
    if (!dependents || dependents.size === 0) return undefined;
    return formatText(text.cannotDeleteUsedBy, {
      projects: Array.from(dependents).sort().join(", "),
    });
  };

  const openDatasetDialog = (project: PackageRecord) => {
    const defaultName = project.manifest.title ?? project.manifest.name ?? project.id;
    setSelectedProject(project);
    setSelectedProjectKey(project.key);
    setDatasetName(`${defaultName} ${text.datasetSuffix}`);
    setImportDatasetFile(null);
    setCreateDialogOpen(true);
  };

  const openImportDialog = (project: PackageRecord) => {
    const defaultName = project.manifest.title ?? project.manifest.name ?? project.id;
    setSelectedProject(project);
    setSelectedProjectKey(project.key);
    setDatasetName(`${defaultName} ${text.datasetSuffix}`);
    setImportDatasetFile(null);
    setImportDialogOpen(true);
  };

  const openDatasetDialogFromList = () => {
    setSelectedProject(null);
    setSelectedProjectKey(null);
    setDatasetName("");
    setImportDatasetFile(null);
    setCreateDialogOpen(true);
  };

  const openExportDialog = (project: PackageRecord) => {
    setExportTarget(project);
    setExportScope("project");
    setExportIncludeDatasets(true);
    setExportFormat("json");
    setExportDatasetMode("package");
    const firstDataset = datasets.find((entry) => entry.projectKey === project.key);
    setExportDatasetId(firstDataset?.id ?? null);
    setExportDialogOpen(true);
  };

  const openDependencyTree = (project: PackageRecord) => {
    setDependencyTreeRootKey(project.key);
  };

  const handleProjectSelection = (projectKey: string) => {
    if (!projectKey) {
      setSelectedProject(null);
      setSelectedProjectKey(null);
      return;
    }
    const project = projectByKey.get(projectKey) ?? null;
    setSelectedProject(project);
    setSelectedProjectKey(projectKey);
    if (project && !datasetName.trim()) {
      const defaultName = project.manifest.title ?? project.manifest.name ?? project.id;
      setDatasetName(`${defaultName} ${text.datasetSuffix}`);
    }
  };

  const handleCreateDataset = () => {
    if (!selectedProject) {
      toast.error(text.selectProjectForDataset);
      return;
    }
    if (!isProjectDatasetSelectable(selectedProject.key)) {
      toast.error(text.datasetActionsBlockedUntilImportComplete);
      return;
    }
    const name = datasetName.trim();
    if (!name) {
      toast.error(text.datasetNameRequired);
      return;
    }
    const dataset: DatasetRecord = {
      id: createDatasetId(),
      name,
      projectKey: selectedProject.key,
      createdAt: Date.now(),
    };
    const next = upsertDataset(dataset);
    saveDatasetResources(dataset.id, []);
    setDatasets(next);
    setCreateDialogOpen(false);
    toast.success(text.datasetCreated);
  };

  const handleImportDataset = async () => {
    if (!selectedProject) {
      toast.error(text.selectProjectForDataset);
      return;
    }
    if (!isProjectDatasetSelectable(selectedProject.key)) {
      toast.error(text.datasetActionsBlockedUntilImportComplete);
      return;
    }
    if (!importDatasetFile) {
      toast.error(text.chooseDatasetFile);
      return;
    }
    try {
      const parseImportFile = async (file: File) => {
        const lower = file.name.toLowerCase();
        const isZip =
          lower.endsWith(".zip") || file.type === "application/zip" || file.type === "application/x-zip-compressed";
        if (!isZip) {
          const raw = await file.text();
          return JSON.parse(raw);
        }
        const zip = await JSZip.loadAsync(file);
        const jsonEntry = Object.values(zip.files).find(
          (entry) => !entry.dir && entry.name.toLowerCase().endsWith(".json")
        );
        if (!jsonEntry) {
          throw new Error(text.zipNoJson);
        }
        const raw = await jsonEntry.async("text");
        return JSON.parse(raw);
      };

      const parsed = (await parseImportFile(importDatasetFile)) as
        | { name?: string; id?: string; resources?: unknown[] }
        | { datasets?: Array<{ name?: string; id?: string; resources?: unknown[] }> }
        | { resourceType?: string; type?: string; entry?: Array<{ resource?: unknown }> }
        | unknown[];

      let importedName: string | undefined;
      let importedId: string | undefined;
      let importedResources: unknown[] | undefined;

      if (Array.isArray(parsed)) {
        importedResources = parsed;
      } else if (
        parsed &&
        typeof parsed === "object" &&
        Array.isArray((parsed as { datasets?: Array<{ name?: string; id?: string }> }).datasets)
      ) {
        const first = (parsed as { datasets?: Array<{ name?: string; id?: string; resources?: unknown[] }> }).datasets?.[0];
        importedName = first?.name;
        importedId = first?.id;
        importedResources = first?.resources;
      } else if (
        parsed &&
        typeof parsed === "object" &&
        (parsed as { resourceType?: string }).resourceType === "Bundle" &&
        (parsed as { type?: string }).type === "searchset"
      ) {
        const entries = (parsed as { entry?: Array<{ resource?: unknown }> }).entry ?? [];
        importedResources = entries.map((entry) => entry.resource).filter(Boolean) as unknown[];
      } else {
        importedName = (parsed as { name?: string }).name;
        importedId = (parsed as { id?: string }).id;
        importedResources = (parsed as { resources?: unknown[] }).resources;
      }

      const name = (importedName ?? datasetName).trim();
      if (!name) {
        toast.error(text.datasetNameMissingImport);
        return;
      }

      const dataset: DatasetRecord = {
        id: importedId ?? createDatasetId(),
        name,
        projectKey: selectedProject.key,
        createdAt: Date.now(),
      };
      const resources = hydrateDatasetResources(Array.isArray(importedResources) ? importedResources : []);
      saveDatasetResources(dataset.id, resources);
      const next = upsertDataset(dataset);
      setDatasets(next);
      setImportDialogOpen(false);
      setImportDatasetFile(null);
      toast.success(text.datasetImported);
    } catch (error) {
      toast.error(text.datasetImportFailed);
      console.error(error);
    }
  };

  const handleDeleteDataset = (dataset: DatasetRecord) => {
    const ok = window.confirm(formatText(text.confirmDeleteDataset, { name: dataset.name }));
    if (!ok) return;
    clearDatasetResources(dataset.id);
    const next = removeDataset(dataset.id);
    setDatasets(next);
    toast.success(text.datasetDeleted);
  };

  const handleDuplicateDataset = (dataset: DatasetRecord) => {
    if (!isProjectDatasetSelectable(dataset.projectKey)) {
      toast.error(text.datasetActionsBlockedUntilImportComplete);
      return;
    }

    const cloneJson = <T,>(value: T): T => {
      if (typeof structuredClone === "function") return structuredClone(value);
      return JSON.parse(JSON.stringify(value)) as T;
    };

    const baseName = formatText(text.duplicateDatasetName, { name: dataset.name });
    const existingNames = new Set(
      datasets
        .filter((entry) => entry.projectKey === dataset.projectKey)
        .map((entry) => entry.name)
    );
    let name = baseName;
    for (let i = 2; existingNames.has(name); i += 1) {
      name = `${baseName} ${i}`;
    }

    const duplicated: DatasetRecord = {
      id: createDatasetId(),
      name,
      projectKey: dataset.projectKey,
      createdAt: getTimestamp(),
    };

    const resources = loadDatasetResources(dataset.id);
    const copiedResources = resources.map((resource) => ({
      ...resource,
      content: cloneJson(resource.content),
      createdAt: duplicated.createdAt,
      updatedAt: duplicated.createdAt,
      lastSelectedAt: undefined,
    }));
    saveDatasetResources(duplicated.id, copiedResources);

    const next = upsertDataset(duplicated);
    setDatasets(next);
    toast.success(formatText(text.datasetDuplicated, { name: duplicated.name }));
  };

  const handleOpenDatasetInfo = (dataset: DatasetRecord) => {
    if (!isProjectDatasetSelectable(dataset.projectKey)) {
      toast.error(text.datasetActionsBlockedUntilImportComplete);
      return;
    }
    setDatasetInfoId(dataset.id);
    setDatasetInfoOpen(true);
  };

  const datasetInfoDataset = useMemo(() => {
    if (!datasetInfoId) return null;
    return datasets.find((entry) => entry.id === datasetInfoId) ?? null;
  }, [datasets, datasetInfoId]);

  const handleSaveDatasetInfo = (payload: { id: string; name: string; projectKey: string }) => {
    const existing = datasets.find((entry) => entry.id === payload.id);
    if (!existing) return;
    const nextDataset: DatasetRecord = { ...existing, name: payload.name, projectKey: payload.projectKey };
    const next = upsertDataset(nextDataset);
    setDatasets(next);
  };

  const handleDeleteProject = async (project: PackageRecord) => {
    if (!canDeleteProject(project.key)) {
      toast.error(text.projectRequiredByOthers);
      return;
    }
    const ok = window.confirm(
      formatText(text.confirmDeleteProject, {
        project: `${project.id}@${project.version}`,
      })
    );
    if (!ok) return;
    await deletePackage(project.key);
    const datasetIds = datasets
      .filter((dataset) => dataset.projectKey === project.key)
      .map((dataset) => dataset.id);
    for (const datasetId of datasetIds) {
      clearDatasetResources(datasetId);
    }
    const next = removeDatasetsForProject(project.key);
    setDatasets(next);
    toast.success(text.projectDeleted);
  };

  const buildSearchsetBundle = (entries: unknown[]) => ({
    resourceType: "Bundle",
    type: "searchset",
    total: entries.length,
    entry: entries.map((resource) => ({ resource })),
  });

  const exportDatasetWithMode = async (
    dataset: DatasetRecord,
    mode: "package" | "resources" | "searchset"
  ) => {
    const resources = loadDatasetResources(dataset.id).map((entry) => entry.content);
    const safeName = toSafeFilename(dataset.name) || "dataset";
    let payload: unknown;
    let filename = `${safeName}.json`;
    let zipName = `${safeName}.zip`;

    if (mode === "package") {
      payload = {
        id: dataset.id,
        name: dataset.name,
        projectKey: dataset.projectKey,
        resources,
      };
      filename = `${safeName}.json`;
      zipName = `${safeName}.zip`;
    } else if (mode === "resources") {
      payload = resources;
      filename = `${safeName}-resources.json`;
      zipName = `${safeName}-resources.zip`;
    } else {
      payload = buildSearchsetBundle(resources);
      filename = `${safeName}-searchset.json`;
      zipName = `${safeName}-searchset.zip`;
    }

    if (exportFormat === "json") {
      downloadJson(filename, payload);
    } else {
      const zip = new JSZip();
      zip.file(filename, JSON.stringify(payload, null, 2));
      const blob = await zip.generateAsync({ type: "blob" });
      downloadBlob(zipName, blob);
    }
    toast.success(text.datasetExported);
  };

  const handleExportDataset = (dataset: DatasetRecord) => {
    exportDatasetWithMode(dataset, "package");
  };

  const prepareProjectExport = async (
    project: PackageRecord,
    includeDatasets: boolean
  ): Promise<{
    projectKeys: Set<string>;
    exportPackages: ComposePackageExport[];
    exportDatasets: ComposeDatasetExport[];
  } | null> => {
    const dependencyKeys = collectDependencies(project.key, graph);
    const projectKeys = new Set<string>([project.key, ...dependencyKeys]);
    const packageRecords = Array.from(projectKeys)
      .map((key) => graph.byKey.get(key))
      .filter((record): record is PackageRecord => Boolean(record));

    if (packageRecords.length === 0) {
      toast.error(text.noPackagesToExport);
      return null;
    }

    const payloads = await getResourcePayloadsByPackageKeys(Array.from(projectKeys));
    const payloadsByKey = new Map<string, typeof payloads>();
    for (const payload of payloads) {
      const list = payloadsByKey.get(payload.packageKey) ?? [];
      list.push(payload);
      payloadsByKey.set(payload.packageKey, list);
    }

    const exportPackages: ComposePackageExport[] = packageRecords.map((pkg) => ({
      key: pkg.key,
      id: pkg.id,
      version: pkg.version,
      manifest: pkg.manifest,
      resources: (payloadsByKey.get(pkg.key) ?? []).map((resource) => ({
        resourceType: resource.resourceType,
        id: resource.id,
        url: resource.url,
        content: resource.content,
      })),
    }));

    const exportDatasets: ComposeDatasetExport[] = includeDatasets
      ? datasets
          .filter((dataset) => projectKeys.has(dataset.projectKey))
          .map((dataset) => ({
            id: dataset.id,
            name: dataset.name,
            projectKey: dataset.projectKey,
            resources: loadDatasetResources(dataset.id).map((entry) => entry.content),
          }))
      : [];

    return {
      projectKeys,
      exportPackages,
      exportDatasets,
    };
  };

  const exportProjectAsJson = async (project: PackageRecord, includeDatasets: boolean) => {
    const prepared = await prepareProjectExport(project, includeDatasets);
    if (!prepared) return;

    const payload: ComposeProjectExport = {
      type: "fhir-explorer-project",
      version: 1,
      targetKey: project.key,
      exportedAt: new Date().toISOString(),
      packages: prepared.exportPackages,
      datasets: prepared.exportDatasets,
    };

    const filename =
      toSafeFilename(`${project.id}-${project.version}-compose.json`) ||
      "compose-project.json";
    downloadJson(filename, payload);
    toast.success(text.projectExported);
  };

  const exportProjectAsZip = async (project: PackageRecord, includeDatasets: boolean) => {
    const prepared = await prepareProjectExport(project, includeDatasets);
    if (!prepared) return;

    const zip = new JSZip();
    const packagesFolder = zip.folder("packages");
    const datasetsFolder = zip.folder("datasets");

    const packageEntries = prepared.exportPackages.map((pkg) => {
      const filename = toSafeFilename(`${pkg.key}.json`) || "package.json";
      packagesFolder?.file(filename, JSON.stringify(pkg, null, 2));
      return {
        key: pkg.key,
        id: pkg.id,
        version: pkg.version,
        manifest: pkg.manifest,
        file: `packages/${filename}`,
      };
    });

    const datasetEntries = prepared.exportDatasets.map((dataset, index) => {
      const baseName = toSafeFilename(dataset.id ?? dataset.name) || `dataset-${index + 1}`;
      const filename = `${baseName}.json`;
      datasetsFolder?.file(filename, JSON.stringify(dataset, null, 2));
      return {
        id: dataset.id,
        name: dataset.name,
        projectKey: dataset.projectKey,
        file: `datasets/${filename}`,
      };
    });

    const manifest: ComposeProjectArchiveManifest = {
      type: "fhir-explorer-project-archive",
      version: 1,
      targetKey: project.key,
      exportedAt: new Date().toISOString(),
      packages: packageEntries,
      datasets: includeDatasets ? datasetEntries : undefined,
    };

    zip.file("compose-project.json", JSON.stringify(manifest, null, 2));
    const blob = await zip.generateAsync({ type: "blob" });
    const filename =
      toSafeFilename(`${project.id}-${project.version}-compose.zip`) || "compose-project.zip";
    downloadBlob(filename, blob);
    toast.success(text.projectExported);
  };

  const handleExportProjectConfirm = async () => {
    if (!exportTarget) return;
    if (exportFormat === "json") {
      await exportProjectAsJson(exportTarget, exportIncludeDatasets);
    } else {
      await exportProjectAsZip(exportTarget, exportIncludeDatasets);
    }
    setExportDialogOpen(false);
    setExportTarget(null);
  };

  const handleExportConfirm = async () => {
    if (!exportTarget) return;
    if (exportScope === "dataset") {
      const dataset = datasets.find((entry) => entry.id === exportDatasetId);
      if (!dataset) {
        toast.error(text.noDatasetSelected);
        return;
      }
      await exportDatasetWithMode(dataset, exportDatasetMode);
      setExportDialogOpen(false);
      setExportTarget(null);
      return;
    }

    await handleExportProjectConfirm();
  };

  const handleDeleteAllData = async () => {
    const ok = window.confirm(text.confirmDeleteAllData);
    if (!ok) return;
    try {
      await clearAllData();
      clearAllDatasetResources();
      clearDatasets();
      setDatasets([]);
      setSelectedProject(null);
      setSelectedProjectKey(null);
      toast.success(text.localDataCleared);
    } catch (error) {
      console.error("Failed to clear local data", error);
      toast.error(text.failedClearLocalData);
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-10">
      <header className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground">
              {text.editorEyebrow}
            </p>
            <h1 className="text-3xl font-semibold text-foreground">{text.pageTitle}</h1>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="ghost" onClick={() => void refresh()}>
              {text.refresh}
            </Button>
          </div>
        </div>
        <p className="max-w-3xl text-sm text-muted-foreground">
          {text.pageDescription}
        </p>
      </header>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-foreground">
            {viewMode === "projects"
              ? text.projectsOverviewTitle
              : text.datasetsOverviewTitle}
          </h2>
          <p className="text-sm text-muted-foreground">
            {viewMode === "projects"
              ? text.projectsOverviewDescription
              : text.datasetsOverviewDescription}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button asChild size="sm" variant="outline">
            <Link href="/importer">{text.importProject}</Link>
          </Button>
          <Button
            size="sm"
            variant="secondary"
            disabled={selectableProjectOptions.length === 0}
            onClick={openDatasetDialogFromList}
          >
            {text.createDataset}
          </Button>
          <Button
            size="icon-sm"
            variant="outline"
            aria-label={text.settingsAria}
            onClick={() => setSettingsDialogOpen(true)}
          >
            <Settings className="size-4" />
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Input
          id="project-filter"
          value={filter}
          onChange={(event) => setFilter(event.target.value)}
          placeholder={text.filterPlaceholder}
          className="h-8 max-w-xs"
        />
        <div className="flex items-center gap-2">
          <div className="h-6 w-px bg-border" />
          <Button
            size="icon-sm"
            variant={viewMode === "projects" ? "secondary" : "outline"}
            onClick={() => setViewMode("projects")}
            aria-label={text.projectViewAria}
          >
            <LayoutGrid className="size-4" />
          </Button>
          <Button
            size="icon-sm"
            variant={viewMode === "datasets" ? "secondary" : "outline"}
            onClick={() => setViewMode("datasets")}
            aria-label={text.datasetViewAria}
          >
            <Database className="size-4" />
          </Button>
        </div>
      </div>

      {viewMode === "projects" ? (
        <>
          <section className="grid gap-4">
            {filteredTargets.length === 0 ? (
              <Card className="border-dashed border-foreground/20">
                <CardHeader>
                  <CardTitle>{text.noTargetsTitle}</CardTitle>
                  <CardDescription>
                    {text.noTargetsDescription}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button asChild>
                    <Link href="/importer">{text.goToImporter}</Link>
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {filteredTargets.map((target) =>
                  target.record ? (
                    <ProjectCard
                      key={target.key}
                      kind="Target"
                      project={target.record}
                      text={text}
                      dependencyCount={dependenciesByTarget.get(target.key)?.size ?? 0}
                      datasets={datasetsByProject.get(target.key) ?? []}
                      onCreateDataset={openDatasetDialog}
                      onImportDataset={openImportDialog}
                      onOpenDependencyTree={openDependencyTree}
                      onOpenExportDialog={openExportDialog}
                      onExportDataset={handleExportDataset}
                      onEditDatasetInfo={handleOpenDatasetInfo}
                      onDuplicateDataset={handleDuplicateDataset}
                      onDeleteDataset={handleDeleteDataset}
                      onDeleteProject={handleDeleteProject}
                      canDeleteProject={canDeleteProject(target.key)}
                      deleteReason={deleteReasonFor(target.key)}
                      datasetActionsDisabled={
                        target.key === currentTargetKey && currentTargetImportInProgress
                      }
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
                <h2 className="text-xl font-semibold text-foreground">
                  {text.dependencyProjectsTitle}
                </h2>
                <p className="text-sm text-muted-foreground">
                  {text.dependencyProjectsDescription}
                </p>
              </div>
            </div>

            {filteredDependencies.length === 0 ? (
              <Card className="border-dashed border-foreground/20">
                <CardHeader>
                  <CardTitle>{text.noDependenciesTitle}</CardTitle>
                  <CardDescription>
                    {text.noDependenciesDescription}
                  </CardDescription>
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
                    onCreateDataset={openDatasetDialog}
                    onImportDataset={openImportDialog}
                    onOpenDependencyTree={openDependencyTree}
                    onOpenExportDialog={openExportDialog}
                    onExportDataset={handleExportDataset}
                    onEditDatasetInfo={handleOpenDatasetInfo}
                    onDuplicateDataset={handleDuplicateDataset}
                    onDeleteDataset={handleDeleteDataset}
                    onDeleteProject={handleDeleteProject}
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
      ) : (
        <section className="grid gap-4">
          {filteredDatasets.length === 0 ? (
            <Card className="border-dashed border-foreground/20">
              <CardHeader>
                <CardTitle>{text.noDatasetsTitle}</CardTitle>
                <CardDescription>
                  {text.noDatasetsDescription}
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                <Button asChild size="sm" variant="outline">
                  <Link href="/importer">{text.importProject}</Link>
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={selectableProjectOptions.length === 0}
                  onClick={openDatasetDialogFromList}
                >
                  {text.createDataset}
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {filteredDatasets.map((dataset) => {
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
                              onClick={() => handleOpenDatasetInfo(dataset)}
                            >
                              {text.editDatasetInfo}
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              disabled={!isProjectDatasetSelectable(dataset.projectKey)}
                              onClick={() => handleDuplicateDataset(dataset)}
                            >
                              {text.duplicateDataset}
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleExportDataset(dataset)}>
                              {text.exportDataset}
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              variant="destructive"
                              onClick={() => handleDeleteDataset(dataset)}
                            >
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
                          {project?.manifest.title ??
                            project?.manifest.name ??
                            project?.id ??
                            text.unknownProject}
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Button asChild size="sm" variant="secondary">
                          <Link href={`/${dataset.id}`}>{text.open}</Link>
                        </Button>
                        {project ? (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openExportDialog(project)}
                          >
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
      )}

      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{text.createDatasetDialogTitle}</DialogTitle>
            <DialogDescription>
              {formatText(text.createDatasetDialogDescription, {
                project: selectedProject?.id ?? text.thisProject,
              })}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid gap-2">
              <Label htmlFor="dataset-project">{text.projectLabel}</Label>
              <select
                id="dataset-project"
                value={selectedProjectKey ?? ""}
                onChange={(event) => handleProjectSelection(event.target.value)}
                className="h-9 rounded-md border border-foreground/20 bg-background px-3 text-sm"
              >
                <option value="">{text.selectProject}</option>
                {selectableProjectOptions.map((project) => (
                  <option key={project.key} value={project.key}>
                    {project.id}@{project.version}
                  </option>
                ))}
              </select>
              <p className="text-xs text-muted-foreground">
                {text.chooseProjectHint}
              </p>
            </div>
            <Label htmlFor="dataset-name">{text.datasetNameLabel}</Label>
            <Input
              id="dataset-name"
              value={datasetName}
              onChange={(event) => setDatasetName(event.target.value)}
              placeholder={text.datasetNamePlaceholder}
            />
            <p className="text-xs text-muted-foreground">
              {text.createDatasetHint}
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
              {text.cancel}
            </Button>
            <Button onClick={handleCreateDataset}>
              {text.createDatasetConfirm}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{text.importDatasetDialogTitle}</DialogTitle>
            <DialogDescription>
              {formatText(text.importDatasetDialogDescription, {
                project: selectedProject?.id ?? text.thisProject,
              })}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid gap-2">
              <Label htmlFor="dataset-import-project">{text.projectLabel}</Label>
              <select
                id="dataset-import-project"
                value={selectedProjectKey ?? ""}
                onChange={(event) => handleProjectSelection(event.target.value)}
                className="h-9 rounded-md border border-foreground/20 bg-background px-3 text-sm"
              >
                <option value="">{text.selectProject}</option>
                {selectableProjectOptions.map((project) => (
                  <option key={project.key} value={project.key}>
                    {project.id}@{project.version}
                  </option>
                ))}
              </select>
              <p className="text-xs text-muted-foreground">
                {text.chooseProjectHint}
              </p>
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
                onFiles={(files) => setImportDatasetFile(files[0] ?? null)}
              />
              {importDatasetFile ? (
                <div className="flex items-center justify-between rounded-md border border-foreground/10 bg-muted/20 px-3 py-2 text-xs">
                  <span className="truncate text-foreground" title={importDatasetFile.name}>
                    {text.selectedPrefix} {importDatasetFile.name}
                  </span>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => setImportDatasetFile(null)}
                  >
                    {text.clear}
                  </Button>
                </div>
              ) : null}
              <p className="text-xs text-muted-foreground">
                {text.datasetFileSupportHint}
              </p>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="dataset-import-name">{text.fallbackNameLabel}</Label>
              <Input
                id="dataset-import-name"
                value={datasetName}
                onChange={(event) => setDatasetName(event.target.value)}
                placeholder={text.datasetNamePlaceholder}
              />
              <p className="text-xs text-muted-foreground">
                {text.fallbackNameHint}
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setImportDialogOpen(false)}>
              {text.cancel}
            </Button>
            <Button variant="secondary" onClick={handleImportDataset}>
              {text.importDatasetConfirm}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ExportDialog
        open={exportDialogOpen}
        onOpenChange={(open) => {
          setExportDialogOpen(open);
          if (!open) {
            setExportTarget(null);
          }
        }}
        title={text.exportProjectDialogTitle}
        description={formatText(text.exportProjectDialogDescription, {
          project: exportTarget?.id ?? text.thisProject,
        })}
        scope={exportScope}
        scopeOptions={[
          {
            value: "project",
            label: text.scopeProjectDependencies,
          },
          {
            value: "dataset",
            label: text.scopeDatasetOnly,
            disabled: exportDatasetOptions.length === 0,
            helper:
              exportDatasetOptions.length === 0
                ? text.scopeNoDatasetHelper
                : undefined,
          },
        ]}
        onScopeChange={setExportScope}
        exportFormat={exportFormat}
        onExportFormatChange={setExportFormat}
        datasetMode={exportDatasetMode}
        onDatasetModeChange={setExportDatasetMode}
        datasetOptions={exportDatasetOptions}
        selectedDataset={exportDatasetId}
        onDatasetChange={setExportDatasetId}
        includeDatasets={exportIncludeDatasets}
        onIncludeDatasetsChange={setExportIncludeDatasets}
        confirmLabel={
          exportScope === "dataset"
            ? text.exportDatasetConfirm
            : text.exportProjectConfirm
        }
        confirmDisabled={
          !exportTarget || (exportScope === "dataset" && !exportDatasetId)
        }
        onConfirm={handleExportConfirm}
      />

      <DependencyTreeDialog
        open={Boolean(dependencyTreeRootKey)}
        onOpenChange={(open) => {
          if (!open) {
            setDependencyTreeRootKey(null);
          }
        }}
        graph={graph}
        rootProjectKey={dependencyTreeRootKey}
      />

      <DatasetInfoDialog
        open={datasetInfoOpen}
        onOpenChange={(open) => {
          setDatasetInfoOpen(open);
          if (!open) {
            setDatasetInfoId(null);
          }
        }}
        dataset={datasetInfoDataset}
        projectSuggestions={datasetInfoProjectSuggestions}
        onOpenDependencyTree={(projectKey) => setDependencyTreeRootKey(projectKey)}
        onSave={handleSaveDatasetInfo}
      />

      <Dialog open={settingsDialogOpen} onOpenChange={setSettingsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{text.settingsTitle}</DialogTitle>
            <DialogDescription>{text.settingsDescription}</DialogDescription>
          </DialogHeader>
          <div className="rounded-lg border border-foreground/10 bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
            {text.settingsDeleteInfo}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSettingsDialogOpen(false)}>
              {text.close}
            </Button>
            <Button variant="destructive" onClick={handleDeleteAllData}>
              {text.deleteAllLocalData}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
