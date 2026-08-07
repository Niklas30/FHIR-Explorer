"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import mermaid from "mermaid";
import { buildMermaidConfig } from "@/lib/mermaid-theme";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Download, Maximize2, RefreshCcw, ZoomIn, ZoomOut } from "lucide-react";

type PanZoomInstance = {
  destroy: () => void;
  zoomIn: () => void;
  zoomOut: () => void;
  resetZoom: () => void;
  fit: () => void;
  center: () => void;
};

type MermaidDiagramDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  diagram: string;
  downloadFilename: string;
  failedToRenderMessage: string;
  ariaZoomIn: string;
  ariaZoomOut: string;
  ariaResetZoom: string;
  ariaFitToView: string;
  ariaDownloadDiagram: string;
  nodeSpacing: number;
  rankSpacing: number;
  topRightSlot?: ReactNode;
  overlaySlot?: ReactNode;
};

export const MermaidDiagramDialog = ({
  open,
  onOpenChange,
  title,
  description,
  diagram,
  downloadFilename,
  failedToRenderMessage,
  ariaZoomIn,
  ariaZoomOut,
  ariaResetZoom,
  ariaFitToView,
  ariaDownloadDiagram,
  nodeSpacing,
  rankSpacing,
  topRightSlot,
  overlaySlot,
}: MermaidDiagramDialogProps) => {
  const [svg, setSvg] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const panZoomRef = useRef<PanZoomInstance | null>(null);

  useEffect(() => {
    if (!open) return;
    let active = true;

    mermaid.initialize(buildMermaidConfig({ nodeSpacing, rankSpacing }));

    const renderDiagram = async () => {
      try {
        const { svg: nextSvg } = await mermaid.render(
          `diagram-${Date.now()}`,
          diagram
        );
        if (!active) return;
        setSvg(nextSvg);
        setError(null);
      } catch (err) {
        if (!active) return;
        setError(err instanceof Error ? err.message : failedToRenderMessage);
      }
    };

    renderDiagram();

    return () => {
      active = false;
    };
  }, [diagram, failedToRenderMessage, nodeSpacing, open, rankSpacing]);

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
      const mod = await import("svg-pan-zoom");
      if (!active) return;
      panZoomRef.current = mod.default(svgElement, {
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
    anchor.download = downloadFilename;
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
              <DialogTitle className="text-lg">{title}</DialogTitle>
              {description ? (
                <p className="mt-1 text-xs text-muted-foreground">{description}</p>
              ) : null}
            </div>

            {topRightSlot}
            {overlaySlot}

            <div className="absolute left-3 top-1/2 z-10 flex -translate-y-1/2 flex-col gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => panZoomRef.current?.zoomIn()}
                aria-label={ariaZoomIn}
              >
                <ZoomIn className="size-4" />
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => panZoomRef.current?.zoomOut()}
                aria-label={ariaZoomOut}
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
                aria-label={ariaResetZoom}
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
                aria-label={ariaFitToView}
              >
                <Maximize2 className="size-4" />
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={handleDownload}
                aria-label={ariaDownloadDiagram}
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
                  className="h-full w-full overflow-hidden [&_svg]:h-full [&_svg]:w-full [&_svg]:max-h-none [&_svg]:max-w-none"
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
