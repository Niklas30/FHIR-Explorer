"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { useI18n } from "@/components/i18n/I18nProvider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FileDropzone } from "@/components/ui/file-dropzone";
import { useImporter } from "@/components/importer/useImporter";
import type { DependencyRequirement } from "@/lib/fhir-importer/types";
import {
  isComposeProjectArchive,
  isComposeProjectExport,
  type ComposeDatasetExport,
  type ComposePackageExport,
  type ComposeProjectExport,
} from "@/lib/fhir-importer/compose";
import { upsertDataset, type DatasetRecord } from "@/lib/datasets/storage";
import { hydrateDatasetResources, saveDatasetResources } from "@/lib/datasets/content";
import { toast } from "sonner";
import JSZip from "jszip";
import { byLocale } from "@/lib/i18n/select";

const formatRequirement = (dependency: DependencyRequirement) => {
  if (dependency.exactVersion) {
    return dependency.exactVersion;
  }
  if (dependency.ranges.length === 1) {
    return dependency.ranges[0];
  }
  return dependency.ranges.join(", ");
};

export const ImportWizard = () => {
  const { locale } = useI18n();
  const {
    snapshot,
    progress,
    error,
    lastResult,
    setTarget,
    clearTarget,
    finalizeTarget,
    setVersionSelection,
    clearVersionSelection,
    importFile,
    importTargetFile,
    importComposeProject,
    addImportHistory,
    getDownloadUrl,
  } = useImporter();

  const searchParams = useSearchParams();
  const [packageId, setPackageId] = useState("");
  const [version, setVersion] = useState("");
  const [versionDrafts, setVersionDrafts] = useState<Record<string, string>>({});
  const [uploadNotice, setUploadNotice] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [importLog, setImportLog] = useState<string[]>([]);
  const [completedSummary, setCompletedSummary] = useState<{
    targetKey: string;
    log: string[];
  } | null>(null);
  const lastNoticeRef = useRef<string | null>(null);
  const lastResultRef = useRef<string | null>(null);
  const progressToastId = useRef<string>("import-progress");
  const completionHandledRef = useRef<string | null>(null);
  const enText = {
    none: "None",
    failedComposeProjectImport: "Failed to import compose project file.",
    composeProjectImported:
      "Compose project imported ({imported} packages, {skipped} skipped).",
    packageAlreadyImported: "Package {packageKey} is already imported.",
    targetPackageImported: "Target package {packageKey} imported.",
    dependencyImported: "Dependency {packageKey} imported.",
    packageImportedButNotMissing:
      "Package {packageKey} imported, but it was not listed as missing.",
    targetPackageAlreadyImported: "Target package {packageKey} is already imported.",
    importingPackage: "Importing package",
    packageAlreadyImportedShort: "Package {packageKey} already imported.",
    importedPackageShort: "Imported {packageKey}.",
    errorPrefix: "Error: {error}",
    title: "Package Import",
    importer: "FHIR Importer",
    cancelImport: "Cancel Import",
    projectsOverview: "Projects Overview",
    home: "Home",
    intro:
      "Import FHIR packages and every transitive dependency entirely in the browser. The wizard updates after each upload.",
    imported: "Imported: {count}",
    missing: "Missing: {count}",
    definitions: "Definitions: {count}",
    target: "Target: {value}",
    importSuccessful: "Import Successful",
    importSuccessfulDescription:
      "{targetKey} was imported successfully. You can start a new import below or go to the Projects Overview.",
    goToProjectsOverview: "Go to Projects Overview",
    targetImported: "Target imported: {value}",
    targetPackage: "Target Package",
    targetSetDescription:
      "Target set. Download the package and upload it to start the import.",
    targetUploadOrEnter:
      "Upload the target package directly or enter id + version.",
    importStartedFor: "Import started for:",
    downloadPackages: "Download (packages2.fhir.org)",
    copyLink: "Copy Link",
    uploadTargetPackage: "Upload target package (.tgz)",
    uploadTargetHelper:
      "Download the target from packages2.fhir.org, then upload it here to start the import.",
    uploadTargetHint: "Drag & drop the target .tgz file here",
    uploadTargetOrCompose:
      "Upload target package (.tgz) or compose project (.json/.zip)",
    uploadTargetOrComposeHelper:
      "The package must contain package/package.json",
    uploadTargetOrComposeHint: "Drag & drop .tgz, .json, or .zip files here",
    packageId: "Package ID",
    version: "Version",
    setTarget: "Set Target",
    dependencies: "Dependencies",
    dependenciesDescription:
      "Upload any missing dependency in any order. You can start multiple downloads at once.",
    uploadTargetToDetect:
      "Upload the target package to detect its dependencies.",
    allDependenciesResolved: "All dependencies resolved.",
    required: "Required: {value}",
    chooseVersion: "Choose version",
    setVersion: "Set Version",
    clear: "Clear",
    download: "Download:",
    selectVersionForLink: "Select a version to generate a link",
    openLink: "Open Link",
    uploadPackageOrCompose:
      "Upload package (.tgz) or compose project (.json/.zip)",
    uploadPackageOrComposeHelper:
      "Upload target or dependency packages. The importer will detect matches.",
    uploadPackageOrComposeHint: "Drag & drop .tgz, .json, or .zip files here",
    importHistory: "Import History",
    importHistoryDescription: "Previously imported target packages.",
    noImportsYet: "No imports yet.",
    importLog: "Import Log",
    latestImportActions: "Latest actions during this import.",
    importLogHistory: "History of the last completed import.",
    showLog: "Show log ({count})",
    noLogEntries: "No log entries yet.",
    conflicts: "Conflicts",
    conflictsDescription: "Resolve these before the import is complete.",
    versionConflict: "Version conflict",
  };
  const text = byLocale(locale, {
    de: {
      none: "Keine",
      failedComposeProjectImport: "Import der Compose-Projektdatei fehlgeschlagen.",
      composeProjectImported: "Compose-Projekt importiert ({imported} Pakete, {skipped} übersprungen).",
      packageAlreadyImported: "Paket {packageKey} ist bereits importiert.",
      targetPackageImported: "Zielpaket {packageKey} importiert.",
      dependencyImported: "Abhängigkeit {packageKey} importiert.",
      packageImportedButNotMissing:
        "Paket {packageKey} importiert, war aber nicht als fehlend gelistet.",
      targetPackageAlreadyImported: "Zielpaket {packageKey} ist bereits importiert.",
      importingPackage: "Paket wird importiert",
      packageAlreadyImportedShort: "Paket {packageKey} bereits importiert.",
      importedPackageShort: "{packageKey} importiert.",
      errorPrefix: "Fehler: {error}",
      title: "Paket-Import",
      importer: "FHIR Importer",
      cancelImport: "Import abbrechen",
      projectsOverview: "Projektübersicht",
      home: "Startseite",
      intro:
        "Importiere FHIR-Pakete und alle transitiven Abhängigkeiten vollständig im Browser. Der Assistent aktualisiert sich nach jedem Upload.",
      imported: "Importiert: {count}",
      missing: "Fehlend: {count}",
      definitions: "Definitionen: {count}",
      target: "Ziel: {value}",
      importSuccessful: "Import erfolgreich",
      importSuccessfulDescription:
        "{targetKey} wurde erfolgreich importiert. Du kannst unten einen neuen Import starten oder zur Projektübersicht wechseln.",
      goToProjectsOverview: "Zur Projektübersicht",
      targetImported: "Ziel importiert: {value}",
      targetPackage: "Zielpaket",
      targetSetDescription:
        "Ziel ist gesetzt. Lade das Paket herunter und lade es hoch, um den Import zu starten.",
      targetUploadOrEnter:
        "Lade das Zielpaket direkt hoch oder gib ID + Version ein.",
      importStartedFor: "Import gestartet für:",
      downloadPackages: "Download (packages2.fhir.org)",
      copyLink: "Link kopieren",
      uploadTargetPackage: "Zielpaket hochladen (.tgz)",
      uploadTargetHelper:
        "Lade das Ziel von packages2.fhir.org herunter und lade es hier hoch, um den Import zu starten.",
      uploadTargetHint: "Ziehe die Ziel-.tgz-Datei hier hinein",
      uploadTargetOrCompose:
        "Zielpaket (.tgz) oder Compose-Projekt (.json/.zip) hochladen",
      uploadTargetOrComposeHelper:
        "Das Paket muss package/package.json enthalten",
      uploadTargetOrComposeHint: "Ziehe .tgz-, .json- oder .zip-Dateien hier hinein",
      packageId: "Paket-ID",
      version: "Version",
      setTarget: "Ziel setzen",
      dependencies: "Abhängigkeiten",
      dependenciesDescription:
        "Lade fehlende Abhängigkeiten in beliebiger Reihenfolge hoch. Du kannst mehrere Downloads gleichzeitig starten.",
      uploadTargetToDetect:
        "Lade das Zielpaket hoch, um dessen Abhängigkeiten zu erkennen.",
      allDependenciesResolved: "Alle Abhängigkeiten sind aufgelöst.",
      required: "Erforderlich: {value}",
      chooseVersion: "Version wählen",
      setVersion: "Version setzen",
      clear: "Leeren",
      download: "Download:",
      selectVersionForLink: "Wähle eine Version, um einen Link zu erzeugen",
      openLink: "Link öffnen",
      uploadPackageOrCompose:
        "Paket (.tgz) oder Compose-Projekt (.json/.zip) hochladen",
      uploadPackageOrComposeHelper:
        "Lade Ziel- oder Abhängigkeitspakete hoch. Der Importer erkennt passende Pakete automatisch.",
      uploadPackageOrComposeHint: "Ziehe .tgz-, .json- oder .zip-Dateien hier hinein",
      importHistory: "Import-Historie",
      importHistoryDescription: "Bisher importierte Zielpakete.",
      noImportsYet: "Noch keine Importe.",
      importLog: "Import-Log",
      latestImportActions: "Neueste Aktionen während dieses Imports.",
      importLogHistory: "Verlauf des letzten abgeschlossenen Imports.",
      showLog: "Log anzeigen ({count})",
      noLogEntries: "Noch keine Log-Einträge.",
      conflicts: "Konflikte",
      conflictsDescription:
        "Löse diese Konflikte, bevor der Import abgeschlossen ist.",
      versionConflict: "Versionskonflikt",
    },
    en: enText,
    fr: {
      ...enText,
      none: "Aucun",
      failedComposeProjectImport: "Echec de l'import du fichier projet compose.",
      composeProjectImported:
        "Projet compose importe ({imported} paquets, {skipped} ignores).",
      packageAlreadyImported: "Le paquet {packageKey} est deja importe.",
      targetPackageImported: "Paquet cible {packageKey} importe.",
      dependencyImported: "Dependance {packageKey} importee.",
      packageImportedButNotMissing:
        "Paquet {packageKey} importe, mais il n'etait pas marque manquant.",
      targetPackageAlreadyImported:
        "Le paquet cible {packageKey} est deja importe.",
      importingPackage: "Import du paquet",
      packageAlreadyImportedShort: "Paquet {packageKey} deja importe.",
      importedPackageShort: "{packageKey} importe.",
      errorPrefix: "Erreur: {error}",
      title: "Import de paquet",
      importer: "Importeur FHIR",
      cancelImport: "Annuler l'import",
      projectsOverview: "Vue d'ensemble des projets",
      home: "Accueil",
      intro:
        "Importez des paquets FHIR et toutes les dependances transitives dans le navigateur. L'assistant se met a jour apres chaque televersement.",
      imported: "Importes: {count}",
      missing: "Manquants: {count}",
      definitions: "Definitions: {count}",
      target: "Cible: {value}",
      importSuccessful: "Import reussi",
      importSuccessfulDescription:
        "{targetKey} a ete importe avec succes. Vous pouvez lancer un nouvel import ou revenir a la vue des projets.",
      goToProjectsOverview: "Aller a la vue des projets",
      targetImported: "Cible importee: {value}",
      targetPackage: "Paquet cible",
      targetSetDescription:
        "Cible definie. Telechargez le paquet puis televersez-le pour lancer l'import.",
      targetUploadOrEnter:
        "Televersez directement le paquet cible ou saisissez id + version.",
      importStartedFor: "Import demarre pour:",
      downloadPackages: "Telecharger (packages2.fhir.org)",
      uploadTargetPackage: "Televerser le paquet cible (.tgz)",
      uploadTargetHelper:
        "Telechargez la cible depuis packages2.fhir.org, puis televersez-la ici pour demarrer l'import.",
      uploadTargetHint: "Glisser-deposer le fichier .tgz cible ici",
      uploadTargetOrCompose:
        "Televerser le paquet cible (.tgz) ou un projet compose (.json/.zip)",
      uploadTargetOrComposeHelper:
        "Le paquet doit contenir package/package.json",
      uploadTargetOrComposeHint:
        "Glisser-deposer des fichiers .tgz, .json ou .zip ici",
      packageId: "ID du paquet",
      version: "Version",
      setTarget: "Definir la cible",
      dependencies: "Dependances",
      dependenciesDescription:
        "Televersez les dependances manquantes dans n'importe quel ordre. Vous pouvez lancer plusieurs telechargements en parallele.",
      uploadTargetToDetect:
        "Televersez le paquet cible pour detecter ses dependances.",
      allDependenciesResolved: "Toutes les dependances sont resolues.",
      required: "Requis: {value}",
      chooseVersion: "Choisir la version",
      setVersion: "Definir la version",
      clear: "Effacer",
      download: "Telecharger:",
      selectVersionForLink:
        "Selectionnez une version pour generer un lien",
      openLink: "Ouvrir le lien",
      uploadPackageOrCompose:
        "Televerser un paquet (.tgz) ou un projet compose (.json/.zip)",
      uploadPackageOrComposeHelper:
        "Televersez des paquets cibles ou de dependance. L'importeur detectera les correspondances.",
      uploadPackageOrComposeHint:
        "Glisser-deposer des fichiers .tgz, .json ou .zip ici",
      importHistory: "Historique d'import",
      importHistoryDescription: "Paquets cibles importes precedemment.",
      noImportsYet: "Aucun import pour le moment.",
      importLog: "Journal d'import",
      latestImportActions: "Dernieres actions pendant cet import.",
      importLogHistory: "Historique du dernier import termine.",
      showLog: "Afficher le journal ({count})",
      noLogEntries: "Aucune entree de journal.",
      conflicts: "Conflits",
      conflictsDescription:
        "Resolvez ces conflits avant la fin de l'import.",
      versionConflict: "Conflit de version",
      copyLink: "Copier le lien",
    },
    es: {
      ...enText,
      none: "Ninguno",
      failedComposeProjectImport:
        "Error al importar el archivo de proyecto compose.",
      composeProjectImported:
        "Proyecto compose importado ({imported} paquetes, {skipped} omitidos).",
      packageAlreadyImported: "El paquete {packageKey} ya esta importado.",
      targetPackageImported: "Paquete objetivo {packageKey} importado.",
      dependencyImported: "Dependencia {packageKey} importada.",
      packageImportedButNotMissing:
        "Paquete {packageKey} importado, pero no estaba marcado como faltante.",
      targetPackageAlreadyImported:
        "El paquete objetivo {packageKey} ya esta importado.",
      importingPackage: "Importando paquete",
      packageAlreadyImportedShort: "Paquete {packageKey} ya importado.",
      importedPackageShort: "{packageKey} importado.",
      errorPrefix: "Error: {error}",
      title: "Importacion de paquetes",
      importer: "Importador FHIR",
      cancelImport: "Cancelar importacion",
      projectsOverview: "Resumen de proyectos",
      home: "Inicio",
      intro:
        "Importa paquetes FHIR y todas las dependencias transitivas en el navegador. El asistente se actualiza tras cada carga.",
      imported: "Importados: {count}",
      missing: "Faltantes: {count}",
      definitions: "Definiciones: {count}",
      target: "Objetivo: {value}",
      importSuccessful: "Importacion correcta",
      importSuccessfulDescription:
        "{targetKey} se importo correctamente. Puedes iniciar una nueva importacion o volver al resumen de proyectos.",
      goToProjectsOverview: "Ir al resumen de proyectos",
      targetImported: "Objetivo importado: {value}",
      targetPackage: "Paquete objetivo",
      targetSetDescription:
        "Objetivo definido. Descarga el paquete y subelo para iniciar la importacion.",
      targetUploadOrEnter:
        "Sube el paquete objetivo directamente o introduce id + version.",
      importStartedFor: "Importacion iniciada para:",
      downloadPackages: "Descargar (packages2.fhir.org)",
      uploadTargetPackage: "Subir paquete objetivo (.tgz)",
      uploadTargetHelper:
        "Descarga el objetivo desde packages2.fhir.org y subelo aqui para iniciar la importacion.",
      uploadTargetHint: "Arrastra y suelta el archivo .tgz objetivo aqui",
      uploadTargetOrCompose:
        "Subir paquete objetivo (.tgz) o proyecto compose (.json/.zip)",
      uploadTargetOrComposeHelper:
        "El paquete debe contener package/package.json",
      uploadTargetOrComposeHint:
        "Arrastra y suelta archivos .tgz, .json o .zip aqui",
      packageId: "ID del paquete",
      version: "Version",
      setTarget: "Definir objetivo",
      dependencies: "Dependencias",
      dependenciesDescription:
        "Sube cualquier dependencia faltante en cualquier orden. Puedes iniciar varias descargas a la vez.",
      uploadTargetToDetect:
        "Sube el paquete objetivo para detectar sus dependencias.",
      allDependenciesResolved: "Todas las dependencias resueltas.",
      required: "Requerido: {value}",
      chooseVersion: "Elegir version",
      setVersion: "Definir version",
      clear: "Limpiar",
      download: "Descargar:",
      selectVersionForLink:
        "Selecciona una version para generar un enlace",
      openLink: "Abrir enlace",
      uploadPackageOrCompose:
        "Subir paquete (.tgz) o proyecto compose (.json/.zip)",
      uploadPackageOrComposeHelper:
        "Sube paquetes objetivo o de dependencia. El importador detectara coincidencias.",
      uploadPackageOrComposeHint:
        "Arrastra y suelta archivos .tgz, .json o .zip aqui",
      importHistory: "Historial de importacion",
      importHistoryDescription: "Paquetes objetivo importados anteriormente.",
      noImportsYet: "Aun no hay importaciones.",
      importLog: "Registro de importacion",
      latestImportActions: "Ultimas acciones durante esta importacion.",
      importLogHistory: "Historial de la ultima importacion completada.",
      showLog: "Mostrar registro ({count})",
      noLogEntries: "No hay entradas en el registro.",
      conflicts: "Conflictos",
      conflictsDescription:
        "Resuelve estos conflictos antes de completar la importacion.",
      versionConflict: "Conflicto de version",
      copyLink: "Copiar enlace",
    },
    it: {
      ...enText,
      none: "Nessuno",
      failedComposeProjectImport:
        "Importazione del file progetto compose non riuscita.",
      composeProjectImported:
        "Progetto compose importato ({imported} pacchetti, {skipped} saltati).",
      packageAlreadyImported: "Il pacchetto {packageKey} e gia importato.",
      targetPackageImported: "Pacchetto target {packageKey} importato.",
      dependencyImported: "Dipendenza {packageKey} importata.",
      packageImportedButNotMissing:
        "Pacchetto {packageKey} importato, ma non era segnato come mancante.",
      targetPackageAlreadyImported:
        "Il pacchetto target {packageKey} e gia importato.",
      importingPackage: "Importazione pacchetto",
      packageAlreadyImportedShort: "Pacchetto {packageKey} gia importato.",
      importedPackageShort: "{packageKey} importato.",
      errorPrefix: "Errore: {error}",
      title: "Importazione pacchetti",
      importer: "Importatore FHIR",
      cancelImport: "Annulla importazione",
      projectsOverview: "Panoramica progetti",
      home: "Home",
      intro:
        "Importa pacchetti FHIR e tutte le dipendenze transitive nel browser. La procedura guidata si aggiorna dopo ogni caricamento.",
      imported: "Importati: {count}",
      missing: "Mancanti: {count}",
      definitions: "Definizioni: {count}",
      target: "Target: {value}",
      importSuccessful: "Importazione riuscita",
      importSuccessfulDescription:
        "{targetKey} e stato importato con successo. Puoi avviare una nuova importazione o tornare alla panoramica progetti.",
      goToProjectsOverview: "Vai alla panoramica progetti",
      targetImported: "Target importato: {value}",
      targetPackage: "Pacchetto target",
      targetSetDescription:
        "Target impostato. Scarica il pacchetto e caricalo per avviare l'importazione.",
      targetUploadOrEnter:
        "Carica direttamente il pacchetto target o inserisci id + versione.",
      importStartedFor: "Importazione avviata per:",
      downloadPackages: "Scarica (packages2.fhir.org)",
      uploadTargetPackage: "Carica pacchetto target (.tgz)",
      uploadTargetHelper:
        "Scarica il target da packages2.fhir.org, poi caricalo qui per avviare l'importazione.",
      uploadTargetHint: "Trascina qui il file .tgz target",
      uploadTargetOrCompose:
        "Carica pacchetto target (.tgz) o progetto compose (.json/.zip)",
      uploadTargetOrComposeHelper:
        "Il pacchetto deve contenere package/package.json",
      uploadTargetOrComposeHint:
        "Trascina qui file .tgz, .json o .zip",
      packageId: "ID pacchetto",
      version: "Versione",
      setTarget: "Imposta target",
      dependencies: "Dipendenze",
      dependenciesDescription:
        "Carica qualsiasi dipendenza mancante in qualsiasi ordine. Puoi avviare piu download contemporaneamente.",
      uploadTargetToDetect:
        "Carica il pacchetto target per rilevare le sue dipendenze.",
      allDependenciesResolved: "Tutte le dipendenze risolte.",
      required: "Richiesto: {value}",
      chooseVersion: "Scegli versione",
      setVersion: "Imposta versione",
      clear: "Pulisci",
      download: "Scarica:",
      selectVersionForLink: "Seleziona una versione per generare un link",
      openLink: "Apri link",
      uploadPackageOrCompose:
        "Carica pacchetto (.tgz) o progetto compose (.json/.zip)",
      uploadPackageOrComposeHelper:
        "Carica pacchetti target o di dipendenza. L'importatore rilevera le corrispondenze.",
      uploadPackageOrComposeHint:
        "Trascina qui file .tgz, .json o .zip",
      importHistory: "Cronologia importazioni",
      importHistoryDescription: "Pacchetti target importati in precedenza.",
      noImportsYet: "Nessuna importazione.",
      importLog: "Log importazione",
      latestImportActions: "Ultime azioni durante questa importazione.",
      importLogHistory: "Cronologia dell'ultima importazione completata.",
      showLog: "Mostra log ({count})",
      noLogEntries: "Nessuna voce di log.",
      conflicts: "Conflitti",
      conflictsDescription:
        "Risolvi questi conflitti prima del completamento dell'importazione.",
      versionConflict: "Conflitto di versione",
      copyLink: "Copia link",
    },
	  });

  const format = useCallback(
    (template: string, values: Record<string, string | number>) =>
      template.replace(/\{(\w+)\}/g, (_, key) => String(values[key] ?? "")),
    []
  );

  const currentTarget = snapshot?.state.currentTarget;

  useEffect(() => {
    if (currentTarget) return;
    const projectParam = searchParams.get("project")?.trim();
    const versionParam = searchParams.get("version")?.trim();
    if (projectParam && packageId.length === 0) {
      setPackageId(projectParam);
    }
    if (versionParam && version.length === 0) {
      setVersion(versionParam);
    }
  }, [searchParams, currentTarget, packageId.length, version.length]);

  useEffect(() => {
    if (currentTarget) {
      setPackageId(currentTarget.id);
      setVersion(currentTarget.version);
      setCompletedSummary(null);
    }
  }, [currentTarget]);

  const dependencyState = snapshot?.dependencyState;
  const missing = dependencyState?.missing ?? [];
  const conflicts = dependencyState?.conflicts ?? [];
  const packages = snapshot?.packages ?? [];
  const trimmedPackageId = packageId.trim();
  const trimmedVersion = version.trim();

  const targetKey = currentTarget ? `${currentTarget.id}@${currentTarget.version}` : null;
  const isTargetImported = targetKey
    ? packages.some((pkg) => pkg.key === targetKey)
    : false;
  const targetDownloadUrl = currentTarget
    ? getDownloadUrl(currentTarget.id, currentTarget.version)
    : null;

  const handleCopy = async (link: string) => {
    if (typeof navigator === "undefined") return;
    await navigator.clipboard.writeText(link);
  };

  const importedCount = packages.length;
  const missingCount = missing.length;
  const allResolved = Boolean(
    currentTarget && isTargetImported && missing.length === 0 && conflicts.length === 0
  );
  const importedTargetText = currentTarget
    ? `${currentTarget.id}@${currentTarget.version}`
    : text.none;
  const isTargetReady = Boolean(currentTarget && isTargetImported);
  const importedDefinitions = snapshot?.resourceIndexCount ?? 0;
  const lastImport = completedSummary;
  const lastImportLog = completedSummary?.log ?? [];
  const importHistory = snapshot?.state.importHistory ?? [];

  const parsePackageKey = (key: string) => {
    const index = key.lastIndexOf("@");
    if (index <= 0) return { id: key, version: "" };
    return { id: key.slice(0, index), version: key.slice(index + 1) };
  };

  const createDatasetId = () =>
    `dataset-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

  const importComposeBundle = async (bundle: ComposeProjectExport) => {
    const result = await importComposeProject(bundle);
    if (!result) {
      return text.failedComposeProjectImport;
    }
    const datasets = bundle.datasets ?? [];

    if (datasets.length > 0) {
      for (const dataset of datasets) {
        if (!dataset?.name) continue;
        const datasetId = dataset.id ?? createDatasetId();
        const record: DatasetRecord = {
          id: datasetId,
          name: dataset.name,
          projectKey: dataset.projectKey ?? bundle.targetKey ?? "imported",
          createdAt: Date.now(),
        };
        upsertDataset(record);
        const resources = hydrateDatasetResources(
          Array.isArray(dataset.resources) ? dataset.resources : []
        );
        saveDatasetResources(datasetId, resources);
      }
    }

    return format(text.composeProjectImported, {
      imported: result.imported,
      skipped: result.skipped,
    });
  };

  const parseComposeZip = async (file: File): Promise<ComposeProjectExport | null> => {
    try {
      const buffer = await file.arrayBuffer();
      const zip = await JSZip.loadAsync(buffer);
      const manifestFile = zip.file("compose-project.json");
      if (!manifestFile) return null;

      const manifestText = await manifestFile.async("text");
      const manifest = JSON.parse(manifestText);

      if (isComposeProjectExport(manifest)) {
        return manifest;
      }

      if (!isComposeProjectArchive(manifest)) return null;

      const packages: ComposePackageExport[] = [];
      for (const entry of manifest.packages) {
        const pkgFile = zip.file(entry.file);
        if (!pkgFile) continue;
        const pkgText = await pkgFile.async("text");
        packages.push(JSON.parse(pkgText) as ComposePackageExport);
      }

      const datasets: ComposeDatasetExport[] = [];
      for (const entry of manifest.datasets ?? []) {
        const datasetFile = zip.file(entry.file);
        if (!datasetFile) continue;
        const datasetText = await datasetFile.async("text");
        datasets.push(JSON.parse(datasetText) as ComposeDatasetExport);
      }

      return {
        type: "health-compose-project",
        version: 1,
        targetKey: manifest.targetKey,
        exportedAt: manifest.exportedAt,
        packages,
        datasets,
      };
    } catch (err) {
      console.error(err);
      return null;
    }
  };

  const maybeImportComposeProject = async (file: File) => {
    const name = file.name.toLowerCase();
    const isJson =
      name.endsWith(".json") ||
      file.type === "application/json" ||
      file.type === "text/json";
    const isZip = name.endsWith(".zip") || file.type === "application/zip";

    try {
      if (isZip) {
        const bundle = await parseComposeZip(file);
        if (!bundle) return null;
        return await importComposeBundle(bundle);
      }

      if (!isJson) return null;
      const text = await file.text();
      const parsed = JSON.parse(text);
      if (!isComposeProjectExport(parsed)) {
        return null;
      }
      return await importComposeBundle(parsed);
    } catch (err) {
      console.error(err);
      return text.failedComposeProjectImport;
    }
  };

  const handleUpload = async (files: File[]) => {
    setUploadNotice(null);
    const missingIds = new Set(missing.map((dep) => dep.id));
    setIsUploading(true);
    const notices: string[] = [];

    for (const file of files) {
      const composeNotice = await maybeImportComposeProject(file);
      if (composeNotice) {
        notices.push(composeNotice);
        continue;
      }

      const result = await importFile(file);
      if (!result) continue;
      const parsed = parsePackageKey(result.packageKey);

      if (result.status === "duplicate") {
        notices.push(format(text.packageAlreadyImported, { packageKey: result.packageKey }));
      } else if (
        currentTarget &&
        parsed.id === currentTarget.id &&
        parsed.version === currentTarget.version
      ) {
        notices.push(format(text.targetPackageImported, { packageKey: result.packageKey }));
      } else if (missingIds.has(parsed.id)) {
        notices.push(format(text.dependencyImported, { packageKey: result.packageKey }));
      } else {
        notices.push(
          format(text.packageImportedButNotMissing, { packageKey: result.packageKey })
        );
      }
    }

    setIsUploading(false);
    if (notices.length > 0) {
      setUploadNotice(notices.join(" "));
    }
  };

  const handleTargetUpload = async (files: File[]) => {
    setUploadNotice(null);
    setIsUploading(true);
    const notices: string[] = [];

    for (const file of files) {
      const composeNotice = await maybeImportComposeProject(file);
      if (composeNotice) {
        notices.push(composeNotice);
        continue;
      }

      const result = await importTargetFile(file);
      if (!result) continue;

      if (result.status === "duplicate") {
        notices.push(
          format(text.targetPackageAlreadyImported, { packageKey: result.packageKey })
        );
      } else {
        notices.push(format(text.targetPackageImported, { packageKey: result.packageKey }));
      }
    }

    setIsUploading(false);
    if (notices.length > 0) {
      setUploadNotice(notices.join(" "));
    }
  };

  const addLog = useCallback((message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setImportLog((prev) => [`${timestamp} — ${message}`, ...prev].slice(0, 50));
  }, []);

  useEffect(() => {
    if (progress.phase !== "idle") {
      toast.loading(text.importingPackage, {
        id: progressToastId.current,
      });
    } else {
      toast.dismiss(progressToastId.current);
    }
  }, [progress.phase, text.importingPackage]);

  useEffect(() => {
    if (!lastResult) return;
    if (lastResultRef.current === lastResult.packageKey) return;
    lastResultRef.current = lastResult.packageKey;

    const message =
      lastResult.status === "duplicate"
        ? format(text.packageAlreadyImportedShort, { packageKey: lastResult.packageKey })
        : format(text.importedPackageShort, { packageKey: lastResult.packageKey });

    toast.success(message);
    addLog(message);
  }, [
    addLog,
    format,
    lastResult,
    text.importedPackageShort,
    text.packageAlreadyImportedShort,
  ]);

  useEffect(() => {
    if (!error) return;
    toast.error(error);
    addLog(format(text.errorPrefix, { error }));
  }, [addLog, error, format, text.errorPrefix]);

  useEffect(() => {
    if (!uploadNotice || uploadNotice === lastNoticeRef.current) return;
    lastNoticeRef.current = uploadNotice;
    toast.info(uploadNotice);
    addLog(uploadNotice);
  }, [addLog, uploadNotice]);

  useEffect(() => {
    if (!allResolved || !currentTarget) return;
    const targetKey = `${currentTarget.id}@${currentTarget.version}`;
    if (completionHandledRef.current === targetKey) return;
    completionHandledRef.current = targetKey;
    setCompletedSummary({
      targetKey,
      log: importLog.slice(0, 100),
    });
    (async () => {
      await addImportHistory(targetKey);
      await finalizeTarget();
      setPackageId("");
      setVersion("");
      setVersionDrafts({});
      setUploadNotice(null);
      setImportLog([]);
    })();
  }, [allResolved, currentTarget, importLog, finalizeTarget, addImportHistory]);

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-8">
      <header className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground">
              {text.importer}
            </p>
            <h1 className="text-3xl font-semibold text-foreground">{text.title}</h1>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {currentTarget ? (
              !allResolved ? (
                <Button
                  variant="outline"
                  onClick={async () => {
                    await clearTarget();
                    setPackageId("");
                    setVersion("");
                    setVersionDrafts({});
                    setUploadNotice(null);
                    setImportLog([]);
                  }}
                >
                  {text.cancelImport}
                </Button>
              ) : null
            ) : null}
            <Button asChild variant="ghost" size="sm">
              <Link href="/">{text.projectsOverview}</Link>
            </Button>
            <Button asChild variant="ghost" size="sm">
              <Link href="/">{text.home}</Link>
            </Button>
          </div>
        </div>
        <p className="max-w-2xl text-sm text-muted-foreground">
          {text.intro}
        </p>
        <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
          <span>{format(text.imported, { count: importedCount })}</span>
          <span>{format(text.missing, { count: missingCount })}</span>
          <span>{format(text.definitions, { count: importedDefinitions })}</span>
          <span>
            {format(text.target, {
              value: currentTarget ? `${currentTarget.id}@${currentTarget.version}` : text.none,
            })}
          </span>
        </div>
        {lastImport ? (
          <Card className="border-foreground/20 bg-muted/20">
            <CardHeader>
              <CardTitle>{text.importSuccessful}</CardTitle>
              <CardDescription>
                {format(text.importSuccessfulDescription, {
                  targetKey: lastImport.targetKey,
                })}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild size="lg" className="w-full">
                <Link href="/">{text.goToProjectsOverview}</Link>
              </Button>
            </CardContent>
          </Card>
        ) : null}
        {isTargetReady ? (
          <div className="rounded-lg border border-foreground/10 bg-muted/30 px-4 py-3 text-xs text-muted-foreground">
            {format(text.targetImported, { value: importedTargetText })}
          </div>
        ) : null}
      </header>

      {!isTargetReady || allResolved ? (
        <Card>
          <CardHeader>
            <CardTitle>{text.targetPackage}</CardTitle>
            <CardDescription>
              {currentTarget
                ? text.targetSetDescription
                : text.targetUploadOrEnter}
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            {currentTarget ? (
              <>
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-foreground/10 bg-muted/30 px-4 py-3 text-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-foreground">{text.importStartedFor}</span>
                    <span className="text-foreground">
                      {currentTarget.id}@{currentTarget.version}
                    </span>
                  </div>
                  {targetDownloadUrl ? (
                    <div className="flex flex-wrap items-center gap-2">
                      <Button asChild size="sm" variant="secondary">
                        <a href={targetDownloadUrl} target="_blank" rel="noreferrer">
                          {text.downloadPackages}
                        </a>
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleCopy(targetDownloadUrl)}
                      >
                        {text.copyLink}
                      </Button>
                    </div>
                  ) : null}
                </div>
                <FileDropzone
                  label={text.uploadTargetPackage}
                  helperText={text.uploadTargetHelper}
                  disabled={isUploading}
                  accept=".tgz,.json,.zip,application/gzip,application/x-gzip,application/json,application/zip"
                  hint={text.uploadTargetHint}
                  onFiles={handleTargetUpload}
                />
              </>
            ) : (
              <>
                <FileDropzone
                  label={text.uploadTargetOrCompose}
                  helperText={text.uploadTargetOrComposeHelper}
                  disabled={isUploading}
                  accept=".tgz,.json,.zip,application/gzip,application/x-gzip,application/json,application/zip"
                  hint={text.uploadTargetOrComposeHint}
                  onFiles={handleTargetUpload}
                />
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="grid gap-2">
                    <Label htmlFor="package-id">{text.packageId}</Label>
                    <Input
                      id="package-id"
                      value={packageId}
                      onChange={(event) => setPackageId(event.target.value)}
                      placeholder="de.gematik.fhir.directory"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="package-version">{text.version}</Label>
                    <Input
                      id="package-version"
                      value={version}
                      onChange={(event) => setVersion(event.target.value)}
                      placeholder="1.0.0"
                    />
                  </div>
                  <div className="flex items-end">
                    <Button
                      className="w-full"
                      disabled={!trimmedPackageId || !trimmedVersion}
                      onClick={() => setTarget(trimmedPackageId, trimmedVersion)}
                    >
                      {text.setTarget}
                    </Button>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      ) : null}

      {currentTarget && !allResolved ? (
        <Card>
          <CardHeader>
            <CardTitle>{text.dependencies}</CardTitle>
            <CardDescription>{text.dependenciesDescription}</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            {!isTargetImported ? (
              <div className="rounded-lg border border-foreground/10 bg-muted/30 px-4 py-3">
                <p className="text-sm text-foreground">
                  {text.uploadTargetToDetect}
                </p>
              </div>
            ) : missing.length === 0 ? (
              <div className="rounded-lg border border-foreground/10 bg-muted/30 px-4 py-3">
                <p className="text-sm text-foreground">{text.allDependenciesResolved}</p>
              </div>
            ) : (
              <div className="grid gap-3">
                {missing.map((dependency) => {
                  const selectedVersion = dependency.exactVersion ?? dependency.chosenVersion;
                  const link = selectedVersion
                    ? getDownloadUrl(dependency.id, selectedVersion)
                    : null;
                  const draftValue =
                    versionDrafts[dependency.id] ?? dependency.chosenVersion ?? "";
                  const needsSelection = !dependency.exactVersion;

                  return (
                    <div
                      key={dependency.id}
                      className="rounded-xl border border-foreground/10 bg-background px-4 py-4"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-foreground">{dependency.id}</p>
                          <p className="text-xs text-muted-foreground">
                            {format(text.required, { value: formatRequirement(dependency) })}
                          </p>
                        </div>
                      </div>

                      {needsSelection ? (
                        <div className="mt-3 grid gap-3 md:grid-cols-[1fr_auto_auto]">
                          <div className="grid gap-2">
                            <Label htmlFor={`version-${dependency.id}`}>{text.chooseVersion}</Label>
                            <Input
                              id={`version-${dependency.id}`}
                              value={draftValue}
                              onChange={(event) =>
                                setVersionDrafts((prev) => ({
                                  ...prev,
                                  [dependency.id]: event.target.value,
                                }))
                              }
                              placeholder="1.2.3"
                            />
                          </div>
                          <div className="flex items-end">
                            <Button
                              variant="secondary"
                              disabled={!draftValue}
                              onClick={() => setVersionSelection(dependency.id, draftValue)}
                            >
                                {text.setVersion}
                              </Button>
                          </div>
                          {dependency.chosenVersion ? (
                            <div className="flex items-end">
                              <Button
                                variant="ghost"
                                onClick={() => clearVersionSelection(dependency.id)}
                              >
                                {text.clear}
                              </Button>
                            </div>
                          ) : null}
                        </div>
                      ) : null}

                      <div className="mt-3 flex flex-col gap-2">
                        <div className="flex flex-wrap items-center gap-2 text-sm">
                          <span className="font-medium text-foreground">{text.download}</span>
                          <span className="text-muted-foreground">
                            {link ?? text.selectVersionForLink}
                          </span>
                          {link ? (
                            <div className="flex flex-wrap items-center gap-2">
                              <Button asChild size="sm" variant="secondary">
                                <a href={link} target="_blank" rel="noreferrer">
                                  {text.openLink}
                                </a>
                              </Button>
                              <Button size="sm" variant="outline" onClick={() => handleCopy(link)}>
                                {text.copyLink}
                              </Button>
                            </div>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            {missing.length > 0 ? (
              <FileDropzone
                label={text.uploadPackageOrCompose}
                helperText={text.uploadPackageOrComposeHelper}
                disabled={!currentTarget || isUploading}
                accept=".tgz,.json,.zip,application/gzip,application/x-gzip,application/json,application/zip"
                hint={text.uploadPackageOrComposeHint}
                onFiles={handleUpload}
              />
            ) : null}
            {null}
          </CardContent>
        </Card>
      ) : null}

      {!currentTarget ? (
        <Card>
          <CardHeader>
            <CardTitle>{text.importHistory}</CardTitle>
            <CardDescription>{text.importHistoryDescription}</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-2 text-sm text-muted-foreground">
            {importHistory.length === 0 ? (
              <div className="rounded-lg border border-foreground/10 px-3 py-2 text-xs text-muted-foreground">
                {text.noImportsYet}
              </div>
            ) : (
              importHistory.map((entry) => (
                <div
                  key={`${entry.targetKey}-${entry.completedAt}`}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-foreground/10 px-3 py-2"
                >
                  <span className="text-foreground">{entry.targetKey}</span>
                  <span className="text-xs text-muted-foreground">
                    {new Date(entry.completedAt).toLocaleString()}
                  </span>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      ) : null}

      {currentTarget ? (
        <Card>
          <CardHeader>
            <CardTitle>{text.importLog}</CardTitle>
            <CardDescription>{text.latestImportActions}</CardDescription>
          </CardHeader>
          <CardContent>
            <details className="rounded-lg border border-foreground/10 bg-muted/30 px-4 py-3">
              <summary className="cursor-pointer text-sm font-medium text-foreground">
                {format(text.showLog, { count: importLog.length })}
              </summary>
              <div className="mt-3 flex max-h-64 flex-col gap-2 overflow-auto text-xs text-muted-foreground">
                {importLog.length === 0 ? (
                  <span>{text.noLogEntries}</span>
                ) : (
                  importLog.map((entry, index) => <span key={index}>{entry}</span>)
                )}
              </div>
            </details>
          </CardContent>
        </Card>
      ) : lastImportLog.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>{text.importLog}</CardTitle>
            <CardDescription>{text.importLogHistory}</CardDescription>
          </CardHeader>
          <CardContent>
            <details className="rounded-lg border border-foreground/10 bg-muted/30 px-4 py-3">
              <summary className="cursor-pointer text-sm font-medium text-foreground">
                {format(text.showLog, { count: lastImportLog.length })}
              </summary>
              <div className="mt-3 flex max-h-64 flex-col gap-2 overflow-auto text-xs text-muted-foreground">
                {lastImportLog.map((entry, index) => (
                  <span key={index}>{entry}</span>
                ))}
              </div>
            </details>
          </CardContent>
        </Card>
      ) : null}

      {conflicts.length > 0 && (
        <Card className="border-destructive/40">
          <CardHeader>
            <CardTitle>{text.conflicts}</CardTitle>
            <CardDescription>{text.conflictsDescription}</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-2">
            {conflicts.map((conflict) => (
              <div
                key={conflict.id}
                className="rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2"
              >
                <p className="text-sm font-semibold text-foreground">{conflict.id}</p>
                <p className="text-xs text-muted-foreground">
                  {conflict.conflictReason ?? text.versionConflict}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
};
