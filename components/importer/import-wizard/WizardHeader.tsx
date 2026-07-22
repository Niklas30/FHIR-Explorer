"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StepProgress } from "@/components/importer/import-wizard/StepProgress";
import type { PackageRef } from "@/lib/fhir-importer/types";
import type { useImportWizardText } from "@/components/importer/import-wizard/text";

export type WizardHeaderProps = {
  text: ReturnType<typeof useImportWizardText>["text"];
  currentTarget?: PackageRef;
  allResolved: boolean;
  activeStepIndex: number;
  importFinished: boolean;
  onCancel: () => void;
};

export const WizardHeader = ({
  text,
  currentTarget,
  allResolved,
  activeStepIndex,
  importFinished,
  onCancel,
}: WizardHeaderProps) => {
  const steps = [
    { label: text.stepSelect, hint: text.stepSelectHint },
    { label: text.stepDependencies, hint: text.stepDependenciesHint },
    { label: text.stepFinish, hint: text.stepFinishHint },
  ];

  const showIntro = !currentTarget && !importFinished;

  return (
    <header className="flex flex-col gap-5">
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
            <Link href="/">
              <ArrowLeft className="size-4" />
              {text.projectsOverview}
            </Link>
          </Button>
        </div>
      </div>

      {showIntro ? <p className="max-w-2xl text-sm text-muted-foreground">{text.intro}</p> : null}

      <div className="rounded-xl border border-foreground/10 bg-muted/20 px-4 py-4 sm:px-6">
        <StepProgress
          steps={steps}
          activeIndex={activeStepIndex}
          complete={importFinished}
          ariaLabel={text.stepsAria}
        />
      </div>
    </header>
  );
};
