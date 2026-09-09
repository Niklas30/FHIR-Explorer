"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { DependencyRequirement } from "@/lib/fhir-importer/types";
import type { useImportWizardText } from "@/components/importer/import-wizard/text";

export type ConflictsCardProps = {
  text: ReturnType<typeof useImportWizardText>["text"];
  conflicts: DependencyRequirement[];
  /** Settles a conflict by pinning one of the versions that were asked for. */
  onPickVersion: (depId: string, version: string) => void;
};

export const ConflictsCard = ({ text, conflicts, onPickVersion }: ConflictsCardProps) => {
  if (conflicts.length === 0) return null;

  return (
    <Card className="border-destructive/40">
      <CardHeader>
        <CardTitle>{text.conflicts}</CardTitle>
        <CardDescription>{text.conflictsDescription}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-2">
        {conflicts.map((conflict) => (
          <div
            key={conflict.id}
            className="rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2"
          >
            <p className="text-sm font-semibold text-foreground">{conflict.id}</p>
            <p className="text-xs text-muted-foreground">
              {conflict.conflictReason ?? text.versionConflict}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span className="text-xs text-muted-foreground">{text.pickConflictVersion}</span>
              {conflict.ranges.map((version) => (
                <Button
                  key={version}
                  size="sm"
                  variant="secondary"
                  onClick={() => onPickVersion(conflict.id, version)}
                >
                  {version}
                </Button>
              ))}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
};

