import type { Locale } from "@/lib/i18n/types";

const enText = {
  // Overview section
  sectionTitle: "My projects",
  sectionDescription:
    "Author your own FHIR projects: manifest, dependencies and conformance resources.",
  newProject: "New project",
  noProjectsYet: "No authored projects yet. Create one to get started.",
  open: "Open",
  updatedPrefix: "Updated:",
  authoredBadge: "Authored",
  deleteProject: "Delete project",
  deleteProjectConfirm: "Delete this project and all of its authored resources?",
  projectDeleted: "Project deleted.",
  resourcesCount: "{count} resources",
  duplicate: "Duplicate",
  duplicateDialogTitle: "Duplicate project",
  duplicateDialogDescription:
    "Create an editable copy under a new package name and version.",
  duplicated: "Project duplicated.",
  copySuffix: "-copy",

  // Read-only imported mode
  readOnlyBanner:
    "Imported project — read-only. Duplicate it to make your own editable copy.",
  duplicateToEditable: "Duplicate to editable project",
  readOnlyBadge: "Read-only",

  // New project dialog
  dialogTitle: "New FHIR project",
  dialogDescription: "Define the package manifest and pick dependencies.",
  nameLabel: "Package name",
  namePlaceholder: "my.organization.project",
  nameHint: "Lowercase, dot-separated package id (e.g. de.example.project).",
  versionLabel: "Version",
  versionPlaceholder: "0.1.0",
  titleLabel: "Title",
  titlePlaceholder: "My Project",
  descriptionLabel: "Description",
  authorLabel: "Author",
  canonicalLabel: "Canonical URL",
  canonicalPlaceholder: "https://example.org/fhir",
  canonicalHint: "Base URL used to derive canonical urls for your resources.",
  fhirVersionLabel: "FHIR version",
  jurisdictionLabel: "Jurisdiction",
  dependenciesLabel: "Dependencies",
  dependenciesHint: "Select imported packages this project builds on.",
  noPackagesImported: "No packages imported yet.",
  coreMissingWarning:
    "hl7.fhir.r4.core is not imported. Import it first so profiles and value sets can be authored and validated.",
  goToImporter: "Go to importer",
  nameRequired: "Package name is required.",
  versionRequired: "Version is required.",
  duplicateProject: "A project with this name and version already exists.",
  cancel: "Cancel",
  create: "Create project",

  // Editor shell
  editorEyebrow: "Project editor",
  backToOverview: "Overview",
  saved: "Saved",
  saving: "Saving…",
  projectNotFoundTitle: "Project not found",
  projectNotFoundDescription:
    "The project key could not be resolved. Return to the overview.",
  exportProject: "Export project",
  projectExported: "Project exported.",
  showDependencyGraph: "Dependency graph",

  // Explorer sections
  explorerTitle: "Project structure",
  nodeManifest: "Manifest",
  nodeDependencies: "Dependencies",
  sectionProfiles: "Profiles",
  sectionExtensions: "Extensions",
  sectionValueSets: "ValueSets",
  sectionCodeSystems: "CodeSystems",
  sectionExamples: "Examples",
  sectionDatasets: "Datasets",
  newDataset: "New dataset",
  newDatasetPrompt: "Name for the new dataset:",
  addResource: "Add",
  emptySection: "None yet",
  removeResource: "Remove",
  removeResourceConfirm: "Remove this resource from the project?",

  // Manifest editor
  manifestTitle: "Manifest",
  manifestDescription: "Metadata that describes your FHIR package.",
  manifestNameReadonlyHint:
    "Name and version form the project key and are read-only after creation.",

  // Dependency manager
  dependencyTitle: "Dependencies",
  dependencyDescription:
    "Manage the imported packages this project depends on.",
  addDependency: "Add dependency",
  selectPackage: "Select a package…",
  removeDependency: "Remove",
  noDependencies: "No dependencies yet.",
  dependencyConflictHint: "Conflicts are resolved by the importer graph.",

  // New conformance dialog
  newConformanceTitle: "New building block",
  newConformanceDescription: "Pick what kind of resource to author.",
  kindLabel: "Kind",
  kindProfile: "Profile (StructureDefinition)",
  kindExtension: "Extension",
  kindValueSet: "ValueSet",
  kindCodeSystem: "CodeSystem",
  kindExample: "Example instance",
  resourceNameLabel: "Name",
  resourceNamePlaceholder: "MyResource",
  exampleTypeLabel: "Resource type",
  exampleTypePlaceholder: "Patient",
  exampleProfileLabel: "Profile (optional)",
  createBlock: "Create",

  // Dashboard / navigation
  nodeDashboard: "Overview",
  nodeIssues: "Issues",
  dashboardTitle: "Overview",
  noCanonical: "No canonical URL set",
  emptyProjectTitle: "Your project is empty",
  emptyProjectHint:
    "Start by adding a profile or value set — or import a base package to build on.",
  ctaFirstProfile: "Add first profile",
  importBasePackage: "Import base package",
  showRelationships: "Relationships",
  health: "Health",
  noIssues: "No consistency issues found.",
  errors: "errors",
  warnings: "warnings",
  viewIssues: "view",
  issuesTitle: "Consistency checks",

  // Detail view switch
  viewConstraints: "Constraints",
  viewForm: "Form",
  viewJson: "JSON",

  // Constraints editor
  constraintsOn: "Constraints on",
  noBaseDefinition: "No base definition",
  baseNotResolved:
    "Base type not resolvable — import the dependency that defines it (e.g. hl7.fhir.r4.core).",
  constraintsBadge: "constraints",
  cardMin: "min",
  cardMax: "max",
  mustSupport: "Must-support",
  bindingNone: "No binding",
  usedBy: "Used by",

  // Relationship map
  mapTitle: "Project relationships",
  mapEmpty: "No building blocks to show yet.",
  edgeDerives: "derives from",
  edgeConforms: "conforms to",
  edgeBinds: "binds",
  edgeIncludes: "includes",
  edgeExtends: "uses extension",
};

export type ProjectEditorText = typeof enText;

const deText: ProjectEditorText = {
  sectionTitle: "Meine Projekte",
  sectionDescription:
    "Eigene FHIR-Projekte anlegen: Manifest, Abhängigkeiten und Konformanz-Ressourcen.",
  newProject: "Neues Projekt",
  noProjectsYet: "Noch keine eigenen Projekte. Lege eines an, um zu starten.",
  open: "Öffnen",
  updatedPrefix: "Aktualisiert:",
  authoredBadge: "Eigen",
  deleteProject: "Projekt löschen",
  deleteProjectConfirm:
    "Dieses Projekt und alle eigenen Ressourcen wirklich löschen?",
  projectDeleted: "Projekt gelöscht.",
  resourcesCount: "{count} Ressourcen",
  duplicate: "Duplizieren",
  duplicateDialogTitle: "Projekt duplizieren",
  duplicateDialogDescription:
    "Erstelle eine editierbare Kopie unter neuem Paketnamen und neuer Version.",
  duplicated: "Projekt dupliziert.",
  copySuffix: "-kopie",

  readOnlyBanner:
    "Importiertes Projekt — schreibgeschützt. Dupliziere es, um eine eigene, editierbare Kopie zu erhalten.",
  duplicateToEditable: "Als eigenes Projekt duplizieren",
  readOnlyBadge: "Schreibgeschützt",

  dialogTitle: "Neues FHIR-Projekt",
  dialogDescription: "Paket-Manifest definieren und Abhängigkeiten wählen.",
  nameLabel: "Paketname",
  namePlaceholder: "meine.organisation.projekt",
  nameHint: "Kleinbuchstaben, punktgetrennte Paket-ID (z. B. de.example.projekt).",
  versionLabel: "Version",
  versionPlaceholder: "0.1.0",
  titleLabel: "Titel",
  titlePlaceholder: "Mein Projekt",
  descriptionLabel: "Beschreibung",
  authorLabel: "Autor",
  canonicalLabel: "Canonical-URL",
  canonicalPlaceholder: "https://example.org/fhir",
  canonicalHint: "Basis-URL zur Ableitung der Canonical-URLs deiner Ressourcen.",
  fhirVersionLabel: "FHIR-Version",
  jurisdictionLabel: "Jurisdiktion",
  dependenciesLabel: "Abhängigkeiten",
  dependenciesHint: "Wähle importierte Pakete, auf denen dieses Projekt aufbaut.",
  noPackagesImported: "Noch keine Pakete importiert.",
  coreMissingWarning:
    "hl7.fhir.r4.core ist nicht importiert. Importiere es zuerst, damit Profile und ValueSets autoriert und validiert werden können.",
  goToImporter: "Zum Importer",
  nameRequired: "Paketname ist erforderlich.",
  versionRequired: "Version ist erforderlich.",
  duplicateProject: "Ein Projekt mit diesem Namen und dieser Version existiert bereits.",
  cancel: "Abbrechen",
  create: "Projekt anlegen",

  editorEyebrow: "Projekt-Editor",
  backToOverview: "Übersicht",
  saved: "Gespeichert",
  saving: "Speichern…",
  projectNotFoundTitle: "Projekt nicht gefunden",
  projectNotFoundDescription:
    "Der Projekt-Key konnte nicht aufgelöst werden. Gehe zurück zur Übersicht.",
  exportProject: "Projekt exportieren",
  projectExported: "Projekt exportiert.",
  showDependencyGraph: "Abhängigkeitsgraph",

  explorerTitle: "Projektstruktur",
  nodeManifest: "Manifest",
  nodeDependencies: "Abhängigkeiten",
  sectionProfiles: "Profile",
  sectionExtensions: "Extensions",
  sectionValueSets: "ValueSets",
  sectionCodeSystems: "CodeSystems",
  sectionExamples: "Beispiele",
  sectionDatasets: "Datasets",
  newDataset: "Neues Dataset",
  newDatasetPrompt: "Name für das neue Dataset:",
  addResource: "Hinzufügen",
  emptySection: "Noch keine",
  removeResource: "Entfernen",
  removeResourceConfirm: "Diese Ressource wirklich aus dem Projekt entfernen?",

  manifestTitle: "Manifest",
  manifestDescription: "Metadaten, die dein FHIR-Paket beschreiben.",
  manifestNameReadonlyHint:
    "Name und Version bilden den Projekt-Key und sind nach dem Anlegen schreibgeschützt.",

  dependencyTitle: "Abhängigkeiten",
  dependencyDescription:
    "Verwalte die importierten Pakete, von denen dieses Projekt abhängt.",
  addDependency: "Abhängigkeit hinzufügen",
  selectPackage: "Paket wählen…",
  removeDependency: "Entfernen",
  noDependencies: "Noch keine Abhängigkeiten.",
  dependencyConflictHint: "Konflikte werden über den Importer-Graphen aufgelöst.",

  newConformanceTitle: "Neuer Baustein",
  newConformanceDescription: "Wähle, welche Art von Ressource autoriert werden soll.",
  kindLabel: "Art",
  kindProfile: "Profil (StructureDefinition)",
  kindExtension: "Extension",
  kindValueSet: "ValueSet",
  kindCodeSystem: "CodeSystem",
  kindExample: "Beispiel-Instanz",
  resourceNameLabel: "Name",
  resourceNamePlaceholder: "MeineRessource",
  exampleTypeLabel: "Ressourcentyp",
  exampleTypePlaceholder: "Patient",
  exampleProfileLabel: "Profil (optional)",
  createBlock: "Anlegen",

  nodeDashboard: "Übersicht",
  nodeIssues: "Issues",
  dashboardTitle: "Übersicht",
  noCanonical: "Keine Canonical-URL gesetzt",
  emptyProjectTitle: "Dein Projekt ist leer",
  emptyProjectHint:
    "Beginne mit einem Profil oder ValueSet — oder importiere ein Basis-Paket als Grundlage.",
  ctaFirstProfile: "Erstes Profil anlegen",
  importBasePackage: "Basis-Paket importieren",
  showRelationships: "Beziehungen",
  health: "Zustand",
  noIssues: "Keine Konsistenzprobleme gefunden.",
  errors: "Fehler",
  warnings: "Warnungen",
  viewIssues: "anzeigen",
  issuesTitle: "Konsistenz-Prüfungen",

  viewConstraints: "Constraints",
  viewForm: "Formular",
  viewJson: "JSON",

  constraintsOn: "Constraints auf",
  noBaseDefinition: "Keine Basisdefinition",
  baseNotResolved:
    "Basistyp nicht auflösbar — importiere die Dependency, die ihn definiert (z. B. hl7.fhir.r4.core).",
  constraintsBadge: "Constraints",
  cardMin: "min",
  cardMax: "max",
  mustSupport: "Must-Support",
  bindingNone: "Kein Binding",
  usedBy: "Verwendet von",

  mapTitle: "Projekt-Beziehungen",
  mapEmpty: "Noch keine Bausteine vorhanden.",
  edgeDerives: "leitet ab von",
  edgeConforms: "konform zu",
  edgeBinds: "Binding",
  edgeIncludes: "enthält",
  edgeExtends: "nutzt Extension",
};

type Dictionary = Partial<Record<Locale, ProjectEditorText>> & { en: ProjectEditorText };

export const projectEditorText: Dictionary = {
  en: enText,
  de: deText,
  fr: { ...enText },
  es: { ...enText },
  it: { ...enText },
};
