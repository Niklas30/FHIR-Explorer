"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { useImportWizardText } from "@/components/importer/import-wizard/text";

export type ImportLogCardProps = {
  text: ReturnType<typeof useImportWizardText>["text"];
  format: ReturnType<typeof useImportWizardText>["format"];
  title: string;
  description: string;
  log: string[];
};

export const ImportLogCard = ({ text, format, title, description, log }: ImportLogCardProps) => {
  if (log.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <details className="rounded-lg border border-foreground/10 bg-muted/30 px-4 py-3">
          <summary className="cursor-pointer text-sm font-medium text-foreground">
            {format(text.showLog, { count: log.length })}
          </summary>
          <div className="mt-3 flex max-h-64 flex-col gap-2 overflow-auto text-xs text-muted-foreground">
            {log.length === 0 ? <span>{text.noLogEntries}</span> : log.map((entry, index) => <span key={index}>{entry}</span>)}
          </div>
        </details>
      </CardContent>
    </Card>
  );
};

