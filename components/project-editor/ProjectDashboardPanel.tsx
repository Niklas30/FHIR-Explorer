"use client";

import Link from "next/link";
import {
  FileCog,
  Puzzle,
  ListTree,
  Library,
  FlaskConical,
  Database,
  Upload,
  Share2,
  AlertTriangle,
  CheckCircle2,
  Plus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { PackageManifest } from "@/lib/fhir-importer/types";
import type { AuthoredResourceKind } from "@/lib/projects/types";
import type { ProjectAnalysis } from "@/lib/projects/analysis";
import type { ProjectEditorText } from "@/components/project-editor/project-editor/text";

type Props = {
  text: ProjectEditorText;
  manifest: PackageManifest;
  analysis: ProjectAnalysis;
  datasetCount: number;
  readOnly: boolean;
  onAdd: (kind: AuthoredResourceKind) => void;
  onShowMap: () => void;
  onOpenIssues: () => void;
};

export const ProjectDashboardPanel = ({
  text,
  manifest,
  analysis,
  datasetCount,
  readOnly,
  onAdd,
  onShowMap,
  onOpenIssues,
}: Props) => {
  const total =
    analysis.counts.profile +
    analysis.counts.extension +
    analysis.counts.valueset +
    analysis.counts.codesystem +
    analysis.counts.example;

  const tiles: Array<{ kind: AuthoredResourceKind; label: string; icon: typeof FileCog }> = [
    { kind: "profile", label: text.sectionProfiles, icon: FileCog },
    { kind: "extension", label: text.sectionExtensions, icon: Puzzle },
    { kind: "valueset", label: text.sectionValueSets, icon: ListTree },
    { kind: "codesystem", label: text.sectionCodeSystems, icon: Library },
    { kind: "example", label: text.sectionExamples, icon: FlaskConical },
  ];

  const errorCount = analysis.issues.filter((i) => i.severity === "error").length;
  const warningCount = analysis.issues.filter((i) => i.severity === "warning").length;
  const dependencies = Object.entries(manifest.dependencies ?? {});

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="border-b border-foreground/10 px-4 py-3">
        <div className="text-sm font-semibold text-foreground">{text.dashboardTitle}</div>
        <div className="text-xs text-muted-foreground">
          {manifest.canonical ?? text.noCanonical}
        </div>
      </div>

      <ScrollArea className="min-h-0 flex-1">
        <div className="mx-auto grid max-w-3xl gap-6 p-4">
          {total === 0 && !readOnly ? (
            <Card className="border-dashed border-foreground/20">
              <CardContent className="grid gap-4 py-8 text-center">
                <p className="text-lg font-semibold text-foreground">{text.emptyProjectTitle}</p>
                <p className="mx-auto max-w-md text-sm text-muted-foreground">
                  {text.emptyProjectHint}
                </p>
                <div className="flex flex-wrap justify-center gap-2">
                  <Button onClick={() => onAdd("profile")}>
                    <Plus className="size-4" />
                    {text.ctaFirstProfile}
                  </Button>
                  <Button variant="outline" onClick={() => onAdd("valueset")}>
                    <Plus className="size-4" />
                    {text.sectionValueSets}
                  </Button>
                  <Button asChild variant="outline">
                    <Link href="/importer">
                      <Upload className="size-4" />
                      {text.importBasePackage}
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {tiles.map((tile) => (
                  <button
                    key={tile.kind}
                    type="button"
                    onClick={() => onAdd(tile.kind)}
                    disabled={readOnly}
                    className="flex items-center justify-between rounded-lg border border-foreground/10 bg-muted/20 px-3 py-3 text-left hover:bg-muted/40 disabled:cursor-default disabled:hover:bg-muted/20"
                  >
                    <span className="flex items-center gap-2">
                      <tile.icon className="size-4 text-muted-foreground" />
                      <span className="text-sm">{tile.label}</span>
                    </span>
                    <span className="text-lg font-semibold tabular-nums">
                      {analysis.counts[tile.kind]}
                    </span>
                  </button>
                ))}
                <div className="flex items-center justify-between rounded-lg border border-foreground/10 bg-muted/20 px-3 py-3">
                  <span className="flex items-center gap-2">
                    <Database className="size-4 text-muted-foreground" />
                    <span className="text-sm">{text.sectionDatasets}</span>
                  </span>
                  <span className="text-lg font-semibold tabular-nums">{datasetCount}</span>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" onClick={onShowMap}>
                  <Share2 className="size-4" />
                  {text.showRelationships}
                </Button>
                {!readOnly ? (
                  <Button variant="outline" size="sm" onClick={() => onAdd("profile")}>
                    <Plus className="size-4" />
                    {text.addResource}
                  </Button>
                ) : null}
              </div>
            </>
          )}

          {/* Health */}
          <div className="grid gap-2">
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {text.health}
            </div>
            {analysis.issues.length === 0 ? (
              <div className="flex items-center gap-2 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-400">
                <CheckCircle2 className="size-4" />
                {text.noIssues}
              </div>
            ) : (
              <button
                type="button"
                onClick={onOpenIssues}
                className="flex items-center gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-left text-sm text-amber-700 hover:bg-amber-500/20 dark:text-amber-400"
              >
                <AlertTriangle className="size-4" />
                <span>
                  {errorCount} {text.errors}, {warningCount} {text.warnings} — {text.viewIssues}
                </span>
              </button>
            )}
          </div>

          {/* Dependencies */}
          <div className="grid gap-2">
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {text.nodeDependencies}
            </div>
            {dependencies.length === 0 ? (
              <p className="text-sm text-muted-foreground">{text.noDependencies}</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {dependencies.map(([id, version]) => (
                  <Badge key={id} variant="outline" className="font-mono text-xs">
                    {id}@{version}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </div>
      </ScrollArea>
    </div>
  );
};
