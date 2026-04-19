 "use client";

import Link from "next/link";
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
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {compactTrigger ? (
          <Button variant="outline" size="icon-sm" aria-label="View options">
            <Settings2 className="size-4" />
          </Button>
        ) : (
          <Button variant="outline">
            <Settings2 className="size-4" />
            View
          </Button>
        )}
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
  return (
    <header className="border-b border-foreground/10 bg-background/90 px-3 py-3 sm:px-6 sm:py-4">
      <div className="flex min-w-0 items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-2 text-sm text-muted-foreground">
            <Link href="/" className="text-sm font-medium text-foreground">
              Projects
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
            aria-label="Previous resource"
            title="Previous resource"
            disabled={!canNavigateBack}
            onClick={onNavigateBack}
          >
            <ChevronLeft className="size-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            aria-label="Next resource"
            title="Next resource"
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
            Commands
            <span className="text-xs text-muted-foreground">.</span>
          </Button>
          <Button
            variant="outline"
            size="icon-sm"
            className="lg:hidden"
            onClick={onOpenCommands}
            aria-label="Open commands"
            title="Open commands (.)"
          >
            <Command className="size-4" />
          </Button>

          <div className="hidden items-center gap-2 lg:flex">
            <Button variant="outline" onClick={onOpenDatasetInfo} className="gap-1.5">
              <Info className="size-4" />
              Dataset Info
            </Button>
            <Button variant="outline" onClick={onOpenDiagram}>
              Visualize
            </Button>
            <Button variant="outline" onClick={onOpenExport} className="gap-1.5">
              <Download className="size-4" />
              Export
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
              <Button variant="outline" size="icon-sm" className="lg:hidden" aria-label="More actions">
                <MoreHorizontal className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-[220px]">
              <DropdownMenuLabel>Actions</DropdownMenuLabel>
              <DropdownMenuItem onClick={onOpenDatasetInfo}>
                <Info className="size-4" />
                Dataset Info
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onOpenDiagram}>Visualize</DropdownMenuItem>
              <DropdownMenuItem onClick={onOpenExport}>
                <Download className="size-4" />
                Export
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
};
