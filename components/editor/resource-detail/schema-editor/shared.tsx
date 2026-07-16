"use client";

import { AlertTriangle, Info } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { SchemaNode } from "@/lib/fhir-editor/schema";
import {
  PopupSearchSelect,
} from "@/components/editor/resource-detail/PopupSearchSelect";
import { useResourceDetailText } from "@/components/editor/resource-detail/text";
import { formatCardinality } from "@/components/editor/resource-detail/schema-editor/helpers";

export const joinPath = (path: string, segment: string) =>
  path ? `${path}.${segment}` : segment;

export const NodeInfoTooltip = ({ node }: { node: SchemaNode }) => {
  const { text } = useResourceDetailText();
  if (!node.short && !node.definition) return null;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button type="button" className="text-muted-foreground hover:text-foreground" tabIndex={-1}>
          <Info className="size-3.5" />
        </button>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-sm">
        <div className="grid gap-1 text-xs">
          {node.short ? <div className="font-semibold">{node.short}</div> : null}
          {node.definition && node.definition !== node.short ? (
            <div className="whitespace-pre-wrap opacity-90">{node.definition}</div>
          ) : null}
          <div className="opacity-70">
            {node.path} · {formatCardinality(node)}
            {node.binding?.strength
              ? ` · ${text.bindingLabel}: ${node.binding.strength}`
              : ""}
          </div>
        </div>
      </TooltipContent>
    </Tooltip>
  );
};

export const NodeBadges = ({
  node,
  errorCount,
}: {
  node: SchemaNode;
  errorCount: number;
}) => {
  const { text } = useResourceDetailText();
  return (
    <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
      {node.min > 0 ? (
        <span className="rounded-full border border-emerald-600/30 bg-emerald-500/10 px-1.5 py-0.5 font-medium text-emerald-700">
          {text.required}
        </span>
      ) : null}
      <span className="rounded-full border border-foreground/10 px-1.5 py-0.5 text-muted-foreground">
        {formatCardinality(node)}
      </span>
      {node.mustSupport ? (
        <span
          className="rounded-full border border-sky-500/30 bg-sky-500/10 px-1.5 py-0.5 font-medium text-sky-700"
          title={text.mustSupport}
        >
          MS
        </span>
      ) : null}
      {node.isModifier ? (
        <span className="rounded-full border border-amber-500/40 bg-amber-500/10 px-1.5 py-0.5 font-medium text-amber-700">
          {text.modifierBadge}
        </span>
      ) : null}
      {node.fixedValue !== undefined ? (
        <span className="rounded-full border border-foreground/15 bg-muted px-1.5 py-0.5 text-muted-foreground">
          {text.fixedBadge}
        </span>
      ) : null}
      {errorCount > 0 ? (
        <span className="inline-flex items-center gap-1 rounded-full border border-destructive/40 bg-destructive/10 px-1.5 py-0.5 font-medium text-destructive">
          <AlertTriangle className="size-3" />
          {errorCount}
        </span>
      ) : null}
    </div>
  );
};

export const ChoiceTypeSelector = ({
  node,
  selectedType,
  onSelectType,
}: {
  node: SchemaNode;
  selectedType?: string;
  onSelectType: (typeCode: string) => void;
}) => {
  const { text } = useResourceDetailText();
  const typeCodes = node.types
    .map((type) => type.code)
    .filter((code): code is string => Boolean(code));

  if (typeCodes.length <= 6) {
    return (
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          {text.typeLabel}
        </span>
        {typeCodes.map((code) => (
          <button
            key={code}
            type="button"
            onClick={() => onSelectType(code)}
            className={cn(
              "rounded-full border px-2.5 py-0.5 text-xs transition-colors",
              selectedType === code
                ? "border-foreground/60 bg-foreground text-background"
                : "border-foreground/20 text-muted-foreground hover:border-foreground/40 hover:text-foreground"
            )}
          >
            {code}
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className="grid gap-1">
      <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {text.typeLabel}
      </span>
      <PopupSearchSelect
        value={selectedType ?? ""}
        options={typeCodes.map((code) => ({ value: code, label: code }))}
        placeholder={text.selectType}
        onValueChange={(code) => {
          if (code) onSelectType(code);
        }}
      />
    </div>
  );
};
