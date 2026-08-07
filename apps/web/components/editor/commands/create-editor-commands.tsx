import {
  ArrowLeft,
  ArrowRight,
  Command as CommandIcon,
  Download,
  FilePlus2,
  Home,
  Moon,
  Search,
  Sun,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import type { EditorCommand } from "@/components/editor/commands/types";
import { byLocale } from "@/lib/i18n/select";
import type { Locale } from "@/lib/i18n/types";

type CreateEditorCommandsOptions = {
  openPalette: () => void;
  openProjects: () => void;
  createResource: () => void;
  openExport: () => void;
  openDiagram: () => void;
  focusFormSearch: () => void;
  zoomIn: () => void;
  zoomOut: () => void;
  navigateBack: () => void;
  navigateForward: () => void;
  canNavigateBack: boolean;
  canNavigateForward: boolean;
  locale: Locale;
  theme: "light" | "dark";
  setTheme: (theme: "light" | "dark") => void;
};

export const createEditorCommands = ({
  openPalette,
  openProjects,
  createResource,
  openExport,
  openDiagram,
  focusFormSearch,
  zoomIn,
  zoomOut,
  navigateBack,
  navigateForward,
  canNavigateBack,
  canNavigateForward,
  locale,
  theme,
  setTheme,
}: CreateEditorCommandsOptions): EditorCommand[] => {
  const enText = {
    navigation: "Navigation",
    actions: "Actions",
    view: "View",
    openCommands: "Open Commands",
    backToProjects: "Back to Projects",
    previousResource: "Previous Resource",
    nextResource: "Next Resource",
    createResource: "Create Resource",
    export: "Export",
    visualize: "Visualize",
    searchFormFields: "Search Form Fields",
    zoomIn: "Zoom In",
    zoomOut: "Zoom Out",
    setLightTheme: "Set Light Theme",
    setDarkTheme: "Set Dark Theme",
  };
  const text = byLocale(locale, {
    de: {
      navigation: "Navigation",
      actions: "Aktionen",
      view: "Ansicht",
      openCommands: "Commands öffnen",
      backToProjects: "Zur Projektübersicht",
      previousResource: "Vorherige Ressource",
      nextResource: "Nächste Ressource",
      createResource: "Neue Ressource erstellen",
      export: "Export",
      visualize: "Visualisieren",
      searchFormFields: "Formular durchsuchen",
      zoomIn: "Zoom vergrößern",
      zoomOut: "Zoom verkleinern",
      setLightTheme: "Helles Theme aktivieren",
      setDarkTheme: "Dunkles Theme aktivieren",
    },
    en: enText,
    fr: {
      ...enText,
      actions: "Actions",
      view: "Affichage",
      openCommands: "Ouvrir les commandes",
      backToProjects: "Retour aux projets",
      previousResource: "Ressource precedente",
      nextResource: "Ressource suivante",
      createResource: "Creer une ressource",
      visualize: "Visualiser",
      searchFormFields: "Rechercher dans le formulaire",
      zoomIn: "Zoom avant",
      zoomOut: "Zoom arriere",
      setLightTheme: "Activer le theme clair",
      setDarkTheme: "Activer le theme sombre",
    },
    es: {
      ...enText,
      view: "Vista",
      openCommands: "Abrir comandos",
      backToProjects: "Volver a proyectos",
      previousResource: "Recurso anterior",
      nextResource: "Siguiente recurso",
      createResource: "Crear recurso",
      visualize: "Visualizar",
      searchFormFields: "Buscar en el formulario",
      zoomIn: "Acercar",
      zoomOut: "Alejar",
      setLightTheme: "Activar tema claro",
      setDarkTheme: "Activar tema oscuro",
    },
    it: {
      ...enText,
      view: "Vista",
      openCommands: "Apri comandi",
      backToProjects: "Torna ai progetti",
      previousResource: "Risorsa precedente",
      nextResource: "Risorsa successiva",
      createResource: "Crea risorsa",
      visualize: "Visualizza",
      searchFormFields: "Cerca nel modulo",
      zoomIn: "Zoom avanti",
      zoomOut: "Zoom indietro",
      setLightTheme: "Attiva tema chiaro",
      setDarkTheme: "Attiva tema scuro",
    },
  });

  return [
    {
      id: "open-command-palette",
      label: text.openCommands,
      group: text.navigation,
      icon: CommandIcon,
      hidden: true,
      run: openPalette,
      shortcut: [
        { key: ".", preventDefault: true },
        { key: "k", mod: true, preventDefault: true },
      ],
    },
    {
      id: "go-to-projects",
      label: text.backToProjects,
      group: text.navigation,
      icon: Home,
      run: openProjects,
      keywords: ["overview", "home"],
    },
    {
      id: "previous-resource",
      label: text.previousResource,
      group: text.navigation,
      icon: ArrowLeft,
      run: navigateBack,
      disabled: !canNavigateBack,
      shortcut: { key: "[", preventDefault: true },
    },
    {
      id: "next-resource",
      label: text.nextResource,
      group: text.navigation,
      icon: ArrowRight,
      run: navigateForward,
      disabled: !canNavigateForward,
      shortcut: { key: "]", preventDefault: true },
    },
    {
      id: "create-resource",
      label: text.createResource,
      group: text.actions,
      icon: FilePlus2,
      run: createResource,
      shortcut: { key: "n", shift: true, preventDefault: true },
    },
    {
      id: "open-export",
      label: text.export,
      group: text.actions,
      icon: Download,
      run: openExport,
      shortcut: { key: "e", shift: true, preventDefault: true },
    },
    {
      id: "open-diagram",
      label: text.visualize,
      group: text.actions,
      icon: CommandIcon,
      run: openDiagram,
      shortcut: { key: "v", shift: true, preventDefault: true },
    },
    {
      id: "search-form-fields",
      label: text.searchFormFields,
      group: text.actions,
      icon: Search,
      run: focusFormSearch,
      keywords: ["search", "find", "filter", "fields", "formular", "suche"],
      shortcut: {
        key: "f",
        mod: true,
        allowInInput: true,
        preventDefault: true,
      },
    },
    {
      id: "zoom-in",
      label: text.zoomIn,
      group: text.view,
      icon: ZoomIn,
      run: zoomIn,
      shortcut: [
        { key: "=", preventDefault: true },
        { key: "+", shift: true, preventDefault: true },
      ],
    },
    {
      id: "zoom-out",
      label: text.zoomOut,
      group: text.view,
      icon: ZoomOut,
      run: zoomOut,
      shortcut: { key: "-", preventDefault: true },
    },
    {
      id: "theme-light",
      label: text.setLightTheme,
      group: text.view,
      icon: Sun,
      run: () => setTheme("light"),
      disabled: theme === "light",
    },
    {
      id: "theme-dark",
      label: text.setDarkTheme,
      group: text.view,
      icon: Moon,
      run: () => setTheme("dark"),
      disabled: theme === "dark",
    },
  ];
};
