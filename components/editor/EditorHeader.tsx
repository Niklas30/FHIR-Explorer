"use client";

import Link from "next/link";
import { useI18n } from "@/components/i18n/I18nProvider";
import { LanguageMenuSub } from "@/components/i18n/LanguageSwitcher";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ChevronLeft,
  ChevronRight,
  Command,
  Download,
  Info,
  MoreHorizontal,
  Moon,
  Settings2,
  Sun,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { byLocale } from "@/lib/i18n/select";

type EditorHeaderProps = {
  datasetName: string;
  onOpenDiagram: () => void;
  onOpenExport: () => void;
  onOpenDatasetInfo: () => void;
  theme: "light" | "dark";
  onThemeChange: (theme: "light" | "dark") => void;
  zoomLabel: string;
  onZoomIn: () => void;
  onZoomOut: () => void;
  canNavigateBack: boolean;
  canNavigateForward: boolean;
  onNavigateBack: () => void;
  onNavigateForward: () => void;
  onOpenCommands: () => void;
};

type ViewMenuProps = {
  theme: "light" | "dark";
  zoomLabel: string;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onThemeChange: (theme: "light" | "dark") => void;
  compactTrigger?: boolean;
};

const ViewMenu = ({
  theme,
  zoomLabel,
  onZoomIn,
  onZoomOut,
  onThemeChange,
  compactTrigger = false,
}: ViewMenuProps) => {
  const { locale } = useI18n();
  const text = byLocale(locale, {
    de: {
      view: "Ansicht",
      zoom: "Zoom",
      theme: "Theme",
      language: "Sprache",
      light: "Hell",
      dark: "Dunkel",
      ariaViewOptions: "Ansichtsoptionen",
    },
    en: {
      view: "View",
      zoom: "Zoom",
      theme: "Theme",
      language: "Language",
      light: "Light",
      dark: "Dark",
      ariaViewOptions: "View options",
    },
    fr: {
      view: "Affichage",
      zoom: "Zoom",
      theme: "Thème",
      language: "Langue",
      light: "Clair",
      dark: "Sombre",
      ariaViewOptions: "Options d'affichage",
    },
    es: {
      view: "Vista",
      zoom: "Zoom",
      theme: "Tema",
      language: "Idioma",
      light: "Claro",
      dark: "Oscuro",
      ariaViewOptions: "Opciones de vista",
    },
    it: {
      view: "Vista",
      zoom: "Zoom",
      theme: "Tema",
      language: "Lingua",
      light: "Chiaro",
      dark: "Scuro",
      ariaViewOptions: "Opzioni vista",
    },
  });

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {compactTrigger ? (
          <Button variant="outline" size="icon-sm" aria-label={text.ariaViewOptions}>
            <Settings2 className="size-4" />
          </Button>
        ) : (
          <Button variant="outline">
            <Settings2 className="size-4" />
            {text.view}
          </Button>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[200px]">
        <DropdownMenuLabel>{text.zoom}</DropdownMenuLabel>
        <div className="flex items-center gap-2 px-2 py-1.5">
          <Button size="sm" variant="outline" onClick={onZoomOut}>
            <ZoomOut className="size-4" />
          </Button>
          <div className="text-xs text-muted-foreground">{zoomLabel}</div>
          <Button size="sm" variant="outline" onClick={onZoomIn}>
            <ZoomIn className="size-4" />
          </Button>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuLabel>{text.theme}</DropdownMenuLabel>
        <DropdownMenuItem
          onClick={() => onThemeChange("light")}
          className={theme === "light" ? "font-semibold" : undefined}
        >
          <Sun className="size-4" />
          {text.light}
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => onThemeChange("dark")}
          className={theme === "dark" ? "font-semibold" : undefined}
        >
          <Moon className="size-4" />
          {text.dark}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuLabel>{text.language}</DropdownMenuLabel>
        <LanguageMenuSub />
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export const EditorHeader = ({
  datasetName,
  onOpenDiagram,
  onOpenExport,
  onOpenDatasetInfo,
  theme,
  onThemeChange,
  zoomLabel,
  onZoomIn,
  onZoomOut,
  canNavigateBack,
  canNavigateForward,
  onNavigateBack,
  onNavigateForward,
  onOpenCommands,
}: EditorHeaderProps) => {
  const { locale } = useI18n();
  const text = byLocale(locale, {
    de: {
      projects: "Projekte",
      previousResource: "Vorherige Ressource",
      nextResource: "Nächste Ressource",
      openCommands: "Commands öffnen",
      commands: "Commands",
      datasetInfo: "Dataset-Info",
      visualize: "Visualisieren",
      export: "Export",
      moreActions: "Mehr Aktionen",
      actions: "Aktionen",
    },
    en: {
      projects: "Projects",
      previousResource: "Previous resource",
      nextResource: "Next resource",
      openCommands: "Open commands",
      commands: "Commands",
      datasetInfo: "Dataset Info",
      visualize: "Visualize",
      export: "Export",
      moreActions: "More actions",
      actions: "Actions",
    },
    fr: {
      projects: "Projets",
      previousResource: "Ressource précédente",
      nextResource: "Ressource suivante",
      openCommands: "Ouvrir les commandes",
      commands: "Commandes",
      datasetInfo: "Infos du dataset",
      visualize: "Visualiser",
      export: "Exporter",
      moreActions: "Plus d'actions",
      actions: "Actions",
    },
    es: {
      projects: "Proyectos",
      previousResource: "Recurso anterior",
      nextResource: "Siguiente recurso",
      openCommands: "Abrir comandos",
      commands: "Comandos",
      datasetInfo: "Info del dataset",
      visualize: "Visualizar",
      export: "Exportar",
      moreActions: "Más acciones",
      actions: "Acciones",
    },
    it: {
      projects: "Progetti",
      previousResource: "Risorsa precedente",
      nextResource: "Risorsa successiva",
      openCommands: "Apri comandi",
      commands: "Comandi",
      datasetInfo: "Info dataset",
      visualize: "Visualizza",
      export: "Esporta",
      moreActions: "Altre azioni",
      actions: "Azioni",
    },
  });

  return (
    <header className="border-b border-foreground/10 bg-background/90 px-3 py-3 sm:px-6 sm:py-4">
      <div className="flex min-w-0 items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-2 text-sm text-muted-foreground">
            <Link href="/" className="text-sm font-medium text-foreground">
              {text.projects}
            </Link>
            <span>/</span>
            <span className="truncate text-sm font-semibold text-foreground sm:text-base">
              {datasetName}
            </span>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            aria-label={text.previousResource}
            title={text.previousResource}
            disabled={!canNavigateBack}
            onClick={onNavigateBack}
          >
            <ChevronLeft className="size-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            aria-label={text.nextResource}
            title={text.nextResource}
            disabled={!canNavigateForward}
            onClick={onNavigateForward}
          >
            <ChevronRight className="size-4" />
          </Button>

          <Button
            variant="outline"
            className="hidden gap-1.5 lg:inline-flex"
            onClick={onOpenCommands}
          >
            <Command className="size-4" />
            {text.commands}
            <span className="text-xs text-muted-foreground">.</span>
          </Button>
          <Button
            variant="outline"
            size="icon-sm"
            className="lg:hidden"
            onClick={onOpenCommands}
            aria-label={text.openCommands}
            title={`${text.openCommands} (.)`}
          >
            <Command className="size-4" />
          </Button>

          <div className="hidden items-center gap-2 lg:flex">
            <Button variant="outline" onClick={onOpenDatasetInfo} className="gap-1.5">
              <Info className="size-4" />
              {text.datasetInfo}
            </Button>
            <Button variant="outline" onClick={onOpenDiagram}>
              {text.visualize}
            </Button>
            <Button variant="outline" onClick={onOpenExport} className="gap-1.5">
              <Download className="size-4" />
              {text.export}
            </Button>
            <ViewMenu
              theme={theme}
              zoomLabel={zoomLabel}
              onZoomIn={onZoomIn}
              onZoomOut={onZoomOut}
              onThemeChange={onThemeChange}
            />
          </div>

          <div className="lg:hidden">
            <ViewMenu
              theme={theme}
              zoomLabel={zoomLabel}
              onZoomIn={onZoomIn}
              onZoomOut={onZoomOut}
              onThemeChange={onThemeChange}
              compactTrigger
            />
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="icon-sm"
                className="lg:hidden"
                aria-label={text.moreActions}
              >
                <MoreHorizontal className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-[220px]">
              <DropdownMenuLabel>{text.actions}</DropdownMenuLabel>
              <DropdownMenuItem onClick={onOpenDatasetInfo}>
                <Info className="size-4" />
                {text.datasetInfo}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onOpenDiagram}>{text.visualize}</DropdownMenuItem>
              <DropdownMenuItem onClick={onOpenExport}>
                <Download className="size-4" />
                {text.export}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
};
