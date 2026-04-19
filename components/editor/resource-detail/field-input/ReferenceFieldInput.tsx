"use client";

import { useMemo } from "react";
import { AlertTriangle, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PopupSearchSelect, type PopupSearchOption } from "@/components/editor/resource-detail/PopupSearchSelect";
import { useResourceDetailText } from "@/components/editor/resource-detail/text";
import { extractReferenceString } from "@/components/editor/resource-detail/utils";
import type { DatasetResource } from "@/lib/datasets/content";
import { parseLocalReference } from "@/lib/fhir-editor/references";

export const ReferenceFieldInput = ({
  value,
  referenceOptions,
  allDatasetResources,
  onOpenResource,
  includeReferenceDisplay,
  setIncludeReferenceDisplay,
  onChange,
  brokenReference,
}: {
  value: unknown;
  referenceOptions: DatasetResource[];
  allDatasetResources: DatasetResource[];
  onOpenResource?: (resourceId: string) => void;
  includeReferenceDisplay: boolean;
  setIncludeReferenceDisplay: (next: boolean) => void;
  onChange: (value: unknown) => void;
  brokenReference?: string | null;
}) => {
  const { text } = useResourceDetailText();

  const getReferenceValue = (entry: DatasetResource) => {
    const id = typeof entry.content.id === "string" && entry.content.id ? entry.content.id : entry.id;
    return `${entry.resourceType}/${id}`;
  };

  const getReferenceLabel = (entry: DatasetResource) => {
    const name =
      typeof entry.content.name === "string" && entry.content.name.trim()
        ? entry.content.name.trim()
        : undefined;
    const title =
      typeof entry.content.title === "string" && entry.content.title.trim()
        ? entry.content.title.trim()
        : undefined;
    const id = typeof entry.content.id === "string" && entry.content.id ? entry.content.id : entry.id;
    const primary = name ?? title ?? entry.title;
    return primary ? `${primary} · ${entry.resourceType} · ${id}` : `${entry.resourceType} · ${id}`;
  };

  const currentReference = extractReferenceString(value) ?? "";

  const resolvedReferenceKey = parseLocalReference(currentReference)?.key;
  const existingReferenceTarget = resolvedReferenceKey
    ? allDatasetResources.find((entry) => {
        const contentId =
          typeof entry.content.id === "string" && entry.content.id.trim().length > 0
            ? entry.content.id.trim()
            : entry.id;
        return `${entry.resourceType}/${contentId}` === resolvedReferenceKey;
      })
    : null;
  const normalizedReferenceKey = parseLocalReference(currentReference)?.key ?? "";

  const referenceSelectOptions: PopupSearchOption[] = useMemo(
    () =>
      referenceOptions.map((entry) => {
        const name =
          typeof entry.content.name === "string" && entry.content.name.trim()
            ? entry.content.name.trim()
            : "";
        const title =
          typeof entry.content.title === "string" && entry.content.title.trim()
            ? entry.content.title.trim()
            : "";
        const displayId = typeof entry.content.id === "string" && entry.content.id ? entry.content.id : entry.id;
        const reference = getReferenceValue(entry);
        return {
          value: reference,
          label: getReferenceLabel(entry),
          searchText: `${entry.resourceType} ${entry.title ?? ""} ${name} ${title} ${displayId}`,
        };
      }),
    [referenceOptions]
  );

  return (
    <div className="grid gap-2">
      <label className="flex items-center gap-2 text-xs text-muted-foreground">
        <input
          type="checkbox"
          className="h-4 w-4 rounded border border-foreground/20"
          checked={includeReferenceDisplay}
          onChange={(event) => setIncludeReferenceDisplay(event.target.checked)}
        />
        <span>{text.setDisplay}</span>
      </label>
      <PopupSearchSelect
        value={normalizedReferenceKey || currentReference}
        options={referenceSelectOptions}
        placeholder={text.selectReference}
        searchPlaceholder={text.searchResources}
        emptyMessage={text.noMatchingResources}
        onValueChange={(reference) => {
          if (!reference) {
            onChange(undefined);
            return;
          }
          const match = referenceOptions.find((entry) => getReferenceValue(entry) === reference);
          const name = match && typeof match.content.name === "string" ? match.content.name : undefined;
          const title = match && typeof match.content.title === "string" ? match.content.title : undefined;
          if (includeReferenceDisplay) {
            const display = match?.title ?? name ?? title;
            onChange(display ? { reference, display } : { reference });
            return;
          }
          onChange({ reference });
        }}
      />
      <div className="flex items-center gap-2">
        <Input
          value={currentReference}
          onChange={(event) => onChange({ reference: event.target.value })}
          placeholder={text.referencePlaceholder}
        />
        {existingReferenceTarget && onOpenResource ? (
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            aria-label={text.openReferencedResource}
            title={text.openReferencedResource}
            onClick={() => onOpenResource(existingReferenceTarget.id)}
          >
            <ArrowRight className="size-4" />
          </Button>
        ) : null}
      </div>
      {brokenReference ? (
        <div className="inline-flex items-center gap-1 text-xs text-amber-700">
          <AlertTriangle className="size-3" />
          {text.missingTarget}: {brokenReference}
        </div>
      ) : null}
    </div>
  );
};

