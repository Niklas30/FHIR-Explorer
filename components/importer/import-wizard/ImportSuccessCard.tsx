"use client";

import Link from "next/link";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { useImportWizardText } from "@/components/importer/import-wizard/text";

export type ImportSuccessCardProps = {
  text: ReturnType<typeof useImportWizardText>["text"];
  format: ReturnType<typeof useImportWizardText>["format"];
  targetKey: string;
  packageCount: number;
  dependencyCount: number;
  definitionCount: number;
};

export const ImportSuccessCard = ({
  text,
  format,
  targetKey,
  packageCount,
  dependencyCount,
  definitionCount,
}: ImportSuccessCardProps) => {
  return (
    <Card className="border-primary/30 bg-primary/5">
      <CardContent className="flex flex-col items-center gap-4 py-8 text-center">
        <div className="flex size-12 items-center justify-center rounded-full bg-primary/10">
          <CheckCircle2 className="size-6 text-primary" />
        </div>
        <div className="grid gap-1">
          <p className="text-xl font-semibold text-foreground">{text.finishTitle}</p>
          <p className="text-sm text-muted-foreground">{format(text.finishSummary, { targetKey })}</p>
          <p className="text-xs text-muted-foreground">
            {format(text.finishSummaryLine, {
              packages: packageCount,
              dependencies: dependencyCount,
              definitions: definitionCount,
            })}
          </p>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span className="size-2 animate-pulse rounded-full bg-primary" />
          {text.finishRedirecting}
        </div>
        <Button asChild variant="outline" size="sm">
          <Link href="/">
            {text.finishGoNow}
            <ArrowRight className="size-4" />
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
};
