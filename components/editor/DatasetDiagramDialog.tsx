"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import mermaid from "mermaid";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Download, Maximize2, RefreshCcw, SlidersHorizontal, ZoomIn, ZoomOut } from "lucide-react";
import type { DatasetResource } from "@/lib/datasets/content";
import { parseLocalReference } from "@/lib/fhir-editor/references";

type DatasetDiagramDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  resources: DatasetResource[];
};

type PanZoomInstance = {
  destroy: () => void;
  zoomIn: () => void;
  zoomOut: () => void;
  resetZoom: () => void;
  fit: () => void;
  center: () => void;
};

type DiagramFieldSelection = Record<string, string[]>;

const DIAGRAM_SETTINGS_KEY = "fhir-explorer-diagram-settings";
const FIELD_VALUE_LIMIT = 48;
const FIELD_PREVIEW_LIMIT = 3;
const EXCLUDED_FIELDS = new Set(["resourceType", "id", "meta"]);

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
  hideIdWhenName: boolean
) => {
  if (resources.length === 0) {
    return "flowchart LR\n  empty[\"No resources in dataset\"]";
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
  const [svg, setSvg] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [compactLayout, setCompactLayout] = useState(true);
  const [hideIdWhenName, setHideIdWhenName] = useState(false);
  const [fieldSelection, setFieldSelection] = useState<DiagramFieldSelection>({});
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const panZoomRef = useRef<PanZoomInstance | null>(null);

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
    () => buildMermaidDefinition(resources, normalizedFieldSelection, hideIdWhenName),
    [resources, normalizedFieldSelection, hideIdWhenName]
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    const raw = window.localStorage.getItem(DIAGRAM_SETTINGS_KEY);
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as Partial<{
          compactLayout: boolean;
          hideIdWhenName: boolean;
          fieldSelection: DiagramFieldSelection;
        }>;
        if (typeof parsed.compactLayout === "boolean") {
          setCompactLayout(parsed.compactLayout);
        }
        if (typeof parsed.hideIdWhenName === "boolean") {
          setHideIdWhenName(parsed.hideIdWhenName);
        }
        if (parsed.fieldSelection && typeof parsed.fieldSelection === "object") {
          setFieldSelection(parsed.fieldSelection);
        }
      } catch {
        // ignore invalid stored settings
      }
    }
    setSettingsLoaded(true);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!settingsLoaded) return;
    window.localStorage.setItem(
      DIAGRAM_SETTINGS_KEY,
      JSON.stringify({ compactLayout, hideIdWhenName, fieldSelection })
    );
  }, [compactLayout, fieldSelection, hideIdWhenName, settingsLoaded]);

  useEffect(() => {
    if (!open) return;
    let active = true;

    mermaid.initialize({
      startOnLoad: false,
      securityLevel: "strict",
      theme: "neutral",
      flowchart: {
        htmlLabels: false,
        nodeSpacing: compactLayout ? 20 : 40,
        rankSpacing: compactLayout ? 30 : 60,
        useMaxWidth: false,
      },
    });

    const renderDiagram = async () => {
      try {
        const { svg: nextSvg } = await mermaid.render(
          `diagram-${Date.now()}`,
          diagram
        );
        if (active) {
          setSvg(nextSvg);
          setError(null);
        }
      } catch (err) {
        if (active) {
          setError(err instanceof Error ? err.message : "Failed to render diagram");
        }
      }
    };

    renderDiagram();

    return () => {
      active = false;
    };
  }, [compactLayout, diagram, open]);

  useEffect(() => {
    if (!open) return;
    if (!containerRef.current) return;
    const svgElement = containerRef.current.querySelector("svg");
    if (!svgElement) return;

    if (panZoomRef.current) {
      panZoomRef.current.destroy();
      panZoomRef.current = null;
    }

    svgElement.setAttribute("width", "100%");
    svgElement.setAttribute("height", "100%");
    svgElement.style.width = "100%";
    svgElement.style.height = "100%";
    svgElement.style.maxWidth = "none";
    svgElement.style.maxHeight = "none";

    let active = true;
    const setupPanZoom = async () => {
      const mod = (await import("svg-pan-zoom")) as unknown as {
        default: (
          element: SVGSVGElement,
          options: Record<string, unknown>
        ) => PanZoomInstance;
      };
      if (!active) return;
      panZoomRef.current = mod.default(svgElement as SVGSVGElement, {
        zoomEnabled: true,
        controlIconsEnabled: false,
        fit: true,
        center: true,
        minZoom: 0.2,
        maxZoom: 10,
      });
    };
    setupPanZoom();

    return () => {
      active = false;
      if (panZoomRef.current) {
        panZoomRef.current.destroy();
        panZoomRef.current = null;
      }
    };
  }, [open, svg]);

  const handleDownload = () => {
    if (typeof window === "undefined") return;
    if (!svg) return;
    const blob = new Blob([svg], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `dataset-diagram-${new Date().toISOString().slice(0, 10)}.svg`;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="fixed inset-4 flex h-[calc(100dvh-2rem)] w-[calc(100dvw-2rem)] max-w-none translate-x-0 translate-y-0 flex-col gap-4 rounded-lg p-0 sm:max-w-none">
        <div className="relative h-full w-full rounded-lg border border-foreground/10 bg-background">
          <div className="absolute inset-4 overflow-hidden rounded-md bg-background">
            <div className="pointer-events-none absolute left-3 top-3 z-10">
              <DialogTitle className="text-lg">Dataset relations</DialogTitle>
            </div>

            <div className="absolute right-3 top-3 z-10 flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setSettingsOpen((prev) => !prev)}
                aria-expanded={settingsOpen}
                aria-label="Toggle diagram settings"
                className="gap-1.5"
              >
                <SlidersHorizontal className="size-4" />
                <span className="hidden sm:inline">Settings</span>
              </Button>
            </div>

            {settingsOpen ? (
              <div className="absolute right-3 top-12 z-10 w-80 max-w-[90vw]">
                <div className="rounded-lg border border-foreground/10 bg-background/95 shadow-lg backdrop-blur">
                  <div className="border-b border-foreground/10 px-3 py-2">
                    <div className="text-sm font-semibold text-foreground">
                      Diagram settings
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Choose which fields appear on each resource type.
                    </div>
                  </div>
                  <ScrollArea className="max-h-[calc(100dvh-9rem)]">
                    <div className="grid gap-4 px-3 py-3">
                      <label className="flex items-center justify-between gap-3 text-sm">
                        <span>Compact layout</span>
                        <input
                          type="checkbox"
                          className="h-4 w-4 accent-foreground"
                          checked={compactLayout}
                          onChange={(event) => setCompactLayout(event.target.checked)}
                        />
                      </label>
                      <label className="flex items-center justify-between gap-3 text-sm">
                        <span>Hide ID when name exists</span>
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
                                {list.length} resource{list.length === 1 ? "" : "s"}
                              </span>
                            </summary>
                            <div className="grid gap-2 px-3 pb-3">
                              {availableFields.length === 0 ? (
                                <div className="text-xs text-muted-foreground">
                                  No displayable fields found.
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
                                      Select all
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
                                      Clear
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
            ) : null}

            <div className="absolute left-3 top-1/2 z-10 flex -translate-y-1/2 flex-col gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => panZoomRef.current?.zoomIn()}
                aria-label="Zoom in"
              >
                <ZoomIn className="size-4" />
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => panZoomRef.current?.zoomOut()}
                aria-label="Zoom out"
              >
                <ZoomOut className="size-4" />
              </Button>
            </div>

            <div className="absolute right-3 top-1/2 z-10 flex -translate-y-1/2 flex-col gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  if (!panZoomRef.current) return;
                  panZoomRef.current.resetZoom();
                  panZoomRef.current.fit();
                  panZoomRef.current.center();
                }}
                aria-label="Reset zoom"
              >
                <RefreshCcw className="size-4" />
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  if (!panZoomRef.current) return;
                  panZoomRef.current.fit();
                  panZoomRef.current.center();
                }}
                aria-label="Fit to view"
              >
                <Maximize2 className="size-4" />
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={handleDownload}
                aria-label="Download diagram"
              >
                <Download className="size-4" />
              </Button>
            </div>

            <div className="absolute inset-0">
              {error ? (
                <div className="p-4 text-sm text-destructive">{error}</div>
              ) : (
                <div
                  ref={containerRef}
                  className="h-full w-full overflow-hidden [&_svg]:h-full [&_svg]:w-full [&_svg]:max-w-none [&_svg]:max-h-none"
                  dangerouslySetInnerHTML={{ __html: svg }}
                />
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
