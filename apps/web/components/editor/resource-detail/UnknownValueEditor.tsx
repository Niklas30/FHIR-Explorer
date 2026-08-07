"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useResourceDetailText } from "@/components/editor/resource-detail/text";

const isPrimitiveValue = (value: unknown) =>
  value === null ||
  value === undefined ||
  typeof value === "string" ||
  typeof value === "number" ||
  typeof value === "boolean";

const stringifyValue = (value: unknown) => {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return JSON.stringify(value, null, 2);
};

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  Boolean(value && typeof value === "object" && !Array.isArray(value));

type UnknownValueEditorProps = {
  value: unknown;
  onChange: (nextValue: unknown) => void;
};

export const UnknownValueEditor = ({ value, onChange }: UnknownValueEditorProps) => {
  const { text } = useResourceDetailText();
  const [draft, setDraft] = useState(() => stringifyValue(value));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setDraft(stringifyValue(value));
    setError(null);
  }, [value]);

  if (isPlainObject(value)) {
    const keys = Object.keys(value);
    return (
      <div className="rounded-md border border-foreground/10 bg-muted/30 px-3 py-3">
        <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {text.object}
        </div>
        <div className="mt-3 grid gap-2">
          {keys.length === 0 ? (
            <div className="text-xs text-muted-foreground">{text.noFieldsYet}</div>
          ) : null}
          {keys.map((key) => {
            const entry = value[key];
            return (
              <div key={key} className="grid gap-2">
                <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  {key}
                </div>
                {isPrimitiveValue(entry) ? (
                  <Input
                    value={stringifyValue(entry)}
                    onChange={(event) => {
                      const next = { ...value, [key]: event.target.value };
                      onChange(next);
                    }}
                  />
                ) : (
                  <UnknownValueEditor
                    value={entry}
                    onChange={(nextEntry) => {
                      const next = { ...value, [key]: nextEntry };
                      onChange(next);
                    }}
                  />
                )}
              </div>
            );
          })}
          <div className="grid gap-2">
            <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              {text.rawJson}
            </div>
            <textarea
              value={draft}
              onChange={(event) => {
                setDraft(event.target.value);
                setError(null);
              }}
              onBlur={() => {
                try {
                  const parsed = JSON.parse(draft);
                  if (!isPlainObject(parsed)) {
                    setError(text.jsonMustBeObject);
                    return;
                  }
                  onChange(parsed);
                  setError(null);
                } catch (err) {
                  setError(err instanceof Error ? err.message : text.invalidJson);
                }
              }}
              className="min-h-[120px] w-full rounded-md border border-foreground/10 bg-background p-2 text-xs"
            />
            {error ? <div className="text-xs text-destructive">{error}</div> : null}
          </div>
        </div>
      </div>
    );
  }

  if (Array.isArray(value)) {
    return (
      <div className="grid gap-2">
        {value.map((entry, index) => (
          <UnknownValueEditor
            key={index}
            value={entry}
            onChange={(nextEntry) => {
              const nextArray = [...value];
              nextArray[index] = nextEntry;
              onChange(nextArray);
            }}
          />
        ))}
        <Button variant="outline" size="sm" onClick={() => onChange([...value, ""])} className="w-fit">
          {text.addValue}
        </Button>
      </div>
    );
  }

  return (
    <div className="grid gap-2">
      <Input
        value={draft}
        onChange={(event) => {
          setDraft(event.target.value);
          setError(null);
        }}
        onBlur={() => {
          if (isPrimitiveValue(value)) {
            onChange(draft);
            return;
          }
          try {
            const parsed = JSON.parse(draft);
            onChange(parsed);
            setError(null);
          } catch (err) {
            setError(err instanceof Error ? err.message : text.invalidJson);
          }
        }}
      />
      {error ? <div className="text-xs text-destructive">{error}</div> : null}
    </div>
  );
};

