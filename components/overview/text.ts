type OverviewTextBase = {
  pageBrowserTitle: string;
  datasetSuffix: string;
  noDescriptionProvided: string;
  kindTarget: string;
  kindDependency: string;
  resourcesCount: string;
  projectActionsAria: string;
  projectActions: string;
  showDependencyTree: string;
  exportProject: string;
  deleteProject: string;
  addedPrefix: string;
  dependenciesPrefix: string;
  datasetsPrefix: string;
  usedByPrefix: string;
  datasetsSectionTitle: string;
  datasetsSectionDescription: string;
  dependencyCountLabel: string;
  datasetsWithCount: string;
  newDataset: string;
  datasetsEmptyHint: string;
  dependencyPackagesCount: string;
  graphTitle: string;
  graphNodeTarget: string;
  graphNodeResolved: string;
  graphNodeMissing: string;
  graphEmpty: string;
  createDatasetAria: string;
  importDatasetAria: string;
  importInProgress: string;
  noDatasetsYet: string;
  createdPrefix: string;
  open: string;
  datasetActionsAria: string;
  editDatasetInfo: string;
  duplicateDataset: string;
  exportDataset: string;
  deleteDataset: string;
  duplicateDatasetName: string;
  datasetDuplicated: string;
  selectProjectForDataset: string;
  datasetNameRequired: string;
  datasetCreated: string;
  datasetActionsBlockedUntilImportComplete: string;
  chooseDatasetFile: string;
  zipNoJson: string;
  datasetNameMissingImport: string;
  datasetImported: string;
  datasetImportFailed: string;
  confirmDeleteDataset: string;
  datasetDeleted: string;
  projectRequiredByOthers: string;
  confirmDeleteProject: string;
  projectDeleted: string;
  datasetExported: string;
  noPackagesToExport: string;
  projectExported: string;
  noDatasetSelected: string;
  cannotDeleteUsedBy: string;
  confirmDeleteAllData: string;
  localDataCleared: string;
  failedClearLocalData: string;
  editorEyebrow: string;
  pageTitle: string;
  refresh: string;
  pageDescription: string;
  projectsOverviewTitle: string;
  datasetsOverviewTitle: string;
  projectsOverviewDescription: string;
  datasetsOverviewDescription: string;
  importProject: string;
  createDataset: string;
  settingsAria: string;
  filterPlaceholder: string;
  projectViewAria: string;
  datasetViewAria: string;
  viewProjectsLabel: string;
  viewDatasetsLabel: string;
  noTargetsTitle: string;
  noTargetsDescription: string;
  goToImporter: string;
  missingTargetTitle: string;
  missingTargetDescription: string;
  reimportInImporter: string;
  dependencyProjectsTitle: string;
  dependencyProjectsDescription: string;
  noDependenciesTitle: string;
  noDependenciesDescription: string;
  noDatasetsTitle: string;
  noDatasetsDescription: string;
  projectPrefix: string;
  unknownProject: string;
  exportProjectButton: string;
  createDatasetDialogTitle: string;
  createDatasetDialogDescription: string;
  projectLabel: string;
  selectProject: string;
  chooseProjectHint: string;
  datasetNameLabel: string;
  datasetNamePlaceholder: string;
  createDatasetHint: string;
  cancel: string;
  createDatasetConfirm: string;
  importDatasetDialogTitle: string;
  importDatasetDialogDescription: string;
  datasetFileLabel: string;
  uploadDatasetFileLabel: string;
  uploadDatasetHelper: string;
  uploadDatasetHint: string;
  chooseFile: string;
  pasteJson: string;
  clipboardHint: string;
  clipboardFilename: string;
  selectedPrefix: string;
  clear: string;
  datasetFileSupportHint: string;
  fallbackNameLabel: string;
  fallbackNameHint: string;
  importDatasetConfirm: string;
  exportProjectDialogTitle: string;
  exportProjectDialogDescription: string;
  scopeProjectDependencies: string;
  scopeDatasetOnly: string;
  scopeNoDatasetHelper: string;
  exportDatasetConfirm: string;
  exportProjectConfirm: string;
  settingsTitle: string;
  settingsDescription: string;
  settingsDeleteInfo: string;
  terminologyServerLabel: string;
  terminologyServerHint: string;
  close: string;
  deleteAllLocalData: string;
  thisProject: string;
  importedPackagesTitle: string;
  importedPackagesDescription: string;
  openInProjectEditor: string;
  newProject: string;
  duplicateProjectAction: string;
  projectSourceAuthored: string;
  projectSourceImported: string;
  projectsSectionDescription: string;
  projectDuplicated: string;
};

export type OverviewText = OverviewTextBase;

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
    datasetsSectionDescription: "Erstelle Datasets für dieses Projekt und öffne sie im Editor.",
    dependencyCountLabel: "{count} Abhängigkeiten",
    datasetsWithCount: "Datasets ({count})",
    newDataset: "Neu",
    datasetsEmptyHint: "Noch keine Datasets. Erstelle eines, um Ressourcen zu bearbeiten.",
    dependencyPackagesCount: "Abhängigkeitspakete ({count})",
    graphTitle: "Abhängigkeitsgraph",
    graphNodeTarget: "Ziel",
    graphNodeResolved: "Importiert",
    graphNodeMissing: "Fehlt",
    graphEmpty: "Keine Abhängigkeiten.",
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
    datasetActionsBlockedUntilImportComplete: "Dataset-Aktionen sind erst nach abgeschlossenem Import verfügbar.",
    chooseDatasetFile: "Wähle eine Dataset-Datei zum Importieren aus.",
    zipNoJson: "ZIP enthält keine JSON-Dataset-Datei.",
    datasetNameMissingImport: "Dataset-Name fehlt in der Importdatei.",
    datasetImported: "Dataset importiert.",
    datasetImportFailed: "Dataset-Datei konnte nicht importiert werden.",
    confirmDeleteDataset: 'Dataset "{name}" löschen? Diese Aktion kann nicht rückgängig gemacht werden.',
    datasetDeleted: "Dataset gelöscht.",
    projectRequiredByOthers: "Dieses Projekt wird von anderen Projekten benötigt.",
    confirmDeleteProject: 'Projekt "{project}" löschen? Dabei werden gespeicherte Ressourcen entfernt.',
    projectDeleted: "Projekt gelöscht.",
    datasetExported: "Dataset exportiert.",
    noPackagesToExport: "Keine Pakete für den Export verfügbar.",
    projectExported: "Projekt exportiert.",
    noDatasetSelected: "Kein Dataset ausgewählt.",
    cannotDeleteUsedBy: "Löschen nicht möglich, solange verwendet von {projects}.",
    confirmDeleteAllData:
      "Alle lokal gespeicherten Daten löschen? Dabei werden importierte Projekte, Ressourcen und Datasets entfernt.",
    localDataCleared: "Lokale Daten gelöscht.",
    failedClearLocalData: "Lokale Daten konnten nicht gelöscht werden. Bitte erneut versuchen.",
    editorEyebrow: "Editor",
    pageTitle: "Projektübersicht",
    refresh: "Aktualisieren",
    pageDescription:
      "Prüfe importierte Zielpakete, inspiziere Abhängigkeiten und starte Datasets. Öffne ein Dataset, um Ressourcen mit profilbasierten Formularen zu erstellen.",
    projectsOverviewTitle: "Projektübersicht",
    datasetsOverviewTitle: "Datasetübersicht",
    projectsOverviewDescription: "Prüfe importierte Zielprojekte und deren Abhängigkeiten.",
    datasetsOverviewDescription: "Verwalte Datasets und sieh, zu welchem Projekt sie gehören.",
    importProject: "Projekt importieren",
    createDataset: "Dataset erstellen",
    settingsAria: "Einstellungen",
    filterPlaceholder: "Filtern",
    projectViewAria: "Projektansicht",
    datasetViewAria: "Datasetansicht",
    viewProjectsLabel: "Projekte",
    viewDatasetsLabel: "Datasets",
    noTargetsTitle: "Noch keine Ziele",
    noTargetsDescription: "Importiere ein Zielpaket, um Datasets und Abhängigkeiten aufzubauen.",
    goToImporter: "Zum Importer",
    missingTargetTitle: "Fehlendes Zielpaket",
    missingTargetDescription: "{targetKey} ist in der Historie, aber nicht mehr im Speicher verfügbar.",
    reimportInImporter: "Im Importer erneut importieren",
    dependencyProjectsTitle: "Abhängigkeitsprojekte",
    dependencyProjectsDescription: "Pakete, die zur Erfüllung von Zielabhängigkeiten importiert wurden.",
    noDependenciesTitle: "Keine Abhängigkeiten sichtbar",
    noDependenciesDescription: "Importiere ein Ziel mit Abhängigkeiten oder entferne den Filter.",
    noDatasetsTitle: "Keine Datasets sichtbar",
    noDatasetsDescription: "Erstelle oder importiere Datasets über eine Projektkarte, um diese Ansicht zu füllen.",
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
    createDatasetHint: "Nutze dies, wenn du ein komplett neues Dataset anlegen willst.",
    cancel: "Abbrechen",
    createDatasetConfirm: "Dataset erstellen",
    importDatasetDialogTitle: "Dataset importieren",
    importDatasetDialogDescription: "Importiere ein Dataset-JSON für {project}.",
    datasetFileLabel: "Dataset-Datei (.json/.zip)",
    uploadDatasetFileLabel: "Dataset-Datei hochladen",
    uploadDatasetHelper: "Du kannst Dateien hier hineinziehen oder JSON aus der Zwischenablage einfügen.",
    uploadDatasetHint: ".json oder .zip hierher ziehen",
    chooseFile: "Datei auswählen",
    pasteJson: "JSON einfügen",
    clipboardHint: "Nutze den Button oder fokussiere dieses Feld und drücke Ctrl/Cmd+V.",
    clipboardFilename: "dataset-aus-zwischenablage.json",
    selectedPrefix: "Ausgewählt:",
    clear: "Leeren",
    datasetFileSupportHint:
      "Unterstützt JSON/ZIP Dataset-Exports, Ressourcenlisten oder FHIR Searchset Bundles.",
    fallbackNameLabel: "Fallback-Name (optional)",
    fallbackNameHint: "Wird nur genutzt, wenn die Importdatei keinen Namen enthält.",
    importDatasetConfirm: "Dataset importieren",
    exportProjectDialogTitle: "Projekt exportieren",
    exportProjectDialogDescription: "Exportiere {project} oder eines seiner Datasets.",
    scopeProjectDependencies: "Projekt + Abhängigkeiten",
    scopeDatasetOnly: "Nur Dataset",
    scopeNoDatasetHelper: "Keine Datasets für dieses Projekt verfügbar.",
    exportDatasetConfirm: "Dataset exportieren",
    exportProjectConfirm: "Projekt exportieren",
    settingsTitle: "Einstellungen",
    settingsDescription: "Verwalte lokal gespeicherte Daten für diesen Browser.",
    settingsDeleteInfo:
      "Beim Löschen werden importierte Pakete, Abhängigkeitsmetadaten, gecachte Ressourcen und alle Datasets in diesem Browser entfernt.",
    terminologyServerLabel: "Terminologie-Server (optional)",
    terminologyServerHint:
      "FHIR-Basis-URL für $expand, z. B. https://tx.fhir.org/r4. Wird nur genutzt, wenn ein ValueSet lokal nicht auflösbar ist.",
    close: "Schließen",
    deleteAllLocalData: "Alle lokalen Daten löschen",
    thisProject: "dieses Projekt",
    importedPackagesTitle: "Importierte Pakete",
    importedPackagesDescription:
      "Von anderen Autoren importierte FHIR-Pakete. Im Projekt-Editor ansehen oder als eigenes Projekt duplizieren.",
    openInProjectEditor: "Im Projekt-Editor öffnen",
    newProject: "Neues Projekt",
    duplicateProjectAction: "Duplizieren",
    projectSourceAuthored: "Eigen",
    projectSourceImported: "Importiert",
    projectsSectionDescription:
      "Eigene und importierte FHIR-Projekte. Lege Datasets an, um Ressourcen zu bearbeiten.",
    projectDuplicated: "Projekt dupliziert.",
  },
  en: {
    pageBrowserTitle: "Projects",
    datasetSuffix: "dataset",
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
    datasetsSectionDescription: "Create datasets for this project and open them in the editor.",
    dependencyCountLabel: "{count} dependencies",
    datasetsWithCount: "Datasets ({count})",
    newDataset: "New",
    datasetsEmptyHint: "No datasets yet. Create one to start editing resources.",
    dependencyPackagesCount: "Dependency packages ({count})",
    graphTitle: "Dependency graph",
    graphNodeTarget: "Target",
    graphNodeResolved: "Imported",
    graphNodeMissing: "Missing",
    graphEmpty: "No dependencies.",
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
    datasetActionsBlockedUntilImportComplete: "Dataset actions are available after the import is complete.",
    chooseDatasetFile: "Choose a dataset file to import.",
    zipNoJson: "ZIP does not contain a JSON dataset file.",
    datasetNameMissingImport: "Dataset name is missing in the import file.",
    datasetImported: "Dataset imported.",
    datasetImportFailed: "Failed to import dataset file.",
    confirmDeleteDataset: 'Delete dataset "{name}"? This cannot be undone.',
    datasetDeleted: "Dataset deleted.",
    projectRequiredByOthers: "This project is required by other projects.",
    confirmDeleteProject: 'Delete project "{project}"? This removes stored resources.',
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
    projectsOverviewDescription: "Review imported target projects and their dependencies.",
    datasetsOverviewDescription: "Manage datasets and see which project they belong to.",
    importProject: "Import Project",
    createDataset: "Create dataset",
    settingsAria: "Settings",
    filterPlaceholder: "Filter",
    projectViewAria: "Project view",
    datasetViewAria: "Dataset view",
    viewProjectsLabel: "Projects",
    viewDatasetsLabel: "Datasets",
    noTargetsTitle: "No targets yet",
    noTargetsDescription: "Import a target package to start building datasets and dependencies.",
    goToImporter: "Go to Importer",
    missingTargetTitle: "Missing target package",
    missingTargetDescription: "{targetKey} is in history but no longer available in storage.",
    reimportInImporter: "Re-import in Importer",
    dependencyProjectsTitle: "Dependency Projects",
    dependencyProjectsDescription: "Packages pulled in to satisfy target dependencies.",
    noDependenciesTitle: "No dependencies to show",
    noDependenciesDescription: "Import a target with dependencies or clear the filter to see more.",
    noDatasetsTitle: "No datasets to show",
    noDatasetsDescription: "Create or import datasets from a project card to populate this view.",
    projectPrefix: "Project:",
    unknownProject: "Unknown",
    exportProjectButton: "Export project",
    createDatasetDialogTitle: "Create dataset",
    createDatasetDialogDescription: "Create a dataset shell for {project} and start composing resources.",
    projectLabel: "Project",
    selectProject: "Select project",
    chooseProjectHint: "Choose the project this dataset belongs to.",
    datasetNameLabel: "Dataset name",
    datasetNamePlaceholder: "Project dataset",
    createDatasetHint: "Use this when you want to create a brand new dataset.",
    cancel: "Cancel",
    createDatasetConfirm: "Create dataset",
    importDatasetDialogTitle: "Import dataset",
    importDatasetDialogDescription: "Import a dataset JSON for {project}.",
    datasetFileLabel: "Dataset file (.json/.zip)",
    uploadDatasetFileLabel: "Upload dataset file",
    uploadDatasetHelper: "You can drag files here or paste JSON from your clipboard.",
    uploadDatasetHint: "Drag & drop .json or .zip here",
    chooseFile: "Choose file",
    pasteJson: "Paste JSON",
    clipboardHint: "Use the button or focus this box and press Ctrl/Cmd+V.",
    clipboardFilename: "dataset-from-clipboard.json",
    selectedPrefix: "Selected:",
    clear: "Clear",
    datasetFileSupportHint: "Supports JSON/ZIP dataset exports, resource lists, or FHIR searchset bundles.",
    fallbackNameLabel: "Fallback name (optional)",
    fallbackNameHint: "Used only if the import file does not include a name.",
    importDatasetConfirm: "Import dataset",
    exportProjectDialogTitle: "Export project",
    exportProjectDialogDescription: "Export {project} or one of its datasets.",
    scopeProjectDependencies: "Project + dependencies",
    scopeDatasetOnly: "Dataset only",
    scopeNoDatasetHelper: "No datasets available for this project.",
    exportDatasetConfirm: "Export dataset",
    exportProjectConfirm: "Export project",
    settingsTitle: "Settings",
    settingsDescription: "Manage locally stored data for this browser.",
    settingsDeleteInfo:
      "Deleting data removes imported packages, dependency metadata, cached resources, and all datasets saved in this browser.",
    terminologyServerLabel: "Terminology server (optional)",
    terminologyServerHint:
      "FHIR base URL used for $expand, e.g. https://tx.fhir.org/r4. Only queried when a ValueSet cannot be resolved locally.",
    close: "Close",
    deleteAllLocalData: "Delete all local data",
    thisProject: "this project",
    importedPackagesTitle: "Imported packages",
    importedPackagesDescription:
      "FHIR packages imported from other authors. View them in the project editor or duplicate one into your own project.",
    openInProjectEditor: "Open in project editor",
    newProject: "New project",
    duplicateProjectAction: "Duplicate",
    projectSourceAuthored: "Authored",
    projectSourceImported: "Imported",
    projectsSectionDescription:
      "Your own and imported FHIR projects. Create datasets to author resources.",
    projectDuplicated: "Project duplicated.",
  },
} satisfies Record<"de" | "en", OverviewText>;

export const localizedOverviewText = {
  ...overviewText,
  fr: {
    ...overviewText.en,
    pageBrowserTitle: "Projets",
    pageTitle: "Vue d'ensemble des projets",
    pageDescription:
      "Consultez les paquets cibles importes, examinez les dependances et demarrez des datasets. Ouvrez un dataset pour composer des ressources avec des formulaires guides par profil.",
    projectsOverviewTitle: "Vue d'ensemble des projets",
    datasetsOverviewTitle: "Vue d'ensemble des datasets",
    projectsOverviewDescription: "Consultez les projets cibles importes et leurs dependances.",
    datasetsOverviewDescription: "Gerez les datasets et voyez a quel projet ils appartiennent.",
    importProject: "Importer un projet",
    createDataset: "Creer un dataset",
    refresh: "Actualiser",
    filterPlaceholder: "Filtrer",
    projectViewAria: "Vue projet",
    datasetViewAria: "Vue dataset",
    noTargetsTitle: "Aucune cible pour le moment",
    noTargetsDescription: "Importez un paquet cible pour commencer a construire des datasets et des dependances.",
    goToImporter: "Aller a l'importateur",
    dependencyProjectsTitle: "Projets de dependance",
    dependencyProjectsDescription: "Paquets importes pour satisfaire les dependances des cibles.",
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
    projectsOverviewDescription: "Revisa los proyectos objetivo importados y sus dependencias.",
    datasetsOverviewDescription: "Gestiona datasets y ve a que proyecto pertenecen.",
    importProject: "Importar proyecto",
    createDataset: "Crear dataset",
    refresh: "Actualizar",
    filterPlaceholder: "Filtrar",
    projectViewAria: "Vista de proyectos",
    datasetViewAria: "Vista de datasets",
    noTargetsTitle: "Sin objetivos todavia",
    noTargetsDescription: "Importa un paquete objetivo para empezar a crear datasets y dependencias.",
    goToImporter: "Ir al importador",
    dependencyProjectsTitle: "Proyectos de dependencia",
    dependencyProjectsDescription: "Paquetes importados para cumplir dependencias del objetivo.",
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
    projectsOverviewDescription: "Controlla i progetti target importati e le loro dipendenze.",
    datasetsOverviewDescription: "Gestisci i dataset e vedi a quale progetto appartengono.",
    importProject: "Importa progetto",
    createDataset: "Crea dataset",
    refresh: "Aggiorna",
    filterPlaceholder: "Filtra",
    projectViewAria: "Vista progetti",
    datasetViewAria: "Vista dataset",
    noTargetsTitle: "Nessun target per ora",
    noTargetsDescription: "Importa un pacchetto target per iniziare a creare dataset e dipendenze.",
    goToImporter: "Vai all'importatore",
    dependencyProjectsTitle: "Progetti dipendenza",
    dependencyProjectsDescription: "Pacchetti importati per soddisfare le dipendenze del target.",
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

