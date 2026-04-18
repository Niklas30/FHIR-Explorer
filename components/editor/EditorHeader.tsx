 "use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Download, Moon, Settings2, Sun, ZoomIn, ZoomOut } from "lucide-react";

type EditorHeaderProps = {
  datasetName: string;
  datasetId: string;
  projectKey?: string;
  onCreateResource: () => void;
  onOpenDiagram: () => void;
  onOpenExport: () => void;
  theme: "light" | "dark";
  onThemeChange: (theme: "light" | "dark") => void;
  zoomLabel: string;
  onZoomIn: () => void;
  onZoomOut: () => void;
};

export const EditorHeader = ({
  datasetName,
  datasetId,
  projectKey,
  onCreateResource,
  onOpenDiagram,
  onOpenExport,
  theme,
  onThemeChange,
  zoomLabel,
  onZoomIn,
  onZoomOut,
}: EditorHeaderProps) => {
  return (
    <header className="border-b border-foreground/10 bg-background/90 px-6 py-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <Link href="/editor" className="text-sm font-medium text-foreground">
              Projects
            </Link>
            <span>/</span>
            <span className="text-sm">{datasetName}</span>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold text-foreground">{datasetName}</h1>
            <Badge variant="outline">{datasetId}</Badge>
            {projectKey ? <Badge variant="secondary">{projectKey}</Badge> : null}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button asChild variant="outline">
            <Link href="/editor">Back to projects</Link>
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline">
                <Settings2 className="size-4" />
                View
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-[200px]">
              <DropdownMenuLabel>Zoom</DropdownMenuLabel>
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
              <DropdownMenuLabel>Theme</DropdownMenuLabel>
              <DropdownMenuItem
                onClick={() => onThemeChange("light")}
                className={theme === "light" ? "font-semibold" : undefined}
              >
                <Sun className="size-4" />
                Light
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => onThemeChange("dark")}
                className={theme === "dark" ? "font-semibold" : undefined}
              >
                <Moon className="size-4" />
                Dark
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button variant="outline" onClick={onOpenDiagram}>
            Visualize
          </Button>
          <Button variant="outline" onClick={onOpenExport} className="gap-1.5">
            <Download className="size-4" />
            Export
          </Button>
        </div>
      </div>
    </header>
  );
};
