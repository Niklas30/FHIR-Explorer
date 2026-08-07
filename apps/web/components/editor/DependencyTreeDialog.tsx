"use client";

import { useMemo } from "react";
import { useI18n } from "@/components/i18n/I18nProvider";
import { MermaidDiagramDialog } from "@/components/editor/MermaidDiagramDialog";
import type { DependencyGraph } from "@/lib/fhir-importer/dependency-graph";
import { buildDependencyMermaid } from "@/lib/fhir-importer/dependency-mermaid";
import { byLocale } from "@/lib/i18n/select";

type DependencyTreeDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  graph: DependencyGraph;
  rootProjectKey: string | null;
};

const formatText = (template: string, values: Record<string, string | number>) =>
  template.replace(/\{(\w+)\}/g, (_, key) => String(values[key] ?? ""));

const toSafeFilename = (value: string) =>
  value
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+/, "")
    .replace(/-+$/, "");

export const DependencyTreeDialog = ({
  open,
  onOpenChange,
  graph,
  rootProjectKey,
}: DependencyTreeDialogProps) => {
  const { locale } = useI18n();

  const enText = {
    title: "Dependency tree",
    description: "Visualized dependency tree for {project}.",
    noProjectSelected: "No project selected.",
    noDependencies: "No dependencies found.",
    projectNotImported: "Project not imported in local storage.",
    failedToRenderDiagram: "Failed to render dependency tree.",
    ariaZoomIn: "Zoom in",
    ariaZoomOut: "Zoom out",
    ariaResetZoom: "Reset zoom",
    ariaFitToView: "Fit to view",
    ariaDownloadDiagram: "Download dependency tree",
    downloadPrefix: "dependency-tree",
  };
  const text = byLocale(locale, {
    de: {
      ...enText,
      title: "Abhängigkeitsbaum",
      description: "Visualisierter Abhängigkeitsbaum für {project}.",
      noProjectSelected: "Kein Projekt ausgewählt.",
      noDependencies: "Keine Abhängigkeiten gefunden.",
      projectNotImported: "Projekt ist lokal nicht importiert.",
      failedToRenderDiagram: "Abhängigkeitsbaum konnte nicht gerendert werden.",
      ariaZoomIn: "Vergrößern",
      ariaZoomOut: "Verkleinern",
      ariaResetZoom: "Zoom zurücksetzen",
      ariaFitToView: "Auf Ansicht anpassen",
      ariaDownloadDiagram: "Abhängigkeitsbaum herunterladen",
      downloadPrefix: "abhaengigkeitsbaum",
    },
    en: enText,
    fr: {
      ...enText,
      title: "Arbre des dependances",
      ariaDownloadDiagram: "Telecharger l'arbre des dependances",
    },
    es: {
      ...enText,
      title: "Arbol de dependencias",
      ariaDownloadDiagram: "Descargar arbol de dependencias",
    },
    it: {
      ...enText,
      title: "Albero delle dipendenze",
      ariaDownloadDiagram: "Scarica albero delle dipendenze",
    },
  });

  const diagramData = useMemo(
    () => buildDependencyMermaid(graph, rootProjectKey, text),
    [graph, rootProjectKey, text]
  );

  const rootName = rootProjectKey ? toSafeFilename(rootProjectKey) : "project";
  return (
    <MermaidDiagramDialog
      open={open}
      onOpenChange={onOpenChange}
      title={text.title}
      description={formatText(text.description, { project: diagramData.rootLabel })}
      diagram={diagramData.diagram}
      downloadFilename={`${text.downloadPrefix}-${rootName}.svg`}
      failedToRenderMessage={text.failedToRenderDiagram}
      ariaZoomIn={text.ariaZoomIn}
      ariaZoomOut={text.ariaZoomOut}
      ariaResetZoom={text.ariaResetZoom}
      ariaFitToView={text.ariaFitToView}
      ariaDownloadDiagram={text.ariaDownloadDiagram}
      nodeSpacing={32}
      rankSpacing={44}
    />
  );
};
