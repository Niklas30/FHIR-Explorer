"use client";

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DependencyGraphView,
  type DependencyGraphLabels,
} from "@/components/dependency-graph/DependencyGraphView";
import type { DependencyGraph } from "@/lib/fhir-importer/dependency-graph";

export type DependencyGraphDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  graph: DependencyGraph;
  rootKey: string | null;
  title: string;
  description?: string;
  labels: DependencyGraphLabels;
  onResolveMissing?: (dependencyId: string, requirement: string) => void;
};

export const DependencyGraphDialog = ({
  open,
  onOpenChange,
  graph,
  rootKey,
  title,
  description,
  labels,
  onResolveMissing,
}: DependencyGraphDialogProps) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[calc(100dvh-2rem)] w-[calc(100dvw-2rem)] max-w-5xl flex-col gap-4">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description ? <DialogDescription>{description}</DialogDescription> : null}
        </DialogHeader>
        <DependencyGraphView
          graph={graph}
          rootKey={rootKey}
          labels={labels}
          onResolveMissing={onResolveMissing}
          className="max-h-[70vh]"
        />
      </DialogContent>
    </Dialog>
  );
};
