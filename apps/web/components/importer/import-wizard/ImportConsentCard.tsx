"use client";

import { Download, Loader2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { ImportSourceState } from "@/components/importer/import-wizard/useImportSource";
import type { PackageRef } from "@/lib/fhir-importer/types";
import type { useImportWizardText } from "@/components/importer/import-wizard/text";

/**
 * Asks before anything is downloaded: what, from where, and by which route.
 *
 * The import reaches a third party the user never chose — whichever registry
 * carries the version — and pulls an open-ended number of further packages,
 * because a dependency only becomes known once the package naming it has been
 * read. Starting all that on the same click that names a package would hide
 * both facts. So the destination is named first, and the user chooses whether
 * the tool walks the tree or they take it package by package themselves.
 */

export type ImportConsentCardProps = {
  text: ReturnType<typeof useImportWizardText>["text"];
  format: ReturnType<typeof useImportWizardText>["format"];
  target: PackageRef;
  source: ImportSourceState;
  isImporting: boolean;
  onConfirmAuto: () => void;
  onConfirmManual: () => void;
  onCancel: () => void;
};

export const ImportConsentCard = ({
  text,
  format,
  target,
  source,
  isImporting,
  onConfirmAuto,
  onConfirmManual,
  onCancel,
}: ImportConsentCardProps) => (
  <Card>
    <CardHeader>
      <CardTitle>{text.consentTitle}</CardTitle>
      <CardDescription>
        {format(text.consentDescription, { value: `${target.id}@${target.version}` })}
      </CardDescription>
    </CardHeader>
    <CardContent className="grid gap-4">
      <div className="grid gap-2 rounded-lg border border-foreground/10 bg-muted/30 px-4 py-3">
        <div className="flex items-start gap-2">
          <Download className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
          <p className="text-sm text-foreground">
            {source.status === "resolving" ? (
              text.consentResolving
            ) : source.status === "ready" ? (
              format(text.consentFrom, { value: source.host })
            ) : (
              text.consentUnavailable
            )}
          </p>
        </div>
        <div className="flex items-start gap-2">
          <ShieldCheck className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">{text.consentNoBackend}</p>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">{text.consentDependenciesNote}</p>

      <div className="grid gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Button disabled={isImporting || source.status !== "ready"} onClick={onConfirmAuto}>
            {isImporting ? <Loader2 className="size-4 animate-spin" /> : null}
            {isImporting ? text.consentRunning : text.consentConfirm}
          </Button>
          <Button variant="outline" disabled={isImporting} onClick={onConfirmManual}>
            {text.consentManual}
          </Button>
          <Button variant="ghost" disabled={isImporting} onClick={onCancel}>
            {text.consentCancel}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">{text.consentManualHint}</p>
      </div>
    </CardContent>
  </Card>
);
