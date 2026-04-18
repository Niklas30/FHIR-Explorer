"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import mermaid from "mermaid";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download, Maximize2, RefreshCcw, ZoomIn, ZoomOut } from "lucide-react";
import type { DatasetResource } from "@/lib/datasets/content";

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
  const trimmed = value.trim();
  if (!trimmed || trimmed.startsWith("#")) return null;
  const segments = trimmed.split("/").filter(Boolean);
  if (segments.length < 2) return null;
  const type = segments[segments.length - 2];
  const id = segments[segments.length - 1];
  if (!type || !id) return null;
  return `${type}/${id}`;
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

const buildMermaidDefinition = (resources: DatasetResource[]) => {
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

    const labelParts = [resource.resourceType, id, name].filter(Boolean);
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
  const containerRef = useRef<HTMLDivElement | null>(null);
  const panZoomRef = useRef<PanZoomInstance | null>(null);

  const diagram = useMemo(() => buildMermaidDefinition(resources), [resources]);

  useEffect(() => {
    if (!open) return;
    let active = true;

    mermaid.initialize({
      startOnLoad: false,
      securityLevel: "strict",
      theme: "neutral",
      flowchart: { htmlLabels: false },
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
  }, [diagram, open]);

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
