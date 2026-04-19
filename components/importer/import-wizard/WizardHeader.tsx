"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { PackageRef } from "@/lib/fhir-importer/types";
import type { useImportWizardText } from "@/components/importer/import-wizard/text";

type ImportSummary = {
  targetKey: string;
  log: string[];
};

export type WizardHeaderProps = {
  text: ReturnType<typeof useImportWizardText>["text"];
  format: ReturnType<typeof useImportWizardText>["format"];
  currentTarget?: PackageRef;
  allResolved: boolean;
  importedCount: number;
  missingCount: number;
  importedDefinitions: number;
  lastImport: ImportSummary | null;
  isTargetReady: boolean;
  importedTargetText: string;
  onCancel: () => void;
};

export const WizardHeader = ({
  text,
  format,
  currentTarget,
  allResolved,
  importedCount,
  missingCount,
  importedDefinitions,
  lastImport,
  isTargetReady,
  importedTargetText,
  onCancel,
}: WizardHeaderProps) => {
  return (
    <header className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground">{text.importer}</p>
          <h1 className="text-3xl font-semibold text-foreground">{text.title}</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {currentTarget && !allResolved ? (
            <Button variant="outline" onClick={onCancel}>
              {text.cancelImport}
            </Button>
          ) : null}
          <Button asChild variant="ghost" size="sm">
            <Link href="/">{text.projectsOverview}</Link>
          </Button>
          <Button asChild variant="ghost" size="sm">
            <Link href="/">{text.home}</Link>
          </Button>
        </div>
      </div>
      <p className="max-w-2xl text-sm text-muted-foreground">{text.intro}</p>
      <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
        <span>{format(text.imported, { count: importedCount })}</span>
        <span>{format(text.missing, { count: missingCount })}</span>
        <span>{format(text.definitions, { count: importedDefinitions })}</span>
        <span>
          {format(text.target, {
            value: currentTarget ? `${currentTarget.id}@${currentTarget.version}` : text.none,
          })}
        </span>
      </div>
      {lastImport ? (
        <Card className="border-foreground/20 bg-muted/20">
          <CardHeader>
            <CardTitle>{text.importSuccessful}</CardTitle>
            <CardDescription>
              {format(text.importSuccessfulDescription, {
                targetKey: lastImport.targetKey,
              })}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild size="lg" className="w-full">
              <Link href="/">{text.goToProjectsOverview}</Link>
            </Button>
          </CardContent>
        </Card>
      ) : null}
      {isTargetReady ? (
        <div className="rounded-lg border border-foreground/10 bg-muted/30 px-4 py-3 text-xs text-muted-foreground">
          {format(text.targetImported, { value: importedTargetText })}
        </div>
      ) : null}
    </header>
  );
};

