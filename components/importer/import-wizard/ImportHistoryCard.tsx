"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { useImportWizardText } from "@/components/importer/import-wizard/text";

export type ImportHistoryCardProps = {
  text: ReturnType<typeof useImportWizardText>["text"];
  importHistory: Array<{ targetKey: string; completedAt: number }>;
  show: boolean;
};

export const ImportHistoryCard = ({ text, importHistory, show }: ImportHistoryCardProps) => {
  if (!show) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{text.importHistory}</CardTitle>
        <CardDescription>{text.importHistoryDescription}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-2 text-sm text-muted-foreground">
        {importHistory.length === 0 ? (
          <div className="rounded-lg border border-foreground/10 px-3 py-2 text-xs text-muted-foreground">
            {text.noImportsYet}
          </div>
        ) : (
          importHistory.map((entry) => (
            <div
              key={`${entry.targetKey}-${entry.completedAt}`}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-foreground/10 px-3 py-2"
            >
              <span className="text-foreground">{entry.targetKey}</span>
              <span className="text-xs text-muted-foreground">
                {new Date(entry.completedAt).toLocaleString()}
              </span>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
};

