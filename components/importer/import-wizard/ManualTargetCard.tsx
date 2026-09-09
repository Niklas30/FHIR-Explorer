"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DependencySourceList } from "@/components/importer/import-wizard/DependencySourceList";
import type { PackageSource } from "@/lib/fhir-importer/registry";
import type { PackageRef } from "@/lib/fhir-importer/types";
import type { useImportWizardText } from "@/components/importer/import-wizard/text";

/**
 * The first step of the step-by-step route: the package the user named.
 *
 * Its dependencies cannot be listed until it has been read — they are written
 * inside it — so this is the one package that has to be fetched before the
 * rest of the tree is even known. Choosing where it comes from is the same
 * decision as for every package after it, so it is presented the same way.
 */

export type ManualTargetCardProps = {
  text: ReturnType<typeof useImportWizardText>["text"];
  target: PackageRef;
  sources: PackageSource[] | undefined;
  isUploading: boolean;
  onImportFrom: (url: string) => void;
  onCopy: (link: string) => void;
  /** Hands the rest back to the automatic walk, for anyone who has had enough. */
  onSwitchToAuto: () => void;
};

export const ManualTargetCard = ({
  text,
  target,
  sources,
  isUploading,
  onImportFrom,
  onCopy,
  onSwitchToAuto,
}: ManualTargetCardProps) => (
  <Card>
    <CardHeader>
      <CardTitle>{text.manualTitle}</CardTitle>
      <CardDescription>{text.manualDescription}</CardDescription>
    </CardHeader>
    <CardContent className="grid gap-4">
      <div className="rounded-xl border border-foreground/10 bg-muted/30 px-4 py-4">
        <p className="text-sm font-semibold text-foreground">{target.id}</p>
        <p className="text-xs text-muted-foreground">
          {text.manualTargetLabel} {target.version}
        </p>
        <div className="mt-3">
          <DependencySourceList
            text={text}
            sources={sources}
            fallbackLink={`${target.id}@${target.version}`}
            isUploading={isUploading}
            onImportFrom={onImportFrom}
            onCopy={onCopy}
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button variant="secondary" size="sm" disabled={isUploading} onClick={onSwitchToAuto}>
          {text.manualSwitchToAuto}
        </Button>
        <span className="text-xs text-muted-foreground">{text.manualSwitchToAutoHint}</span>
      </div>
    </CardContent>
  </Card>
);
