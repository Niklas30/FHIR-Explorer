"use client";

import { useMemo, useState } from "react";
import { GitFork, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { PackageRecord } from "@/lib/fhir-importer/types";
import type { ProjectEditorText } from "@/components/project-editor/project-editor/text";

type Props = {
  text: ProjectEditorText;
  dependencies: Record<string, string>;
  availablePackages: PackageRecord[];
  onAdd: (id: string, version: string) => void;
  onRemove: (id: string) => void;
  onShowGraph: () => void;
  readOnly?: boolean;
};

export const DependencyManagerPanel = ({
  text,
  dependencies,
  availablePackages,
  onAdd,
  onRemove,
  onShowGraph,
  readOnly = false,
}: Props) => {
  const [selectedKey, setSelectedKey] = useState("");

  const entries = useMemo(
    () => Object.entries(dependencies).sort((a, b) => a[0].localeCompare(b[0])),
    [dependencies]
  );

  const addable = useMemo(
    () => availablePackages.filter((pkg) => !(pkg.id in dependencies)),
    [availablePackages, dependencies]
  );

  const handleAdd = () => {
    if (!selectedKey) return;
    const pkg = availablePackages.find((entry) => entry.key === selectedKey);
    if (!pkg) return;
    onAdd(pkg.id, pkg.version);
    setSelectedKey("");
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center justify-between gap-3 border-b border-foreground/10 px-4 py-3">
        <div>
          <div className="text-sm font-semibold text-foreground">{text.dependencyTitle}</div>
          <div className="text-xs text-muted-foreground">{text.dependencyDescription}</div>
        </div>
        <Button variant="outline" size="sm" onClick={onShowGraph}>
          <GitFork className="size-4" />
          {text.showDependencyGraph}
        </Button>
      </div>

      <ScrollArea className="min-h-0 flex-1">
        <div className="mx-auto grid max-w-2xl gap-4 p-4">
          {readOnly ? null : (
          <div className="flex flex-wrap items-end gap-2">
            <div className="grid flex-1 gap-1">
              <label className="text-xs font-medium text-muted-foreground" htmlFor="dep-select">
                {text.addDependency}
              </label>
              <select
                id="dep-select"
                value={selectedKey}
                onChange={(event) => setSelectedKey(event.target.value)}
                className="h-9 rounded-md border border-foreground/20 bg-background px-3 text-sm"
              >
                <option value="">{text.selectPackage}</option>
                {addable.map((pkg) => (
                  <option key={pkg.key} value={pkg.key}>
                    {pkg.key}
                  </option>
                ))}
              </select>
            </div>
            <Button onClick={handleAdd} disabled={!selectedKey}>
              {text.addDependency}
            </Button>
          </div>
          )}

          {entries.length === 0 ? (
            <p className="text-sm text-muted-foreground">{text.noDependencies}</p>
          ) : (
            <div className="grid gap-2">
              {entries.map(([id, version]) => (
                <div
                  key={id}
                  className="flex items-center justify-between gap-2 rounded-md border border-foreground/10 bg-muted/20 px-3 py-2"
                >
                  <span className="truncate font-mono text-sm">
                    {id}@{version}
                  </span>
                  {readOnly ? null : (
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      aria-label={text.removeDependency}
                      title={text.removeDependency}
                      onClick={() => onRemove(id)}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}

          <p className="text-xs text-muted-foreground">{text.dependencyConflictHint}</p>
        </div>
      </ScrollArea>
    </div>
  );
};
