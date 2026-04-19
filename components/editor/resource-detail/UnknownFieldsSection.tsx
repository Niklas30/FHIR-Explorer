"use client";

import { Button } from "@/components/ui/button";
import { UnknownValueEditor } from "@/components/editor/resource-detail/UnknownValueEditor";

type UnknownFieldsSectionProps = {
  unknownKeys: string[];
  content: Record<string, unknown>;
  title: string;
  unknownFieldLabel: string;
  notInProfileLabel: string;
  addValueLabel: string;
  onChange: (nextContent: Record<string, unknown>) => void;
};

export const UnknownFieldsSection = ({
  unknownKeys,
  content,
  title,
  unknownFieldLabel,
  notInProfileLabel,
  addValueLabel,
  onChange,
}: UnknownFieldsSectionProps) => {
  if (unknownKeys.length === 0) return null;

  return (
    <div className="grid gap-3 rounded-lg border border-dashed border-foreground/15 px-4 py-3">
      <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </div>
      <div className="grid gap-3">
        {unknownKeys.map((key) => {
          const value = content[key];
          const isArray = Array.isArray(value);
          const values = isArray ? value : [value];
          return (
            <div
              key={key}
              className="rounded-md border border-foreground/10 bg-background px-3 py-3"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                    {key}
                  </div>
                  <div className="text-sm font-semibold text-foreground">
                    {unknownFieldLabel}
                  </div>
                </div>
                <span className="rounded-full border border-foreground/20 px-2 py-0.5 text-[10px] uppercase text-muted-foreground">
                  {notInProfileLabel}
                </span>
              </div>
              <div className="mt-3 grid gap-3">
                {values.map((entry, index) => (
                  <UnknownValueEditor
                    key={`${key}-${index}`}
                    value={entry}
                    onChange={(nextValue) => {
                      const nextContent = { ...content };
                      if (isArray) {
                        const nextArray = [...values];
                        nextArray[index] = nextValue;
                        nextContent[key] = nextArray;
                      } else {
                        nextContent[key] = nextValue;
                      }
                      onChange(nextContent);
                    }}
                  />
                ))}
                {isArray ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const nextContent = { ...content };
                      const nextArray = Array.isArray(value) ? [...value, {}] : [{}];
                      nextContent[key] = nextArray;
                      onChange(nextContent);
                    }}
                    className="w-fit"
                  >
                    {addValueLabel}
                  </Button>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

