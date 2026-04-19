"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { DependencyRequirement } from "@/lib/fhir-importer/types";
import type { useImportWizardText } from "@/components/importer/import-wizard/text";

export type ConflictsCardProps = {
  text: ReturnType<typeof useImportWizardText>["text"];
  conflicts: DependencyRequirement[];
};

export const ConflictsCard = ({ text, conflicts }: ConflictsCardProps) => {
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
          </div>
        ))}
      </CardContent>
    </Card>
  );
};

