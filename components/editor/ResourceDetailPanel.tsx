"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import { Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { DatasetResource } from "@/lib/datasets/content";
import type { FhirRegistry } from "@/lib/fhir-editor/registry";
import type { FieldDefinition } from "@/lib/fhir-editor/profiles";
import {
  getDefaultValueForField,
  getFieldValue,
  isFieldFilled,
  removeFieldValue,
  setFieldValue,
} from "@/lib/fhir-editor/fields";
import { buildDatasetReferenceIndex } from "@/lib/fhir-editor/references";
import { validateResourceWithProfile } from "@/lib/fhir-editor/validation";
import { ComplexFieldGroup } from "@/components/editor/resource-detail/ComplexFieldGroup";
import { FieldRow } from "@/components/editor/resource-detail/FieldRow";
import { useResourceDetailText } from "@/components/editor/resource-detail/text";
import { formatTemplate } from "@/components/editor/resource-detail/utils";
import { UnknownFieldsSection } from "@/components/editor/resource-detail/UnknownFieldsSection";

type ResourceDetailPanelProps = {
  resource: DatasetResource | null;
  fields: FieldDefinition[];
  registry: FhirRegistry | null;
  datasetResources: DatasetResource[];
  onSelectResource: (resourceId: string) => void;
  onUpdateResource: (resource: DatasetResource) => void;
  onRemoveResource: (resourceId: string) => void;
};

export type ResourceDetailPanelHandle = {
  focusSearch: () => void;
};

export const ResourceDetailPanel = forwardRef<
  ResourceDetailPanelHandle,
  ResourceDetailPanelProps
>(function ResourceDetailPanel(
  {
    resource,
    fields,
    registry,
    datasetResources,
    onSelectResource,
    onUpdateResource,
    onRemoveResource,
  },
  ref
) {
  const { locale, text } = useResourceDetailText();
  const requiredFields = fields.filter((field) => (field.min ?? 0) > 0);
  const optionalFields = fields.filter((field) => (field.min ?? 0) === 0);
  const [fieldQuery, setFieldQuery] = useState("");
  const [listQuery, setListQuery] = useState("");
  const [fieldDialogOpen, setFieldDialogOpen] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  const focusSearch = useCallback(() => {
    setShowSearch(true);
    if (typeof window === "undefined") {
      searchInputRef.current?.focus();
      return;
    }
    window.requestAnimationFrame(() => {
      searchInputRef.current?.focus();
      searchInputRef.current?.select();
    });
  }, []);

  useImperativeHandle(ref, () => ({ focusSearch }), [focusSearch]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem("health-compose-field-search-visible");
    if (stored === "true" || stored === "false") {
      setShowSearch(stored === "true");
    }
    setSettingsLoaded(true);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!settingsLoaded) return;
    window.localStorage.setItem(
      "health-compose-field-search-visible",
      String(showSearch)
    );
  }, [showSearch, settingsLoaded]);

  const groupedFields = useMemo(() => {
    if (!resource) return [];
    const map = new Map<string, { root?: FieldDefinition; children: FieldDefinition[] }>();
    for (const field of fields) {
      const segment = field.segments[0];
      if (!segment) continue;
      const entry = map.get(segment) ?? { root: undefined, children: [] };
      if (field.segments.length === 1) {
        entry.root = field;
      } else {
        entry.children.push(field);
      }
      map.set(segment, entry);
    }
    return Array.from(map.entries())
      .map(([segment, entry]) => ({
        key: segment,
        root:
          entry.root ??
          ({
            id: segment,
            path: segment,
            segments: [segment],
            label: segment
              .replace(/[-_]/g, " ")
              .replace(/([a-z])([A-Z])/g, "$1 $2")
              .replace(/\s+/g, " ")
              .trim()
              .replace(/^\w/, (char) => char.toUpperCase()),
          } as FieldDefinition),
        children: entry.children,
      }))
      .sort((a, b) => a.root.label.localeCompare(b.root.label));
  }, [fields, resource]);

  const allAddableFields = useMemo(() => {
    if (!resource) return [];
    return fields.filter((field) => {
      if (field.segments.length !== 1) return false;
      if (isFieldFilled(resource.content, field)) return false;
      return true;
    });
  }, [fields, resource]);

  const addableFields = useMemo(() => {
    const normalizedQuery = fieldQuery.trim().toLowerCase();
    if (!normalizedQuery) return allAddableFields;
    return allAddableFields.filter((field) => {
      const label = `${field.label} ${field.path ?? ""}`.toLowerCase();
      return label.includes(normalizedQuery);
    });
  }, [allAddableFields, fieldQuery]);

  const referenceIndex = useMemo(
    () => buildDatasetReferenceIndex(datasetResources),
    [datasetResources]
  );

  const validationIssues = useMemo(() => {
    if (!resource || !registry) return [];
    return validateResourceWithProfile(resource.content, fields, registry, {
      existingReferences: referenceIndex,
      locale,
    });
  }, [fields, locale, referenceIndex, registry, resource]);

  if (!resource) {
    return (
      <div className="flex h-full flex-col">
        <div className="border-b border-foreground/10 px-4 py-3">
          <div className="text-sm font-semibold text-foreground">
            {text.fieldsTitle}
          </div>
          <div className="text-xs text-muted-foreground">
            {text.pickResourceToEdit}
          </div>
        </div>
        <div className="flex h-full items-center justify-center p-6 text-sm text-muted-foreground">
          {text.selectResourceToStart}
        </div>
      </div>
    );
  }

  const handleUpdate = (nextContent: Record<string, unknown>) => {
    onUpdateResource({
      ...resource,
      content: nextContent,
      updatedAt: Date.now(),
    });
  };

  const handleFieldAdd = (field: FieldDefinition) => {
    if (!registry) return;
    const defaultValue = getDefaultValueForField(field, registry);
    const nextContent = setFieldValue(resource.content, field, defaultValue);
    handleUpdate(nextContent);
  };

  const handleFieldRemove = (field: FieldDefinition) => {
    const nextContent = removeFieldValue(resource.content, field);
    handleUpdate(nextContent);
  };

  const visibleGroups = groupedFields.filter((group) => {
    if (getFieldValue(resource.content, group.root) === undefined) return false;
    if (!listQuery.trim()) return true;
    const normalized = listQuery.trim().toLowerCase();
    const rootLabel = `${group.root.label} ${group.root.path ?? ""}`.toLowerCase();
    if (rootLabel.includes(normalized)) return true;
    return group.children.some((child) => {
      const childLabel = `${child.label} ${child.path ?? ""}`.toLowerCase();
      return childLabel.includes(normalized);
    });
  });

  const knownTopLevel = new Set(fields.map((field) => field.segments[0]).filter(Boolean));
  const unknownKeys = Object.keys(resource.content).filter(
    (key) => key !== "resourceType" && !knownTopLevel.has(key)
  );

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-foreground/10 px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="text-sm font-semibold text-foreground">
              {text.fieldsTitle}
            </div>
            <div className="text-xs text-muted-foreground">
              {formatTemplate(text.requiredCount, {
                required: requiredFields.length,
                optional: optionalFields.length,
              })}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowSearch((prev) => !prev)}
              className="flex h-8 w-8 items-center justify-center rounded-md border border-foreground/20 text-muted-foreground hover:border-foreground/30 hover:text-foreground"
              aria-label={text.ariaToggleSearch}
            >
              <Search className="size-4" />
            </button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => onRemoveResource(resource.id)}
              className="text-destructive hover:text-destructive"
            >
              {text.remove}
            </Button>
            <Button
              size="sm"
              onClick={() => {
                setFieldQuery("");
                setFieldDialogOpen(true);
              }}
              disabled={allAddableFields.length === 0}
              className="gap-1.5"
            >
              <Plus className="size-4" />
              {text.addField}
            </Button>
          </div>
        </div>
        {showSearch ? (
          <div className="mt-2">
            <Input
              ref={searchInputRef}
              value={listQuery}
              onChange={(event) => setListQuery(event.target.value)}
              placeholder={text.searchFields}
              className="h-8"
            />
          </div>
        ) : null}
      </div>
      <ScrollArea className="flex-1 min-h-0">
        <div className="grid gap-4 p-4">
          {visibleGroups.length === 0 ? (
            <div className="rounded-lg border border-dashed border-foreground/15 px-3 py-6 text-center text-sm text-muted-foreground">
              <div>{text.noFieldsForProfile}</div>
              <div className="mt-3 flex justify-center">
                <Button
                  size="sm"
                  onClick={() => {
                    setFieldQuery("");
                    setFieldDialogOpen(true);
                  }}
                  disabled={allAddableFields.length === 0}
                  className="gap-1.5"
                >
                  <Plus className="size-4" />
                  {text.addField}
                </Button>
              </div>
            </div>
          ) : (
            visibleGroups.map((group) =>
              group.children.length === 0 ? (
                <FieldRow
                  key={group.key}
                  field={group.root}
                  content={resource.content}
                  registry={registry}
                  datasetResources={datasetResources}
                  referenceIndex={referenceIndex}
                  validationIssues={validationIssues}
                  onChange={handleUpdate}
                  onRemove={() => handleFieldRemove(group.root)}
                  onSelectResource={onSelectResource}
                />
              ) : (
                <ComplexFieldGroup
                  key={group.key}
                  group={group}
                  content={resource.content}
                  registry={registry}
                  datasetResources={datasetResources}
                  referenceIndex={referenceIndex}
                  validationIssues={validationIssues}
                  onChange={handleUpdate}
                  onSelectResource={onSelectResource}
                />
              )
            )
          )}
          <UnknownFieldsSection
            unknownKeys={unknownKeys}
            content={resource.content}
            title={text.unknownFieldsTitle}
            unknownFieldLabel={text.unknownField}
            notInProfileLabel={text.notInProfile}
            addValueLabel={text.addValue}
            onChange={handleUpdate}
          />
        </div>
      </ScrollArea>
      <Dialog
        open={fieldDialogOpen}
        onOpenChange={(open) => {
          setFieldDialogOpen(open);
          if (!open) {
            setFieldQuery("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{text.addFieldDialogTitle}</DialogTitle>
            <DialogDescription>{text.addFieldDialogDescription}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <Input
              value={fieldQuery}
              onChange={(event) => setFieldQuery(event.target.value)}
              placeholder={text.searchFields}
            />
            <div className="max-h-72 overflow-auto">
              {addableFields.length === 0 ? (
                <div className="px-3 py-4 text-sm text-muted-foreground">
                  {text.noFieldsAvailable}
                </div>
              ) : (
                <div className="grid gap-1 p-2">
                  {addableFields.map((field) => (
                    <button
                      key={field.id}
                      type="button"
                      onClick={() => {
                        handleFieldAdd(field);
                        setFieldQuery("");
                        setFieldDialogOpen(false);
                      }}
                      className="rounded-md border border-foreground/10 px-3 py-2 text-left text-sm hover:border-foreground/30 hover:bg-muted/40"
                    >
                      <div className="font-medium text-foreground">{field.label}</div>
                      <div className="text-xs text-muted-foreground">{field.path}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setFieldQuery("");
                setFieldDialogOpen(false);
              }}
            >
              {text.close}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
});
