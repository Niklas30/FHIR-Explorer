import { Fragment, createElement, type ReactNode } from "react";
import { byLocale } from "@fhir-explorer/core/i18n/select";
import { isLocale, type Locale } from "@fhir-explorer/core/i18n/types";

/**
 * Texts of the extension's own webviews. The shared components bring their
 * own; these are the frames around them.
 *
 * The host writes its locale into `<html lang>`, so every webview knows it
 * before the first message arrives.
 */
export const webviewLocale = (): Locale => {
  const language = document.documentElement.lang.split("-")[0] ?? "";
  return isLocale(language) ? language : "en";
};

/**
 * Fills `{name}` placeholders with React nodes, so a sentence can keep its
 * word order per language and still carry `<code>` spans.
 */
export const fill = (template: string, values: Record<string, ReactNode>): ReactNode =>
  template
    .split(/(\{\w+\})/)
    .map((part, index) => {
      const key = /^\{(\w+)\}$/.exec(part)?.[1];
      return createElement(Fragment, { key: index }, key && key in values ? values[key] : part);
    });

export const formText = (locale: Locale) =>
  byLocale(locale, {
    en: {
      loading: "Loading resource…",
      invalidJson: "This file is not valid JSON. Edit it as text to fix it.",
      constraints: "Constraints",
      form: "Form",
      noProfile:
        "No StructureDefinition found for {type}. Import the package that defines it, then reopen this file.",
      thisResource: "this resource",
    },
    de: {
      loading: "Ressource wird geladen …",
      invalidJson:
        "Diese Datei ist kein gültiges JSON. Zum Korrigieren als Text bearbeiten.",
      constraints: "Constraints",
      form: "Formular",
      noProfile:
        "Keine StructureDefinition für {type} gefunden. Das Package importieren, das sie definiert, und die Datei neu öffnen.",
      thisResource: "diese Ressource",
    },
    fr: {
      loading: "Chargement de la ressource…",
      invalidJson:
        "Ce fichier n'est pas un JSON valide. Modifiez-le en tant que texte pour le corriger.",
      constraints: "Contraintes",
      form: "Formulaire",
      noProfile:
        "Aucune StructureDefinition trouvée pour {type}. Importez le package qui la définit, puis rouvrez ce fichier.",
      thisResource: "cette ressource",
    },
    es: {
      loading: "Cargando recurso…",
      invalidJson:
        "Este archivo no es JSON válido. Edítalo como texto para corregirlo.",
      constraints: "Restricciones",
      form: "Formulario",
      noProfile:
        "No se encontró ninguna StructureDefinition para {type}. Importa el paquete que la define y vuelve a abrir este archivo.",
      thisResource: "este recurso",
    },
    it: {
      loading: "Caricamento della risorsa…",
      invalidJson:
        "Questo file non è un JSON valido. Modificalo come testo per correggerlo.",
      constraints: "Vincoli",
      form: "Modulo",
      noProfile:
        "Nessuna StructureDefinition trovata per {type}. Importa il pacchetto che la definisce, poi riapri questo file.",
      thisResource: "questa risorsa",
    },
  });

export const graphText = (locale: Locale) =>
  byLocale(locale, {
    en: {
      loading: "Loading dependencies…",
      intro: "Dependency closure. Select a missing package to install it.",
      labels: {
        target: "Project",
        resolved: "Installed",
        missing: "Missing",
        add: "Install",
        empty: "This project declares no dependencies.",
      },
    },
    de: {
      loading: "Abhängigkeiten werden geladen …",
      intro:
        "Alle Abhängigkeiten, auch indirekte. Ein fehlendes Package anklicken, um es zu installieren.",
      labels: {
        target: "Projekt",
        resolved: "Installiert",
        missing: "Fehlt",
        add: "Installieren",
        empty: "Dieses Projekt deklariert keine Abhängigkeiten.",
      },
    },
    fr: {
      loading: "Chargement des dépendances…",
      intro:
        "Toutes les dépendances, y compris indirectes. Sélectionnez un package manquant pour l'installer.",
      labels: {
        target: "Projet",
        resolved: "Installé",
        missing: "Manquant",
        add: "Installer",
        empty: "Ce projet ne déclare aucune dépendance.",
      },
    },
    es: {
      loading: "Cargando dependencias…",
      intro:
        "Todas las dependencias, también las indirectas. Selecciona un paquete que falte para instalarlo.",
      labels: {
        target: "Proyecto",
        resolved: "Instalado",
        missing: "Falta",
        add: "Instalar",
        empty: "Este proyecto no declara dependencias.",
      },
    },
    it: {
      loading: "Caricamento delle dipendenze…",
      intro:
        "Tutte le dipendenze, anche indirette. Seleziona un pacchetto mancante per installarlo.",
      labels: {
        target: "Progetto",
        resolved: "Installato",
        missing: "Mancante",
        add: "Installa",
        empty: "Questo progetto non dichiara dipendenze.",
      },
    },
  });

export const projectFormText = (locale: Locale) =>
  byLocale(locale, {
    en: {
      loading: "Loading…",
      errorName: "Lowercase, dot-separated, at least two segments (de.example.project)",
      errorVersion: "A semantic version, e.g. 0.1.0",
      errorCanonical: "Must be an http or https url",
      errorFolder: "Pick where the project folder is created",
      cloneTitle: "Clone {id}",
      newTitle: "New FHIR project",
      editingIntro:
        "Editing {file} in {root}. Changes are written in place, keeping formatting and comments.",
      theManifest: "the manifest",
      cloningIntro:
        "Copies every resource of {package} into a new editable project. Canonicals are kept as they are — a fork that rewrote them would break the references between the copied resources.",
      newIntro:
        "Creates a folder with a FHIR {file} and the IG Publisher input directories. Dependencies are installed right after.",
      builtOn: "Built on",
      brings: "Brings {list} — installed with it, whether or not you add anything else.",
      workspaceFolder: "Workspace folder",
      packageId: "Package id",
      packageIdEditingHint:
        "Renaming a package moves its canonicals and everyone else's dependency entry — not a field edit",
      packageIdHint: "Becomes the folder name and the published package name",
      version: "Version",
      title: "Title",
      titleHint: "Human-readable name, optional",
      titlePlaceholder: "Example Implementation Guide",
      description: "Description",
      optional: "Optional",
      canonical: "Canonical URL",
      canonicalHint: "Base for every canonical your resources define",
      fhirVersion: "FHIR version",
      additionalDependencies: "Additional dependencies",
      dependencies: "Dependencies",
      basisDependenciesHint:
        "Anything else this project should depend on, beyond what the package above already brings.",
      editingDependenciesHint:
        "Ticked entries are what the manifest declares. Unticking removes the declaration; the download stays in the local cache.",
      newDependenciesHint:
        "Already-imported packages are listed. Anything not installed yet is fetched when the project is created.",
      nothingImported: "Nothing imported yet — hl7.fhir.r4.core will be fetched.",
      willDownload: " · will be downloaded",
      cancel: "Cancel",
      save: "Save changes",
      clone: "Clone project",
      create: "Create project",
    },
    de: {
      loading: "Wird geladen …",
      errorName:
        "Kleinbuchstaben, durch Punkte getrennt, mindestens zwei Teile (de.example.project)",
      errorVersion: "Eine semantische Version, z. B. 0.1.0",
      errorCanonical: "Muss eine http- oder https-URL sein",
      errorFolder: "Ordner wählen, in dem das Projekt angelegt wird",
      cloneTitle: "{id} klonen",
      newTitle: "Neues FHIR-Projekt",
      editingIntro:
        "Bearbeitet {file} in {root}. Änderungen werden direkt in die Datei geschrieben, Formatierung und Kommentare bleiben erhalten.",
      theManifest: "das Manifest",
      cloningIntro:
        "Kopiert alle Ressourcen von {package} in ein neues, bearbeitbares Projekt. Die Canonicals bleiben unverändert – würden sie umgeschrieben, wären die Referenzen zwischen den kopierten Ressourcen kaputt.",
      newIntro:
        "Legt einen Ordner mit einer FHIR-{file} und den Eingabeverzeichnissen des IG Publishers an. Die Abhängigkeiten werden direkt danach installiert.",
      builtOn: "Basiert auf",
      brings:
        "Bringt {list} mit – wird mitinstalliert, egal ob weitere Abhängigkeiten dazukommen.",
      workspaceFolder: "Workspace-Ordner",
      packageId: "Package-ID",
      packageIdEditingHint:
        "Ein Umbenennen verschiebt die Canonicals und die Abhängigkeitseinträge aller anderen – das ist keine Feldänderung",
      packageIdHint: "Wird zum Ordnernamen und zum Namen des veröffentlichten Packages",
      version: "Version",
      title: "Titel",
      titleHint: "Lesbarer Name, optional",
      titlePlaceholder: "Beispiel-Implementierungsleitfaden",
      description: "Beschreibung",
      optional: "Optional",
      canonical: "Canonical-URL",
      canonicalHint: "Basis für alle Canonicals, die die Ressourcen definieren",
      fhirVersion: "FHIR-Version",
      additionalDependencies: "Weitere Abhängigkeiten",
      dependencies: "Abhängigkeiten",
      basisDependenciesHint:
        "Alles, wovon dieses Projekt sonst noch abhängen soll, über das hinaus, was das Package oben schon mitbringt.",
      editingDependenciesHint:
        "Angehakt ist, was das Manifest deklariert. Abhaken entfernt die Deklaration; der Download bleibt im lokalen Cache.",
      newDependenciesHint:
        "Bereits importierte Packages sind aufgelistet. Was noch nicht installiert ist, wird beim Anlegen des Projekts geladen.",
      nothingImported: "Noch nichts importiert – hl7.fhir.r4.core wird geladen.",
      willDownload: " · wird heruntergeladen",
      cancel: "Abbrechen",
      save: "Änderungen speichern",
      clone: "Projekt klonen",
      create: "Projekt anlegen",
    },
    fr: {
      loading: "Chargement…",
      errorName:
        "Minuscules, séparées par des points, au moins deux segments (de.example.project)",
      errorVersion: "Une version sémantique, p. ex. 0.1.0",
      errorCanonical: "Doit être une URL http ou https",
      errorFolder: "Choisissez où créer le dossier du projet",
      cloneTitle: "Cloner {id}",
      newTitle: "Nouveau projet FHIR",
      editingIntro:
        "Modification de {file} dans {root}. Les changements sont écrits sur place, en conservant la mise en forme et les commentaires.",
      theManifest: "le manifeste",
      cloningIntro:
        "Copie toutes les ressources de {package} dans un nouveau projet modifiable. Les canonicals restent inchangés : les réécrire casserait les références entre les ressources copiées.",
      newIntro:
        "Crée un dossier avec un {file} FHIR et les répertoires d'entrée de l'IG Publisher. Les dépendances sont installées juste après.",
      builtOn: "Basé sur",
      brings:
        "Apporte {list} : installé avec, que vous ajoutiez autre chose ou non.",
      workspaceFolder: "Dossier de l'espace de travail",
      packageId: "ID du package",
      packageIdEditingHint:
        "Renommer un package déplace ses canonicals et les dépendances de tous les autres : ce n'est pas une simple modification de champ",
      packageIdHint: "Devient le nom du dossier et le nom du package publié",
      version: "Version",
      title: "Titre",
      titleHint: "Nom lisible, facultatif",
      titlePlaceholder: "Guide d'implémentation d'exemple",
      description: "Description",
      optional: "Facultatif",
      canonical: "URL canonique",
      canonicalHint: "Base de chaque canonical défini par vos ressources",
      fhirVersion: "Version FHIR",
      additionalDependencies: "Dépendances supplémentaires",
      dependencies: "Dépendances",
      basisDependenciesHint:
        "Tout ce dont ce projet doit dépendre en plus de ce qu'apporte déjà le package ci-dessus.",
      editingDependenciesHint:
        "Les entrées cochées sont celles que déclare le manifeste. Décocher retire la déclaration ; le téléchargement reste dans le cache local.",
      newDependenciesHint:
        "Les packages déjà importés sont listés. Ce qui n'est pas encore installé est téléchargé à la création du projet.",
      nothingImported: "Rien n'est encore importé : hl7.fhir.r4.core sera téléchargé.",
      willDownload: " · sera téléchargé",
      cancel: "Annuler",
      save: "Enregistrer les modifications",
      clone: "Cloner le projet",
      create: "Créer le projet",
    },
    es: {
      loading: "Cargando…",
      errorName:
        "Minúsculas, separadas por puntos, al menos dos segmentos (de.example.project)",
      errorVersion: "Una versión semántica, p. ej. 0.1.0",
      errorCanonical: "Debe ser una URL http o https",
      errorFolder: "Elige dónde se crea la carpeta del proyecto",
      cloneTitle: "Clonar {id}",
      newTitle: "Nuevo proyecto FHIR",
      editingIntro:
        "Editando {file} en {root}. Los cambios se escriben en el propio archivo, conservando el formato y los comentarios.",
      theManifest: "el manifiesto",
      cloningIntro:
        "Copia todos los recursos de {package} en un nuevo proyecto editable. Los canonicals se mantienen tal cual: reescribirlos rompería las referencias entre los recursos copiados.",
      newIntro:
        "Crea una carpeta con un {file} FHIR y los directorios de entrada del IG Publisher. Las dependencias se instalan justo después.",
      builtOn: "Basado en",
      brings:
        "Trae {list}: se instala con él, añadas o no algo más.",
      workspaceFolder: "Carpeta del área de trabajo",
      packageId: "ID del paquete",
      packageIdEditingHint:
        "Renombrar un paquete mueve sus canonicals y las dependencias de todos los demás: no es una simple edición de campo",
      packageIdHint: "Se convierte en el nombre de la carpeta y del paquete publicado",
      version: "Versión",
      title: "Título",
      titleHint: "Nombre legible, opcional",
      titlePlaceholder: "Guía de implementación de ejemplo",
      description: "Descripción",
      optional: "Opcional",
      canonical: "URL canónica",
      canonicalHint: "Base de cada canonical que definen tus recursos",
      fhirVersion: "Versión de FHIR",
      additionalDependencies: "Dependencias adicionales",
      dependencies: "Dependencias",
      basisDependenciesHint:
        "Cualquier otra cosa de la que deba depender este proyecto, además de lo que ya trae el paquete de arriba.",
      editingDependenciesHint:
        "Las entradas marcadas son las que declara el manifiesto. Desmarcar elimina la declaración; la descarga se queda en la caché local.",
      newDependenciesHint:
        "Se listan los paquetes ya importados. Lo que aún no está instalado se descarga al crear el proyecto.",
      nothingImported: "Aún no hay nada importado: se descargará hl7.fhir.r4.core.",
      willDownload: " · se descargará",
      cancel: "Cancelar",
      save: "Guardar cambios",
      clone: "Clonar proyecto",
      create: "Crear proyecto",
    },
    it: {
      loading: "Caricamento…",
      errorName:
        "Minuscole, separate da punti, almeno due segmenti (de.example.project)",
      errorVersion: "Una versione semantica, ad es. 0.1.0",
      errorCanonical: "Deve essere un URL http o https",
      errorFolder: "Scegli dove creare la cartella del progetto",
      cloneTitle: "Clona {id}",
      newTitle: "Nuovo progetto FHIR",
      editingIntro:
        "Modifica di {file} in {root}. Le modifiche vengono scritte direttamente nel file, mantenendo formattazione e commenti.",
      theManifest: "il manifest",
      cloningIntro:
        "Copia tutte le risorse di {package} in un nuovo progetto modificabile. I canonical restano invariati: riscriverli romperebbe i riferimenti tra le risorse copiate.",
      newIntro:
        "Crea una cartella con un {file} FHIR e le directory di input dell'IG Publisher. Le dipendenze vengono installate subito dopo.",
      builtOn: "Basato su",
      brings:
        "Porta con sé {list}: viene installato insieme, che tu aggiunga altro o no.",
      workspaceFolder: "Cartella dell'area di lavoro",
      packageId: "ID del pacchetto",
      packageIdEditingHint:
        "Rinominare un pacchetto sposta i suoi canonical e le dipendenze di tutti gli altri: non è una semplice modifica di campo",
      packageIdHint: "Diventa il nome della cartella e del pacchetto pubblicato",
      version: "Versione",
      title: "Titolo",
      titleHint: "Nome leggibile, facoltativo",
      titlePlaceholder: "Guida all'implementazione di esempio",
      description: "Descrizione",
      optional: "Facoltativo",
      canonical: "URL canonico",
      canonicalHint: "Base per ogni canonical definito dalle tue risorse",
      fhirVersion: "Versione FHIR",
      additionalDependencies: "Dipendenze aggiuntive",
      dependencies: "Dipendenze",
      basisDependenciesHint:
        "Qualsiasi altra cosa da cui questo progetto deve dipendere, oltre a quanto già porta il pacchetto qui sopra.",
      editingDependenciesHint:
        "Le voci spuntate sono quelle dichiarate dal manifest. Togliere la spunta rimuove la dichiarazione; il download resta nella cache locale.",
      newDependenciesHint:
        "Sono elencati i pacchetti già importati. Ciò che non è ancora installato viene scaricato alla creazione del progetto.",
      nothingImported: "Ancora nulla di importato: verrà scaricato hl7.fhir.r4.core.",
      willDownload: " · verrà scaricato",
      cancel: "Annulla",
      save: "Salva modifiche",
      clone: "Clona progetto",
      create: "Crea progetto",
    },
  });
