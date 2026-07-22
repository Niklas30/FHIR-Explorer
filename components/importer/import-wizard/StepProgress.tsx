"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export type ImportStep = {
  label: string;
  hint: string;
};

type StepProgressProps = {
  steps: ImportStep[];
  /** Index of the step currently in progress. */
  activeIndex: number;
  /** When true, every step is treated as complete (import finished). */
  complete?: boolean;
  ariaLabel: string;
};

export const StepProgress = ({ steps, activeIndex, complete = false, ariaLabel }: StepProgressProps) => {
  return (
    <ol
      aria-label={ariaLabel}
      className="flex flex-col gap-3 sm:flex-row sm:items-start sm:gap-2"
    >
      {steps.map((step, index) => {
        const isComplete = complete || index < activeIndex;
        const isCurrent = !complete && index === activeIndex;

        return (
          <li
            key={step.label}
            aria-current={isCurrent ? "step" : undefined}
            className="flex flex-1 items-start gap-3 sm:flex-col sm:items-stretch sm:gap-2"
          >
            <div className="flex items-center gap-3 sm:w-full">
              <span
                className={cn(
                  "flex size-7 shrink-0 items-center justify-center rounded-full border text-sm font-semibold transition-colors",
                  isComplete && "border-primary bg-primary text-primary-foreground",
                  isCurrent && "border-primary bg-primary/10 text-primary",
                  !isComplete && !isCurrent && "border-foreground/20 text-muted-foreground"
                )}
              >
                {isComplete ? <Check className="size-4" /> : index + 1}
              </span>
              <div
                className={cn(
                  "hidden h-px flex-1 sm:block",
                  isComplete ? "bg-primary" : "bg-border",
                  index === steps.length - 1 && "sm:hidden"
                )}
              />
            </div>
            <div className="flex flex-col">
              <span
                className={cn(
                  "text-sm font-medium",
                  isCurrent || isComplete ? "text-foreground" : "text-muted-foreground"
                )}
              >
                {step.label}
              </span>
              {isCurrent ? <span className="text-xs text-muted-foreground">{step.hint}</span> : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
};
