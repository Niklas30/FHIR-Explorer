"use client";

import { Maximize2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DependencyGraphView } from "@/components/dependency-graph/DependencyGraphView";
import type { DependencyGraph } from "@/lib/fhir-importer/dependency-graph";
import type { useImportWizardText } from "@/components/importer/import-wizard/text";

export type ImportGraphCardProps = {
  text: ReturnType<typeof useImportWizardText>["text"];
  graph: DependencyGraph;
  rootKey: string | null;
  hasMissing: boolean;
  onExpand: () => void;
  onResolveMissing: (dependencyId: string, requirement: string) => void;
};

export const ImportGraphCard = ({
  text,
  graph,
  rootKey,
  hasMissing,
  onExpand,
  onResolveMissing,
}: ImportGraphCardProps) => {
  if (!rootKey) return null;

  const labels = {
    target: text.graphLegendTarget,
    resolved: text.graphLegendResolved,
    missing: text.graphLegendMissing,
    add: text.graphAddDependency,
    empty: text.graphEmpty,
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle>{text.graphTitle}</CardTitle>
            <CardDescription>
              {hasMissing ? text.graphDescriptionMissing : text.graphDescription}
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={onExpand}>
            <Maximize2 className="size-4" />
            {text.graphExpand}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="grid gap-3">
        <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-full border-2 border-primary" />
            {text.graphLegendTarget}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-full border border-foreground/30" />
            {text.graphLegendResolved}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-full border border-destructive" />
            {text.graphLegendMissing}
          </span>
          {hasMissing ? <span className="text-destructive">{text.graphClickHint}</span> : null}
        </div>
        <DependencyGraphView
          graph={graph}
          rootKey={rootKey}
          labels={labels}
          onResolveMissing={onResolveMissing}
          className="max-h-96"
        />
      </CardContent>
    </Card>
  );
};
