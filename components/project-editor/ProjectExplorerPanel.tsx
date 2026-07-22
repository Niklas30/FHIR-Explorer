"use client";

import Link from "next/link";
import { useMemo } from "react";
import {
  FileCog,
  Puzzle,
  ListTree,
  Library,
  FlaskConical,
  Database,
  Settings2,
  GitFork,
  LayoutDashboard,
  AlertTriangle,
  Plus,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import type { AuthoredResource, AuthoredResourceKind } from "@/lib/projects/types";
import { resourceLabel } from "@/lib/projects/content";
import type { DatasetRecord } from "@/lib/datasets/storage";
import type { ProjectNodeSelection } from "@/components/project-editor/project-editor/useProjectState";
import type { ProjectEditorText } from "@/components/project-editor/project-editor/text";

type SectionDef = {
  kind: AuthoredResourceKind;
  label: string;
  icon: typeof FileCog;
};

type Props = {
  text: ProjectEditorText;
  resources: AuthoredResource[];
  datasets: DatasetRecord[];
  selection: ProjectNodeSelection;
  onSelect: (selection: ProjectNodeSelection) => void;
  onAdd: (kind: AuthoredResourceKind) => void;
  onRemove: (resourceId: string) => void;
  readOnly?: boolean;
  issueCount?: number;
};

const NavButton = ({
  active,
  icon: Icon,
  label,
  onClick,
}: {
  active: boolean;
  icon: typeof FileCog;
  label: string;
  onClick: () => void;
}) => (
  <button
    type="button"
    onClick={onClick}
    className={cn(
      "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-foreground/80 hover:bg-muted/60",
      active && "bg-muted font-medium text-foreground"
    )}
  >
    <Icon className="size-4 shrink-0" />
    <span className="truncate">{label}</span>
  </button>
);

export const ProjectExplorerPanel = ({
  text,
  resources,
  datasets,
  selection,
  onSelect,
  onAdd,
  onRemove,
  readOnly = false,
  issueCount = 0,
}: Props) => {
  const sections: SectionDef[] = useMemo(
    () => [
      { kind: "profile", label: text.sectionProfiles, icon: FileCog },
      { kind: "extension", label: text.sectionExtensions, icon: Puzzle },
      { kind: "valueset", label: text.sectionValueSets, icon: ListTree },
      { kind: "codesystem", label: text.sectionCodeSystems, icon: Library },
      { kind: "example", label: text.sectionExamples, icon: FlaskConical },
    ],
    [text]
  );

  const byKind = useMemo(() => {
    const map = new Map<AuthoredResourceKind, AuthoredResource[]>();
    for (const resource of resources) {
      const list = map.get(resource.kind) ?? [];
      list.push(resource);
      map.set(resource.kind, list);
    }
    return map;
  }, [resources]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="border-b border-foreground/10 px-3 py-3">
        <div className="text-sm font-semibold text-foreground">{text.explorerTitle}</div>
      </div>
      <ScrollArea className="min-h-0 flex-1">
        <div className="grid gap-1 p-2">
          <NavButton
            active={selection.kind === "dashboard"}
            icon={LayoutDashboard}
            label={text.nodeDashboard}
            onClick={() => onSelect({ kind: "dashboard" })}
          />
          <button
            type="button"
            onClick={() => onSelect({ kind: "issues" })}
            className={cn(
              "flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-sm text-foreground/80 hover:bg-muted/60",
              selection.kind === "issues" && "bg-muted font-medium text-foreground"
            )}
          >
            <span className="flex items-center gap-2">
              <AlertTriangle className="size-4 shrink-0" />
              <span className="truncate">{text.nodeIssues}</span>
            </span>
            {issueCount > 0 ? (
              <span className="rounded-full bg-amber-500/20 px-1.5 text-xs font-medium text-amber-700 dark:text-amber-400">
                {issueCount}
              </span>
            ) : null}
          </button>
          <NavButton
            active={selection.kind === "manifest"}
            icon={Settings2}
            label={text.nodeManifest}
            onClick={() => onSelect({ kind: "manifest" })}
          />
          <NavButton
            active={selection.kind === "dependencies"}
            icon={GitFork}
            label={text.nodeDependencies}
            onClick={() => onSelect({ kind: "dependencies" })}
          />

          {sections.map((section) => {
            const items = byKind.get(section.kind) ?? [];
            return (
              <div key={section.kind} className="mt-2">
                <div className="flex items-center justify-between gap-1 px-2 py-1">
                  <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    <section.icon className="size-3.5" />
                    {section.label}
                    <span className="text-[10px] font-normal">({items.length})</span>
                  </span>
                  {readOnly ? null : (
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      aria-label={`${text.addResource} ${section.label}`}
                      title={`${text.addResource} ${section.label}`}
                      onClick={() => onAdd(section.kind)}
                    >
                      <Plus className="size-4" />
                    </Button>
                  )}
                </div>
                {items.length === 0 ? (
                  <p className="px-3 py-1 text-xs text-muted-foreground">{text.emptySection}</p>
                ) : (
                  <div className="grid gap-0.5">
                    {items.map((resource) => {
                      const active =
                        selection.kind === "resource" && selection.resourceId === resource.id;
                      const label = resourceLabel(resource);
                      return (
                        <div
                          key={resource.id}
                          className={cn(
                            "group flex items-center gap-1 rounded-md pl-2 pr-1 hover:bg-muted/60",
                            active && "bg-muted"
                          )}
                        >
                          <button
                            type="button"
                            onClick={() => onSelect({ kind: "resource", resourceId: resource.id })}
                            className="min-w-0 flex-1 py-1.5 text-left text-sm"
                          >
                            <span className={cn("truncate", active && "font-medium")}>{label}</span>
                          </button>
                          {readOnly ? null : (
                            <Button
                              size="icon-sm"
                              variant="ghost"
                              className="opacity-0 group-hover:opacity-100"
                              aria-label={text.removeResource}
                              title={text.removeResource}
                              onClick={() => onRemove(resource.id)}
                            >
                              <Trash2 className="size-3.5" />
                            </Button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}

          <div className="mt-2">
            <div className="flex items-center gap-2 px-2 py-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <Database className="size-3.5" />
              {text.sectionDatasets}
              <span className="text-[10px] font-normal">({datasets.length})</span>
            </div>
            {datasets.length === 0 ? (
              <p className="px-3 py-1 text-xs text-muted-foreground">{text.emptySection}</p>
            ) : (
              <div className="grid gap-0.5">
                {datasets.map((dataset) => (
                  <Link
                    key={dataset.id}
                    href={`/${dataset.id}`}
                    className="truncate rounded-md px-3 py-1.5 text-sm text-foreground/80 hover:bg-muted/60"
                  >
                    {dataset.name}
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </ScrollArea>
    </div>
  );
};
