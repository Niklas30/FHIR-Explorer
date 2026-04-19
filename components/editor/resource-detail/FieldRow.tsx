"use client";

import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import type { DatasetResource } from "@/lib/datasets/content";
import type { FhirRegistry } from "@/lib/fhir-editor/registry";
import type { FieldDefinition } from "@/lib/fhir-editor/profiles";
import {
  getDefaultValueForField,
  getFieldValue,
  isRepeatingField,
  resolveFieldKind,
  resolveReferenceTargets,
  resolveValueSetChoices,
  setFieldValue,
} from "@/lib/fhir-editor/fields";
import { isBrokenLocalReference } from "@/lib/fhir-editor/references";
import type { ValidationIssue } from "@/lib/fhir-editor/validation";
import { FieldInput } from "@/components/editor/resource-detail/FieldInput";
import { useResourceDetailText } from "@/components/editor/resource-detail/text";
import { extractReferenceString, formatTemplate, getFieldValidationIssues, parseMaxCardinality } from "@/components/editor/resource-detail/utils";

type FieldRowProps = {
  field: FieldDefinition;
  content: Record<string, unknown>;
  registry: FhirRegistry | null;
  datasetResources: DatasetResource[];
  referenceIndex: Set<string>;
  validationIssues: ValidationIssue[];
  issuePath?: string;
  onChange: (nextContent: Record<string, unknown>) => void;
  onRemove: () => void;
  onSelectResource: (resourceId: string) => void;
};

export const FieldRow = ({
  field,
  content,
  registry,
  datasetResources,
  referenceIndex,
  validationIssues,
  issuePath,
  onChange,
  onRemove,
  onSelectResource,
}: FieldRowProps) => {
  const { locale, text } = useResourceDetailText();
  const kind = field.path.endsWith(".identifier") ? "Identifier" : resolveFieldKind(field);
  const isRepeating = isRepeatingField(field);
  const rawValue = getFieldValue(content, field);
  const isArrayValue = Array.isArray(rawValue);
  const effectiveRepeating = isRepeating || isArrayValue;
  const values = effectiveRepeating
    ? isArrayValue
      ? rawValue
      : rawValue === undefined || rawValue === null
        ? []
        : [rawValue]
    : [rawValue];
  const options = resolveValueSetChoices(field, registry ?? undefined);
  const minItems = Math.max(0, field.min ?? 0);
  const maxItems = parseMaxCardinality(field.max);
  const canAddItem = effectiveRepeating && (maxItems === null || values.length < maxItems);
  const canRemoveItem = effectiveRepeating && values.length > minItems;
  const referenceTargets = resolveReferenceTargets(field, registry ?? undefined);
  const allowAnyReference = referenceTargets.has("*") || referenceTargets.size === 0;

  const availableReferenceOptions = datasetResources.filter((resource) => {
    if (allowAnyReference) return true;
    return referenceTargets.has(resource.resourceType);
  });

  const updateValues = (nextValues: unknown[]) => {
    const value = effectiveRepeating ? nextValues : nextValues[0];
    onChange(setFieldValue(content, field, value));
  };

  const updateItem = (index: number, value: unknown) => {
    const next = [...values];
    next[index] = value;
    updateValues(next);
  };

  const addItem = () => {
    if (!canAddItem) return;
    const defaultValue = getDefaultValueForField(field, registry ?? undefined);
    const next = [...values, ...(Array.isArray(defaultValue) ? defaultValue : [defaultValue])];
    updateValues(next);
  };

  const removeItem = (index: number) => {
    if (!canRemoveItem) return;
    const next = values.filter((_, idx) => idx !== index);
    updateValues(next);
  };

  const showRemove = (field.min ?? 0) === 0;
  const brokenReferences = values.map((entry) => {
    if (kind !== "Reference") return null;
    const reference = extractReferenceString(entry);
    if (!reference) return null;
    return isBrokenLocalReference(reference, referenceIndex) ? reference : null;
  });
  const hasBrokenReference = brokenReferences.some(Boolean);
  const fieldPath = issuePath ?? field.path;
  const fieldValidationIssues = getFieldValidationIssues(validationIssues, fieldPath);
  const fieldErrorCount = fieldValidationIssues.filter((issue) => issue.severity === "error").length;

  return (
    <div className="rounded-lg border border-foreground/10 bg-background px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          {field.path ? (
            <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{field.path}</div>
          ) : null}
          <Label className="text-sm font-semibold text-foreground">{field.label}</Label>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {(field.min ?? 0) > 0 ? <span className="text-emerald-600">{text.required}</span> : null}
          {effectiveRepeating ? <span>{text.multiple}</span> : null}
          {hasBrokenReference ? (
            <span
              className="inline-flex items-center gap-1 rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-700"
              title={text.brokenReferenceTarget}
            >
              <AlertTriangle className="size-3" />
              {text.missingTarget}
            </span>
          ) : null}
          {fieldErrorCount > 0 ? (
            <span
              className="inline-flex items-center gap-1 rounded-full border border-destructive/40 bg-destructive/10 px-2 py-0.5 text-[11px] font-medium text-destructive"
              title={formatTemplate(text.validationErrorTooltip, {
                count: fieldErrorCount,
                suffix: locale === "en" && fieldErrorCount === 1 ? "" : "s",
              })}
            >
              <AlertTriangle className="size-3" />
              {fieldErrorCount}
            </span>
          ) : null}
          {showRemove ? (
            <button type="button" onClick={onRemove} className="text-xs text-destructive hover:text-destructive/80">
              {text.remove}
            </button>
          ) : null}
        </div>
      </div>
      <div className="mt-3 grid gap-3">
        {fieldValidationIssues.length > 0 ? (
          <div className="grid gap-1 rounded-md border border-destructive/30 bg-destructive/5 px-2 py-2 text-xs text-destructive">
            {fieldValidationIssues.map((issue, index) => (
              <div key={`${issue.code}-${issue.path}-${index}`}>{issue.message}</div>
            ))}
          </div>
        ) : null}
        {values.length === 0 ? (
          <div className="rounded-md border border-dashed border-foreground/15 px-3 py-3 text-xs text-muted-foreground">
            {text.noValuesYet}
          </div>
        ) : null}
        {values.map((value, index) => (
          <FieldInput
            key={`${field.id}-${index}`}
            kind={kind}
            value={value}
            options={options}
            referenceOptions={availableReferenceOptions}
            identifierSystems={field.identifierSystems}
            identifierTypeOptions={field.identifierTypeOptions}
            onChange={(nextValue) => updateItem(index, nextValue)}
            onRemove={canRemoveItem ? () => removeItem(index) : undefined}
            brokenReference={brokenReferences[index]}
            allDatasetResources={datasetResources}
            onOpenResource={onSelectResource}
          />
        ))}
        {effectiveRepeating ? (
          <Button variant="outline" size="sm" onClick={addItem} className="w-fit" disabled={!canAddItem}>
            {text.addValue}
          </Button>
        ) : null}
      </div>
    </div>
  );
};

