"use client";

import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import type { DatasetResource } from "@/lib/datasets/content";
import type { FhirRegistry } from "@/lib/fhir-editor/registry";
import type { FieldDefinition } from "@/lib/fhir-editor/profiles";
import {
  getFieldValue,
  isRepeatingField,
  removeFieldValue,
  resolveFieldKind,
  resolveReferenceTargets,
  resolveValueSetChoices,
  setFieldValue,
} from "@/lib/fhir-editor/fields";
import { isBrokenLocalReference } from "@/lib/fhir-editor/references";
import type { ValidationIssue } from "@/lib/fhir-editor/validation";
import { FieldInput } from "@/components/editor/resource-detail/FieldInput";
import { FieldRow } from "@/components/editor/resource-detail/FieldRow";
import { useResourceDetailText } from "@/components/editor/resource-detail/text";
import { cn } from "@/lib/utils";
import { extractReferenceString, formatTemplate, getFieldValidationIssues, parseMaxCardinality } from "@/components/editor/resource-detail/utils";

type ComplexFieldGroupProps = {
  group: { key: string; root: FieldDefinition; children: FieldDefinition[] };
  content: Record<string, unknown>;
  registry: FhirRegistry | null;
  datasetResources: DatasetResource[];
  referenceIndex: Set<string>;
  validationIssues: ValidationIssue[];
  onChange: (nextContent: Record<string, unknown>) => void;
  onSelectResource: (resourceId: string) => void;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value && typeof value === "object" && !Array.isArray(value));

export const ComplexFieldGroup = ({
  group,
  content,
  registry,
  datasetResources,
  referenceIndex,
  validationIssues,
  onChange,
  onSelectResource,
}: ComplexFieldGroupProps) => {
  const { locale, text } = useResourceDetailText();
  const rootValue = getFieldValue(content, group.root);
  const isRepeating = isRepeatingField(group.root) || Array.isArray(rootValue);
  const rootKind = group.root.path.endsWith(".identifier") ? "Identifier" : resolveFieldKind(group.root);
  const isCodeableRoot = rootKind === "CodeableConcept" || rootKind === "Coding";
  const rootOptions = resolveValueSetChoices(group.root, registry ?? undefined);
  const identifierSystems = group.root.identifierSystems ?? [];
  const identifierTypeOptions = group.root.identifierTypeOptions ?? [];
  const referenceTargets = resolveReferenceTargets(group.root, registry ?? undefined);
  const allowAnyReference = referenceTargets.has("*") || referenceTargets.size === 0;
  const availableReferenceOptions = datasetResources.filter((resource) => {
    if (allowAnyReference) return true;
    return referenceTargets.has(resource.resourceType);
  });
  const getBrokenReference = (entry: unknown) => {
    const reference = extractReferenceString(entry);
    if (!reference) return null;
    return isBrokenLocalReference(reference, referenceIndex) ? reference : null;
  };
  const childFields = group.children
    .map((field) => ({
      ...field,
      segments: field.segments.slice(1),
    }))
    .sort((a, b) => a.label.localeCompare(b.label));
  const filteredChildFields = isCodeableRoot
    ? childFields.filter((field) => !["coding", "text"].includes(field.segments[0] ?? ""))
    : childFields;
  const rootValidationIssues = getFieldValidationIssues(validationIssues, group.root.path);
  const rootErrorCount = rootValidationIssues.filter((issue) => issue.severity === "error").length;

  const updateRoot = (nextValue: unknown) => {
    onChange(setFieldValue(content, group.root, nextValue));
  };

  if (isRepeating) {
    const items = Array.isArray(rootValue)
      ? rootValue
      : rootValue === undefined || rootValue === null
        ? []
        : [rootValue];
    const minItems = Math.max(0, group.root.min ?? 0);
    const maxItems = parseMaxCardinality(group.root.max);
    const canAddEntry = maxItems === null || items.length < maxItems;
    const canRemoveEntry = items.length > minItems;

    return (
      <div className="rounded-lg border border-foreground/10 bg-background px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <Label className="text-sm font-semibold text-foreground">{group.root.label}</Label>
            <p className="text-xs text-muted-foreground">
              {formatTemplate(text.groupEntries, { count: items.length })}
            </p>
          </div>
          {rootErrorCount > 0 ? (
            <span
              className="inline-flex items-center gap-1 rounded-full border border-destructive/40 bg-destructive/10 px-2 py-0.5 text-[11px] font-medium text-destructive"
              title={formatTemplate(text.validationErrorTooltip, {
                count: rootErrorCount,
                suffix: locale === "en" && rootErrorCount === 1 ? "" : "s",
              })}
            >
              <AlertTriangle className="size-3" />
              {rootErrorCount}
            </span>
          ) : null}
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              if (!canAddEntry) return;
              updateRoot([...items, {}]);
            }}
            disabled={!canAddEntry}
          >
            {text.addEntry}
          </Button>
        </div>
        <div className="mt-4 grid gap-4">
          {items.length === 0 ? (
            <div className="rounded-md border border-dashed border-foreground/15 px-3 py-3 text-xs text-muted-foreground">
              {text.noEntriesYet}
            </div>
          ) : null}
          {items.map((item, index) => {
            const itemContent = isRecord(item) ? item : {};
            const handleItemChange = (nextItem: Record<string, unknown>) => {
              const nextItems = [...items];
              nextItems[index] = nextItem;
              updateRoot(nextItems);
            };
            const handleRemoveItem = () => {
              if (!canRemoveEntry) return;
              const nextItems = items.filter((_, idx) => idx !== index);
              updateRoot(nextItems);
            };

            return (
              <div
                key={`${group.key}-${index}`}
                className="rounded-lg border border-foreground/10 bg-muted/30 px-3 py-3"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="text-xs font-semibold text-muted-foreground">
                    {formatTemplate(text.entry, { index: index + 1 })}
                  </div>
                  <button
                    type="button"
                    onClick={handleRemoveItem}
                    className={cn(
                      "text-xs text-destructive",
                      canRemoveEntry ? "hover:text-destructive/80" : "cursor-not-allowed opacity-50"
                    )}
                    disabled={!canRemoveEntry}
                  >
                    {text.remove}
                  </button>
                </div>
                <div className="mt-3 grid gap-3">
                  {rootKind === "Identifier" ? (
                    <FieldInput
                      kind={rootKind}
                      value={itemContent}
                      options={[]}
                      referenceOptions={[]}
                      identifierSystems={identifierSystems}
                      identifierTypeOptions={identifierTypeOptions}
                      onChange={(nextValue) => handleItemChange(isRecord(nextValue) ? nextValue : {})}
                      allDatasetResources={datasetResources}
                      onOpenResource={onSelectResource}
                    />
                  ) : rootKind === "Reference" ? (
                    <FieldInput
                      kind={rootKind}
                      value={itemContent}
                      options={[]}
                      referenceOptions={availableReferenceOptions}
                      brokenReference={getBrokenReference(itemContent)}
                      onChange={(nextValue) => handleItemChange(isRecord(nextValue) ? nextValue : {})}
                      allDatasetResources={datasetResources}
                      onOpenResource={onSelectResource}
                    />
                  ) : isCodeableRoot ? (
                    <FieldInput
                      kind={rootKind}
                      value={itemContent}
                      options={rootOptions}
                      referenceOptions={[]}
                      onChange={(nextValue) => handleItemChange(isRecord(nextValue) ? nextValue : {})}
                    />
                  ) : null}
                  {rootKind === "Identifier"
                    ? null
                    : filteredChildFields.map((field) => (
                        <FieldRow
                          key={`${field.id}-${index}`}
                          field={field}
                          content={itemContent}
                          registry={registry}
                          datasetResources={datasetResources}
                          referenceIndex={referenceIndex}
                          validationIssues={validationIssues}
                          issuePath={
                            field.path.startsWith(`${group.root.path}.`)
                              ? `${group.root.path}[${index}].${field.path.slice(group.root.path.length + 1)}`
                              : field.path
                          }
                          onChange={handleItemChange}
                          onRemove={() => handleItemChange(removeFieldValue(itemContent, field))}
                          onSelectResource={onSelectResource}
                        />
                      ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  const objectValue = isRecord(rootValue) ? rootValue : {};
  const handleObjectChange = (nextItem: Record<string, unknown>) => {
    updateRoot(nextItem);
  };

  return (
    <div className="rounded-lg border border-foreground/10 bg-background px-4 py-3">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-semibold text-foreground">{group.root.label}</Label>
      </div>
      <div className="mt-3 grid gap-3">
        {rootKind === "Identifier" ? (
          <FieldInput
            kind={rootKind}
            value={objectValue}
            options={[]}
            referenceOptions={[]}
            identifierSystems={identifierSystems}
            identifierTypeOptions={identifierTypeOptions}
            onChange={(nextValue) => handleObjectChange(isRecord(nextValue) ? nextValue : {})}
            allDatasetResources={datasetResources}
            onOpenResource={onSelectResource}
          />
        ) : rootKind === "Reference" ? (
          <FieldInput
            kind={rootKind}
            value={objectValue}
            options={[]}
            referenceOptions={availableReferenceOptions}
            brokenReference={getBrokenReference(objectValue)}
            onChange={(nextValue) => handleObjectChange(isRecord(nextValue) ? nextValue : {})}
            allDatasetResources={datasetResources}
            onOpenResource={onSelectResource}
          />
        ) : isCodeableRoot ? (
          <FieldInput
            kind={rootKind}
            value={objectValue}
            options={rootOptions}
            referenceOptions={[]}
            onChange={(nextValue) => handleObjectChange(isRecord(nextValue) ? nextValue : {})}
          />
        ) : null}
        {rootKind === "Identifier"
          ? null
          : filteredChildFields.map((field) => (
              <FieldRow
                key={field.id}
                field={field}
                content={objectValue}
                registry={registry}
                datasetResources={datasetResources}
                referenceIndex={referenceIndex}
                validationIssues={validationIssues}
                onChange={handleObjectChange}
                onRemove={() => handleObjectChange(removeFieldValue(objectValue, field))}
                onSelectResource={onSelectResource}
              />
            ))}
      </div>
    </div>
  );
};

