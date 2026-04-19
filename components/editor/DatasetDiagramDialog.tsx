"use client";

import { useEffect, useMemo, useState } from "react";
import { useI18n } from "@/components/i18n/I18nProvider";
import { MermaidDiagramDialog } from "@/components/editor/MermaidDiagramDialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { SlidersHorizontal } from "lucide-react";
import type { DatasetResource } from "@/lib/datasets/content";
import { parseLocalReference } from "@/lib/fhir-editor/references";
import { byLocale } from "@/lib/i18n/select";

type DatasetDiagramDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  resources: DatasetResource[];
};

type DiagramFieldSelection = Record<string, string[]>;
type DiagramSettings = {
  compactLayout: boolean;
  hideIdWhenName: boolean;
  fieldSelection: DiagramFieldSelection;
};

const DIAGRAM_SETTINGS_KEY = "health-compose-diagram-settings";
const FIELD_VALUE_LIMIT = 48;
const FIELD_PREVIEW_LIMIT = 3;
const EXCLUDED_FIELDS = new Set(["resourceType", "id", "meta"]);
const DEFAULT_DIAGRAM_SETTINGS: DiagramSettings = {
  compactLayout: true,
  hideIdWhenName: false,
  fieldSelection: {},
};

const loadStoredDiagramSettings = (): DiagramSettings => {
  if (typeof window === "undefined") {
    return DEFAULT_DIAGRAM_SETTINGS;
  }
  const raw = window.localStorage.getItem(DIAGRAM_SETTINGS_KEY);
  if (!raw) return DEFAULT_DIAGRAM_SETTINGS;

  try {
    const parsed = JSON.parse(raw) as Partial<DiagramSettings>;
    return {
      compactLayout:
        typeof parsed.compactLayout === "boolean"
          ? parsed.compactLayout
          : DEFAULT_DIAGRAM_SETTINGS.compactLayout,
      hideIdWhenName:
        typeof parsed.hideIdWhenName === "boolean"
          ? parsed.hideIdWhenName
          : DEFAULT_DIAGRAM_SETTINGS.hideIdWhenName,
      fieldSelection:
        parsed.fieldSelection && typeof parsed.fieldSelection === "object"
          ? parsed.fieldSelection
          : DEFAULT_DIAGRAM_SETTINGS.fieldSelection,
    };
  } catch {
    return DEFAULT_DIAGRAM_SETTINGS;
  }
};

const sanitizeLabel = (value: string) =>
  value.replace(/"/g, "'").replace(/\\n/g, " ").replace(/\\r/g, " ");

const getResourceName = (resource: DatasetResource) => {
  const name = resource.content.name;
  if (typeof name === "string" && name.trim()) return name.trim();
  const title = resource.content.title;
  if (typeof title === "string" && title.trim()) return title.trim();
  return undefined;
};

const getResourceId = (resource: DatasetResource) => {
  const id = resource.content.id;
  if (typeof id === "string" && id.trim()) return id.trim();
  return resource.id;
};

const normalizeReference = (value: string) => {
  const local = parseLocalReference(value)?.key;
  if (local) return local;

  const trimmed = value.trim();
  if (!trimmed || trimmed.startsWith("#")) return null;
  const pathOnly = trimmed.split("?")[0]?.split("#")[0] ?? trimmed;
  const segments = pathOnly.split("/").filter(Boolean);
  if (segments.length < 2) return null;
  const type = segments[segments.length - 2];
  const id = segments[segments.length - 1];
  if (!type || !id) return null;
  return `${type}/${id}`;
};

const truncateValue = (value: string, limit = FIELD_VALUE_LIMIT) => {
  if (value.length <= limit) return value;
  return `${value.slice(0, Math.max(0, limit - 3))}...`;
};

const formatReferenceLabel = (value: string) => normalizeReference(value) ?? value;

const stringifyDisplayValue = (value: unknown): string | null => {
  if (value === null || value === undefined) return null;
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (Array.isArray(value)) {
    const entries = value
      .map((entry) => stringifyDisplayValue(entry))
      .filter((entry): entry is string => Boolean(entry));
    if (entries.length === 0) return null;
    const unique = Array.from(new Set(entries));
    const preview = unique.slice(0, FIELD_PREVIEW_LIMIT);
    const suffix = unique.length > FIELD_PREVIEW_LIMIT ? ", ..." : "";
    return `${preview.join(", ")}${suffix}`;
  }
  if (typeof value !== "object") return null;

  const record = value as Record<string, unknown>;
  if (typeof record.display === "string" && record.display.trim()) return record.display.trim();
  if (typeof record.text === "string" && record.text.trim()) return record.text.trim();
  if (
    typeof record.value === "string" ||
    typeof record.value === "number" ||
    typeof record.value === "boolean"
  ) {
    return String(record.value);
  }
  if (typeof record.code === "string" && record.code.trim()) return record.code.trim();
  if (typeof record.reference === "string" && record.reference.trim()) {
    return formatReferenceLabel(record.reference);
  }
  if (typeof record.id === "string" && record.id.trim()) return record.id.trim();

  if (Array.isArray(record.coding)) {
    const codingValue = stringifyDisplayValue(record.coding);
    if (codingValue) return codingValue;
  }

  if (Array.isArray(record.identifier)) {
    const identifierValue = stringifyDisplayValue(record.identifier);
    if (identifierValue) return identifierValue;
  }

  const family = typeof record.family === "string" ? record.family.trim() : "";
  const given = Array.isArray(record.given)
    ? record.given
        .filter((entry): entry is string => typeof entry === "string")
        .map((entry) => entry.trim())
        .filter(Boolean)
        .join(" ")
    : typeof record.given === "string"
      ? record.given.trim()
      : "";
  const humanName = [given, family].filter(Boolean).join(" ");
  if (humanName) return humanName;

  return null;
};

const getDisplayValue = (value: unknown) => {
  const raw = stringifyDisplayValue(value);
  if (!raw) return null;
  return truncateValue(raw);
};

const getFieldCandidates = (content: Record<string, unknown>) => {
  return Object.entries(content)
    .filter(([key]) => !EXCLUDED_FIELDS.has(key))
    .filter(([, value]) => Boolean(getDisplayValue(value)))
    .map(([key]) => key)
    .sort((a, b) => a.localeCompare(b));
};

const collectReferences = (
  value: unknown,
  path: string,
  output: Array<{ path: string; reference: string }>
) => {
  if (Array.isArray(value)) {
    for (const entry of value) {
      collectReferences(entry, path, output);
    }
    return;
  }
  if (!value || typeof value !== "object") return;

  const record = value as Record<string, unknown>;
  if (typeof record.reference === "string") {
    output.push({ path, reference: record.reference });
    return;
  }

  for (const [key, entry] of Object.entries(record)) {
    const nextPath = path ? `${path}.${key}` : key;
    collectReferences(entry, nextPath, output);
  }
};

const buildMermaidDefinition = (
  resources: DatasetResource[],
  selectedFieldsByType: DiagramFieldSelection,
  hideIdWhenName: boolean,
  emptyLabel: string
) => {
  if (resources.length === 0) {
    return `flowchart LR\n  empty["${sanitizeLabel(emptyLabel)}"]`;
  }

  const nodes = new Map<string, string>();
  const nodeLabels: string[] = [];
  const edges = new Set<string>();

  resources.forEach((resource, index) => {
    const id = getResourceId(resource);
    const name = getResourceName(resource);
    const key = `${resource.resourceType}/${id}`;
    const nodeId = `node_${index}`;
    nodes.set(key, nodeId);

    const selectedFields = selectedFieldsByType[resource.resourceType] ?? [];
    const fieldLines = selectedFields
      .map((field) => {
        const value = getDisplayValue(resource.content[field]);
        if (!value) return null;
        return `${field}: ${value}`;
      })
      .filter((line): line is string => Boolean(line));

    const labelParts = [
      resource.resourceType,
      hideIdWhenName && name ? null : id,
      name,
      ...fieldLines,
    ].filter(Boolean);
    const label = sanitizeLabel(labelParts.join("\\n"));
    nodeLabels.push(`${nodeId}["${label}"]`);
  });

  resources.forEach((resource) => {
    const fromId = nodes.get(`${resource.resourceType}/${getResourceId(resource)}`);
    if (!fromId) return;
    const references: Array<{ path: string; reference: string }> = [];
    collectReferences(resource.content, "", references);
    for (const ref of references) {
      const normalized = normalizeReference(ref.reference);
      if (!normalized) continue;
      const toId = nodes.get(normalized);
      if (!toId) continue;
      const label = ref.path ? sanitizeLabel(ref.path) : "";
      const edge = label
        ? `${fromId} -->|${label}| ${toId}`
        : `${fromId} --> ${toId}`;
      edges.add(edge);
    }
  });

  const lines = [
    "flowchart LR",
    "  classDef node fill:#f8fafc,stroke:#cbd5f5,color:#0f172a;",
    ...nodeLabels.map((line) => `  ${line}:::node`),
    ...Array.from(edges).map((line) => `  ${line}`),
  ];

  return lines.join("\n");
};

export const DatasetDiagramDialog = ({
  open,
  onOpenChange,
  resources,
}: DatasetDiagramDialogProps) => {
  const { locale } = useI18n();
  const [initialSettings] = useState<DiagramSettings>(loadStoredDiagramSettings);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [compactLayout, setCompactLayout] = useState(initialSettings.compactLayout);
  const [hideIdWhenName, setHideIdWhenName] = useState(initialSettings.hideIdWhenName);
  const [fieldSelection, setFieldSelection] = useState<DiagramFieldSelection>(
    initialSettings.fieldSelection
  );
  const enText = {
    noResourcesInDataset: "No resources in dataset",
    failedToRenderDiagram: "Failed to render diagram",
    title: "Dataset relations",
    toggleDiagramSettings: "Toggle diagram settings",
    settings: "Settings",
    diagramSettings: "Diagram settings",
    chooseFields: "Choose which fields appear on each resource type.",
    compactLayout: "Compact layout",
    hideIdWhenName: "Hide ID when name exists",
    resourcesOne: "resource",
    resourcesMany: "resources",
    noDisplayableFields: "No displayable fields found.",
    selectAll: "Select all",
    clear: "Clear",
    ariaZoomIn: "Zoom in",
    ariaZoomOut: "Zoom out",
    ariaResetZoom: "Reset zoom",
    ariaFitToView: "Fit to view",
    ariaDownloadDiagram: "Download diagram",
  };
  const text = byLocale(locale, {
    de: {
      noResourcesInDataset: "Keine Ressourcen im Dataset",
      failedToRenderDiagram: "Diagramm konnte nicht gerendert werden",
      title: "Dataset-Beziehungen",
      toggleDiagramSettings: "Diagramm-Einstellungen umschalten",
      settings: "Einstellungen",
      diagramSettings: "Diagramm-Einstellungen",
      chooseFields: "Wähle, welche Felder pro Ressourcentyp angezeigt werden.",
      compactLayout: "Kompaktes Layout",
      hideIdWhenName: "ID ausblenden, wenn Name vorhanden",
      resourcesOne: "Ressource",
      resourcesMany: "Ressourcen",
      noDisplayableFields: "Keine darstellbaren Felder gefunden.",
      selectAll: "Alle auswählen",
      clear: "Leeren",
      ariaZoomIn: "Vergrößern",
      ariaZoomOut: "Verkleinern",
      ariaResetZoom: "Zoom zurücksetzen",
      ariaFitToView: "Auf Ansicht anpassen",
      ariaDownloadDiagram: "Diagramm herunterladen",
    },
    en: enText,
    fr: {
      ...enText,
      title: "Relations du dataset",
      settings: "Parametres",
      diagramSettings: "Parametres du diagramme",
      compactLayout: "Mise en page compacte",
      hideIdWhenName: "Masquer l'ID si le nom existe",
      selectAll: "Tout selectionner",
      clear: "Effacer",
      ariaDownloadDiagram: "Telecharger le diagramme",
    },
    es: {
      ...enText,
      title: "Relaciones del dataset",
      settings: "Configuracion",
      diagramSettings: "Configuracion del diagrama",
      compactLayout: "Diseno compacto",
      hideIdWhenName: "Ocultar ID cuando hay nombre",
      selectAll: "Seleccionar todo",
      clear: "Limpiar",
      ariaDownloadDiagram: "Descargar diagrama",
    },
    it: {
      ...enText,
      title: "Relazioni dataset",
      settings: "Impostazioni",
      diagramSettings: "Impostazioni diagramma",
      compactLayout: "Layout compatto",
      hideIdWhenName: "Nascondi ID quando esiste il nome",
      selectAll: "Seleziona tutto",
      clear: "Pulisci",
      ariaDownloadDiagram: "Scarica diagramma",
    },
  });

  const resourcesByType = useMemo(() => {
    const map = new Map<string, DatasetResource[]>();
    for (const resource of resources) {
      const list = map.get(resource.resourceType) ?? [];
      list.push(resource);
      map.set(resource.resourceType, list);
    }
    return map;
  }, [resources]);

  const availableFieldsByType = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const [resourceType, list] of resourcesByType) {
      const fields = new Set<string>();
      for (const resource of list) {
        for (const field of getFieldCandidates(resource.content)) {
          fields.add(field);
        }
      }
      map.set(resourceType, Array.from(fields).sort((a, b) => a.localeCompare(b)));
    }
    return map;
  }, [resourcesByType]);

  const normalizedFieldSelection = useMemo(() => {
    const next: DiagramFieldSelection = {};
    for (const [resourceType, fields] of availableFieldsByType) {
      const selected = fieldSelection[resourceType] ?? [];
      const filtered = selected.filter((field) => fields.includes(field));
      if (filtered.length > 0) {
        next[resourceType] = filtered;
      }
    }
    return next;
  }, [availableFieldsByType, fieldSelection]);

  const diagram = useMemo(
    () =>
      buildMermaidDefinition(
        resources,
        normalizedFieldSelection,
        hideIdWhenName,
        text.noResourcesInDataset
      ),
    [resources, normalizedFieldSelection, hideIdWhenName, text.noResourcesInDataset]
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(
      DIAGRAM_SETTINGS_KEY,
      JSON.stringify({ compactLayout, hideIdWhenName, fieldSelection })
    );
  }, [compactLayout, fieldSelection, hideIdWhenName]);

  return (
    <MermaidDiagramDialog
      open={open}
      onOpenChange={onOpenChange}
      title={text.title}
      diagram={diagram}
      downloadFilename={`dataset-diagram-${new Date().toISOString().slice(0, 10)}.svg`}
      failedToRenderMessage={text.failedToRenderDiagram}
      ariaZoomIn={text.ariaZoomIn}
      ariaZoomOut={text.ariaZoomOut}
      ariaResetZoom={text.ariaResetZoom}
      ariaFitToView={text.ariaFitToView}
      ariaDownloadDiagram={text.ariaDownloadDiagram}
      nodeSpacing={compactLayout ? 20 : 40}
      rankSpacing={compactLayout ? 30 : 60}
      topRightSlot={
        <div className="absolute right-3 top-3 z-10 flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setSettingsOpen((prev) => !prev)}
            aria-expanded={settingsOpen}
            aria-label={text.toggleDiagramSettings}
            className="gap-1.5"
          >
            <SlidersHorizontal className="size-4" />
            <span className="hidden sm:inline">{text.settings}</span>
          </Button>
        </div>
      }
      overlaySlot={
        settingsOpen ? (
          <div className="absolute right-3 top-12 z-10 w-80 max-w-[90vw]">
            <div className="rounded-lg border border-foreground/10 bg-background/95 shadow-lg backdrop-blur">
              <div className="border-b border-foreground/10 px-3 py-2">
                <div className="text-sm font-semibold text-foreground">
                  {text.diagramSettings}
                </div>
                <div className="text-xs text-muted-foreground">
                  {text.chooseFields}
                </div>
              </div>
              <ScrollArea className="max-h-[calc(100dvh-9rem)]">
                <div className="grid gap-4 px-3 py-3">
                  <label className="flex items-center justify-between gap-3 text-sm">
                    <span>{text.compactLayout}</span>
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-foreground"
                      checked={compactLayout}
                      onChange={(event) => setCompactLayout(event.target.checked)}
                    />
                  </label>
                  <label className="flex items-center justify-between gap-3 text-sm">
                    <span>{text.hideIdWhenName}</span>
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-foreground"
                      checked={hideIdWhenName}
                      onChange={(event) => setHideIdWhenName(event.target.checked)}
                    />
                  </label>

                  {Array.from(resourcesByType.entries()).map(([resourceType, list]) => {
                    const availableFields = availableFieldsByType.get(resourceType) ?? [];
                    const selected = new Set(fieldSelection[resourceType] ?? []);
                    return (
                      <details
                        key={resourceType}
                        className="rounded-md border border-foreground/10 bg-background"
                        open
                      >
                        <summary className="cursor-pointer select-none px-3 py-2 text-sm font-semibold text-foreground">
                          {resourceType}
                          <span className="ml-2 text-xs font-normal text-muted-foreground">
                            {list.length} {list.length === 1 ? text.resourcesOne : text.resourcesMany}
                          </span>
                        </summary>
                        <div className="grid gap-2 px-3 pb-3">
                          {availableFields.length === 0 ? (
                            <div className="text-xs text-muted-foreground">
                              {text.noDisplayableFields}
                            </div>
                          ) : (
                            <div className="grid gap-2">
                              <div className="flex flex-wrap gap-2">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() =>
                                    setFieldSelection((prev) => ({
                                      ...prev,
                                      [resourceType]: [...availableFields],
                                    }))
                                  }
                                >
                                  {text.selectAll}
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() =>
                                    setFieldSelection((prev) => {
                                      const next = { ...prev };
                                      delete next[resourceType];
                                      return next;
                                    })
                                  }
                                >
                                  {text.clear}
                                </Button>
                              </div>
                              <div className="grid gap-1">
                                {availableFields.map((field) => (
                                  <label
                                    key={field}
                                    className="flex items-center gap-2 text-xs text-foreground"
                                  >
                                    <input
                                      type="checkbox"
                                      className="h-4 w-4 accent-foreground"
                                      checked={selected.has(field)}
                                      onChange={(event) => {
                                        const checked = event.target.checked;
                                        setFieldSelection((prev) => {
                                          const current = new Set(prev[resourceType] ?? []);
                                          if (checked) {
                                            current.add(field);
                                          } else {
                                            current.delete(field);
                                          }
                                          const next = { ...prev };
                                          if (current.size > 0) {
                                            next[resourceType] = Array.from(current);
                                          } else {
                                            delete next[resourceType];
                                          }
                                          return next;
                                        });
                                      }}
                                    />
                                    <span>{field}</span>
                                  </label>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </details>
                    );
                  })}
                </div>
              </ScrollArea>
            </div>
          </div>
        ) : null
      }
    />
  );
};
