import { useEffect, useMemo, useState } from "react";
import { Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { DatasetResource } from "@/lib/datasets/content";
import type { FhirRegistry } from "@/lib/fhir-editor/registry";
import type { FieldDefinition } from "@/lib/fhir-editor/profiles";
import {
  getDefaultValueForField,
  getFieldValue,
  isFieldFilled,
  isRepeatingField,
  removeFieldValue,
  resolveFieldKind,
  resolveReferenceTargets,
  resolveValueSetChoices,
  setFieldValue,
} from "@/lib/fhir-editor/fields";
import { cn } from "@/lib/utils";

type ResourceDetailPanelProps = {
  resource: DatasetResource | null;
  fields: FieldDefinition[];
  registry: FhirRegistry | null;
  datasetResources: DatasetResource[];
  onUpdateResource: (resource: DatasetResource) => void;
  onRemoveResource: (resourceId: string) => void;
};

const formatOptionLabel = (system?: string, code?: string, display?: string) => {
  const label = display || code || "Unknown";
  if (system) {
    const tail = system.split("/").pop();
    return `${label} · ${tail ?? system}`;
  }
  return label;
};

export const ResourceDetailPanel = ({
  resource,
  fields,
  registry,
  datasetResources,
  onUpdateResource,
  onRemoveResource,
}: ResourceDetailPanelProps) => {
  const requiredFields = fields.filter((field) => (field.min ?? 0) > 0);
  const optionalFields = fields.filter((field) => (field.min ?? 0) === 0);
  const [fieldQuery, setFieldQuery] = useState("");
  const [listQuery, setListQuery] = useState("");
  const [fieldDialogOpen, setFieldDialogOpen] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [settingsLoaded, setSettingsLoaded] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem("fhir-compose-field-search-visible");
    if (stored === "true" || stored === "false") {
      setShowSearch(stored === "true");
    }
    setSettingsLoaded(true);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!settingsLoaded) return;
    window.localStorage.setItem("fhir-compose-field-search-visible", String(showSearch));
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
        root: entry.root ?? {
          id: segment,
          path: segment,
          segments: [segment],
          label: segment
            .replace(/[-_]/g, " ")
            .replace(/([a-z])([A-Z])/g, "$1 $2")
            .replace(/\\s+/g, " ")
            .trim()
            .replace(/^\\w/, (char) => char.toUpperCase()),
        },
        children: entry.children,
      }))
      .sort((a, b) => a.root.label.localeCompare(b.root.label));
  }, [fields, resource]);

  const addableFields = useMemo(() => {
    if (!resource) return [];
    const normalizedQuery = fieldQuery.trim().toLowerCase();
    return fields.filter((field) => {
      if (field.segments.length !== 1) return false;
      if (isFieldFilled(resource.content, field)) return false;
      if (!normalizedQuery) return true;
      const label = `${field.label} ${field.path ?? ""}`.toLowerCase();
      return label.includes(normalizedQuery);
    });
  }, [fields, resource, fieldQuery]);

  if (!resource) {
    return (
      <div className="flex h-full flex-col">
        <div className="border-b border-foreground/10 px-4 py-3">
          <div className="text-sm font-semibold text-foreground">Fields</div>
          <div className="text-xs text-muted-foreground">Pick a resource to edit</div>
        </div>
        <div className="flex h-full items-center justify-center p-6 text-sm text-muted-foreground">
          Select a resource to start editing its fields.
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
            <div className="text-sm font-semibold text-foreground">Fields</div>
            <div className="text-xs text-muted-foreground">
              {requiredFields.length} required, {optionalFields.length} optional
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowSearch((prev) => !prev)}
              className="flex h-8 w-8 items-center justify-center rounded-md border border-foreground/20 text-muted-foreground hover:border-foreground/30 hover:text-foreground"
              aria-label="Toggle search"
            >
              <Search className="size-4" />
            </button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => onRemoveResource(resource.id)}
              className="text-destructive hover:text-destructive"
            >
              Remove
            </Button>
            <Button
              size="sm"
              onClick={() => setFieldDialogOpen(true)}
              disabled={addableFields.length === 0}
              className="gap-1.5"
            >
              <Plus className="size-4" />
              Add field
            </Button>
          </div>
        </div>
        {showSearch ? (
          <div className="mt-2">
            <Input
              value={listQuery}
              onChange={(event) => setListQuery(event.target.value)}
              placeholder="Search fields"
              className="h-8"
            />
          </div>
        ) : null}
      </div>
      <ScrollArea className="flex-1 min-h-0">
        <div className="grid gap-4 p-4">
          {visibleGroups.length === 0 ? (
            <div className="rounded-lg border border-dashed border-foreground/15 px-3 py-6 text-center text-sm text-muted-foreground">
              <div>No fields available for this profile.</div>
              <div className="mt-3 flex justify-center">
                <Button
                  size="sm"
                  onClick={() => setFieldDialogOpen(true)}
                  disabled={addableFields.length === 0}
                  className="gap-1.5"
                >
                  <Plus className="size-4" />
                  Add field
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
                    onChange={handleUpdate}
                    onRemove={() => handleFieldRemove(group.root)}
                  />
                ) : (
                  <ComplexFieldGroup
                    key={group.key}
                    group={group}
                    content={resource.content}
                    registry={registry}
                    datasetResources={datasetResources}
                    onChange={handleUpdate}
                  />
                )
              )
          )}
          {unknownKeys.length > 0 ? (
            <div className="grid gap-3 rounded-lg border border-dashed border-foreground/15 px-4 py-3">
              <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Unknown Fields
              </div>
              <div className="grid gap-3">
                {unknownKeys.map((key) => {
                  const value = resource.content[key];
                  const isArray = Array.isArray(value);
                  const values = isArray ? value : [value];
                  return (
                    <div key={key} className="rounded-md border border-foreground/10 bg-background px-3 py-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                            {key}
                          </div>
                          <div className="text-sm font-semibold text-foreground">Unknown field</div>
                        </div>
                        <span className="rounded-full border border-foreground/20 px-2 py-0.5 text-[10px] uppercase text-muted-foreground">
                          Not in profile
                        </span>
                      </div>
                      <div className="mt-3 grid gap-3">
                        {values.map((entry, index) => (
                          <UnknownValueEditor
                            key={`${key}-${index}`}
                            value={entry}
                            onChange={(nextValue) => {
                              const nextContent = { ...resource.content };
                              if (isArray) {
                                const nextArray = [...values];
                                nextArray[index] = nextValue;
                                nextContent[key] = nextArray;
                              } else {
                                nextContent[key] = nextValue;
                              }
                              handleUpdate(nextContent);
                            }}
                          />
                        ))}
                        {isArray ? (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              const nextContent = { ...resource.content };
                              const nextArray = Array.isArray(value) ? [...value, {}] : [{}];
                              nextContent[key] = nextArray;
                              handleUpdate(nextContent);
                            }}
                            className="w-fit"
                          >
                            Add value
                          </Button>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null}
        </div>
      </ScrollArea>
      <Dialog open={fieldDialogOpen} onOpenChange={setFieldDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add field</DialogTitle>
            <DialogDescription>
              Search and select a field to add to this resource.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <Input
              value={fieldQuery}
              onChange={(event) => setFieldQuery(event.target.value)}
              placeholder="Search fields"
            />
            <div className="max-h-72 overflow-auto">
              {addableFields.length === 0 ? (
                <div className="px-3 py-4 text-sm text-muted-foreground">
                  No fields available.
                </div>
              ) : (
                <div className="grid gap-1 p-2">
                  {addableFields.map((field) => (
                    <button
                      key={field.id}
                      type="button"
                      onClick={() => {
                        handleFieldAdd(field);
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
            <Button variant="outline" onClick={() => setFieldDialogOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

type FieldRowProps = {
  field: FieldDefinition;
  content: Record<string, unknown>;
  registry: FhirRegistry | null;
  datasetResources: DatasetResource[];
  onChange: (nextContent: Record<string, unknown>) => void;
  onRemove: () => void;
};

const FieldRow = ({
  field,
  content,
  registry,
  datasetResources,
  onChange,
  onRemove,
}: FieldRowProps) => {
  const kind = resolveFieldKind(field);
  const isRepeating = isRepeatingField(field);
  const rawValue = getFieldValue(content, field);
  const values = isRepeating ? (Array.isArray(rawValue) ? rawValue : []) : [rawValue];
  const options = resolveValueSetChoices(field, registry ?? undefined);
  const referenceTargets = resolveReferenceTargets(field, registry ?? undefined);
  const allowAnyReference = referenceTargets.has("*") || referenceTargets.size === 0;

  const availableReferenceOptions = datasetResources.filter((resource) => {
    if (allowAnyReference) return true;
    return referenceTargets.has(resource.resourceType);
  });

  const updateValues = (nextValues: unknown[]) => {
    const value = isRepeating ? nextValues : nextValues[0];
    onChange(setFieldValue(content, field, value));
  };

  const updateItem = (index: number, value: unknown) => {
    const next = [...values];
    next[index] = value;
    updateValues(next);
  };

  const addItem = () => {
    const defaultValue = getDefaultValueForField(field, registry ?? undefined);
    const next = [...values, ...(Array.isArray(defaultValue) ? defaultValue : [defaultValue])];
    updateValues(next);
  };

  const removeItem = (index: number) => {
    const next = values.filter((_, idx) => idx !== index);
    updateValues(next);
  };

  const showRemove = (field.min ?? 0) === 0;

  return (
    <div className="rounded-lg border border-foreground/10 bg-background px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          {field.path ? (
            <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              {field.path}
            </div>
          ) : null}
          <Label className="text-sm font-semibold text-foreground">{field.label}</Label>
          {field.short ? (
            <p className="text-xs text-muted-foreground">{field.short}</p>
          ) : null}
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {(field.min ?? 0) > 0 ? <span className="text-emerald-600">Required</span> : null}
          {isRepeating ? <span>Multiple</span> : null}
          {showRemove ? (
            <button
              type="button"
              onClick={onRemove}
              className="text-xs text-destructive hover:text-destructive/80"
            >
              Remove
            </button>
          ) : null}
        </div>
      </div>
      <div className="mt-3 grid gap-3">
        {values.length === 0 ? (
          <div className="rounded-md border border-dashed border-foreground/15 px-3 py-3 text-xs text-muted-foreground">
            No values yet.
          </div>
        ) : null}
        {values.map((value, index) => (
          <FieldInput
            key={`${field.id}-${index}`}
            kind={kind}
            value={value}
            options={options}
            referenceOptions={availableReferenceOptions}
            onChange={(nextValue) => updateItem(index, nextValue)}
            onRemove={isRepeating ? () => removeItem(index) : undefined}
          />
        ))}
        {isRepeating ? (
          <Button variant="outline" size="sm" onClick={addItem} className="w-fit">
            Add value
          </Button>
        ) : null}
      </div>
    </div>
  );
};

type ComplexFieldGroupProps = {
  group: { key: string; root: FieldDefinition; children: FieldDefinition[] };
  content: Record<string, unknown>;
  registry: FhirRegistry | null;
  datasetResources: DatasetResource[];
  onChange: (nextContent: Record<string, unknown>) => void;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value && typeof value === "object" && !Array.isArray(value));

const ComplexFieldGroup = ({
  group,
  content,
  registry,
  datasetResources,
  onChange,
}: ComplexFieldGroupProps) => {
  const rootValue = getFieldValue(content, group.root);
  const isRepeating = isRepeatingField(group.root) || Array.isArray(rootValue);
  const rootKind = resolveFieldKind(group.root);
  const rootOptions = resolveValueSetChoices(group.root, registry ?? undefined);
  const showRootSelect =
    (rootKind === "CodeableConcept" || rootKind === "Coding") && rootOptions.length > 0;
  const childFields = group.children
    .map((field) => ({
      ...field,
      segments: field.segments.slice(1),
    }))
    .sort((a, b) => a.label.localeCompare(b.label));
  const filteredChildFields = showRootSelect
    ? childFields.filter((field) => !["coding", "text"].includes(field.segments[0] ?? ""))
    : childFields;

  const updateRoot = (nextValue: unknown) => {
    onChange(setFieldValue(content, group.root, nextValue));
  };

  if (isRepeating) {
    const items = Array.isArray(rootValue) ? rootValue : [];

    return (
      <div className="rounded-lg border border-foreground/10 bg-background px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <Label className="text-sm font-semibold text-foreground">
              {group.root.label}
            </Label>
            <p className="text-xs text-muted-foreground">Group · {items.length} entries</p>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => updateRoot([...items, {}])}
          >
            Add entry
          </Button>
        </div>
        <div className="mt-4 grid gap-4">
          {items.length === 0 ? (
            <div className="rounded-md border border-dashed border-foreground/15 px-3 py-3 text-xs text-muted-foreground">
              No entries yet.
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
                    Entry {index + 1}
                  </div>
                  <button
                    type="button"
                    onClick={handleRemoveItem}
                    className="text-xs text-destructive hover:text-destructive/80"
                  >
                    Remove
                  </button>
                </div>
                <div className="mt-3 grid gap-3">
                  {showRootSelect ? (
                    <FieldInput
                      kind={rootKind}
                      value={itemContent}
                      options={rootOptions}
                      referenceOptions={[]}
                      onChange={(nextValue) =>
                        handleItemChange(isRecord(nextValue) ? nextValue : {})
                      }
                    />
                  ) : null}
                  {filteredChildFields.map((field) => (
                    <FieldRow
                      key={`${field.id}-${index}`}
                      field={field}
                      content={itemContent}
                      registry={registry}
                      datasetResources={datasetResources}
                      onChange={handleItemChange}
                      onRemove={() => handleItemChange(removeFieldValue(itemContent, field))}
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
        <Label className="text-sm font-semibold text-foreground">
          {group.root.label}
        </Label>
      </div>
      <div className="mt-3 grid gap-3">
        {showRootSelect ? (
          <FieldInput
            kind={rootKind}
            value={objectValue}
            options={rootOptions}
            referenceOptions={[]}
            onChange={(nextValue) =>
              handleObjectChange(isRecord(nextValue) ? nextValue : {})
            }
          />
        ) : null}
        {filteredChildFields.map((field) => (
          <FieldRow
            key={field.id}
            field={field}
            content={objectValue}
            registry={registry}
            datasetResources={datasetResources}
            onChange={handleObjectChange}
            onRemove={() => handleObjectChange(removeFieldValue(objectValue, field))}
          />
        ))}
      </div>
    </div>
  );
};

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

const UnknownValueEditor = ({ value, onChange }: UnknownValueEditorProps) => {
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
          Object
        </div>
        <div className="mt-3 grid gap-2">
          {keys.length === 0 ? (
            <div className="text-xs text-muted-foreground">No fields yet.</div>
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
              Raw JSON
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
                    setError("JSON must be an object.");
                    return;
                  }
                  onChange(parsed);
                  setError(null);
                } catch (err) {
                  setError(err instanceof Error ? err.message : "Invalid JSON");
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
        <Button
          variant="outline"
          size="sm"
          onClick={() => onChange([...value, ""])}
          className="w-fit"
        >
          Add value
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
            setError(err instanceof Error ? err.message : "Invalid JSON");
          }
        }}
      />
      {error ? <div className="text-xs text-destructive">{error}</div> : null}
    </div>
  );
};

type FieldInputProps = {
  kind: ReturnType<typeof resolveFieldKind>;
  value: unknown;
  options: Array<{ system?: string; code: string; display?: string }>;
  referenceOptions: DatasetResource[];
  onChange: (value: unknown) => void;
  onRemove?: () => void;
};

const FieldInput = ({
  kind,
  value,
  options,
  referenceOptions,
  onChange,
  onRemove,
}: FieldInputProps) => {
  const [referenceQuery, setReferenceQuery] = useState("");
  if (kind === "boolean") {
    return (
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          className="h-4 w-4 rounded border border-foreground/20"
          checked={Boolean(value)}
          onChange={(event) => onChange(event.target.checked)}
        />
        <span className="text-xs text-muted-foreground">Enabled</span>
      </div>
    );
  }

  if (kind === "number") {
    return (
      <Input
        type="number"
        value={typeof value === "number" ? value : value ? Number(value) : ""}
        onChange={(event) => {
          const next = event.target.value;
          onChange(next === "" ? undefined : Number(next));
        }}
        placeholder="0"
      />
    );
  }

  if (kind === "date" || kind === "dateTime") {
    return (
      <Input
        type={kind === "date" ? "date" : "datetime-local"}
        value={typeof value === "string" ? value : ""}
        onChange={(event) => onChange(event.target.value)}
      />
    );
  }

  if (kind === "time") {
    return (
      <Input
        type="time"
        value={typeof value === "string" ? value : ""}
        onChange={(event) => onChange(event.target.value)}
      />
    );
  }

  if (kind === "code") {
    if (options.length > 0) {
      const current = typeof value === "string" ? value : "";
      return (
        <select
          value={current}
          onChange={(event) => {
            const nextValue = event.target.value;
            onChange(nextValue || undefined);
          }}
          className="h-9 rounded-md border border-foreground/20 bg-background px-3 text-sm"
        >
          <option value="">Select value</option>
          {options.map((option) => (
            <option key={`${option.system ?? ""}|${option.code}`} value={option.code}>
              {formatOptionLabel(option.system, option.code, option.display)}
            </option>
          ))}
        </select>
      );
    }
    return (
      <Input
        value={typeof value === "string" ? value : value ? String(value) : ""}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Enter code"
      />
    );
  }

  if (kind === "Reference") {
    const getReferenceValue = (entry: DatasetResource) => {
      const id =
        typeof entry.content.id === "string" && entry.content.id
          ? entry.content.id
        : entry.id;
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
      const id =
        typeof entry.content.id === "string" && entry.content.id
          ? entry.content.id
          : entry.id;
      const primary = name ?? title ?? entry.title;
      return primary ? `${primary} · ${entry.resourceType} · ${id}` : `${entry.resourceType} · ${id}`;
    };
    const currentReference =
      typeof value === "object" && value && "reference" in value
        ? String((value as { reference?: string }).reference ?? "")
        : typeof value === "string"
        ? value
        : "";

    const filteredOptions = referenceOptions.filter((entry) => {
      const name =
        typeof entry.content.name === "string" ? entry.content.name : "";
      const title =
        typeof entry.content.title === "string" ? entry.content.title : "";
      const displayId =
        typeof entry.content.id === "string" && entry.content.id
          ? entry.content.id
          : entry.id;
      const label = `${entry.resourceType} ${entry.title ?? ""} ${name} ${title} ${displayId}`.toLowerCase();
      const query = referenceQuery.trim().toLowerCase();
      if (!query) return true;
      return label.includes(query);
    });

    return (
      <div className="grid gap-2">
        <Input
          value={referenceQuery}
          onChange={(event) => setReferenceQuery(event.target.value)}
          placeholder="Search resources"
        />
        <select
          value={currentReference}
          onChange={(event) => {
            const reference = event.target.value;
            if (!reference) {
              onChange(undefined);
              return;
            }
            const match = referenceOptions.find(
              (entry) => getReferenceValue(entry) === reference
            );
            const name =
              match && typeof match.content.name === "string"
                ? match.content.name
                : undefined;
            const title =
              match && typeof match.content.title === "string"
                ? match.content.title
                : undefined;
            onChange({
              reference,
              display: match?.title ?? name ?? title,
            });
          }}
          className="h-9 rounded-md border border-foreground/20 bg-background px-3 text-sm"
        >
          <option value="">Select reference</option>
          {filteredOptions.length === 0 ? (
            <option value="" disabled>
              No matching resources
            </option>
          ) : (
            filteredOptions.map((entry) => {
              const reference = getReferenceValue(entry);
              return (
                <option key={entry.id} value={reference}>
                  {getReferenceLabel(entry)}
                </option>
              );
            })
          )}
        </select>
        <Input
          value={currentReference}
          onChange={(event) =>
            onChange({ reference: event.target.value })
          }
          placeholder="ResourceType/id"
        />
      </div>
    );
  }

  if (kind === "Coding" || kind === "CodeableConcept") {
    const currentCoding =
      kind === "Coding"
        ? (value as { system?: string; code?: string; display?: string })
        : (value as { coding?: Array<{ system?: string; code?: string; display?: string }> })
            ?.coding?.[0];

    const currentKey = currentCoding?.code
      ? `${currentCoding.system ?? ""}|${currentCoding.code}`
      : "";

    if (options.length > 0) {
      return (
        <div className="grid gap-2">
          <select
            value={currentKey}
            onChange={(event) => {
              const nextKey = event.target.value;
              if (!nextKey) {
                onChange(undefined);
                return;
              }
              const [system, code] = nextKey.split("|");
              const option = options.find(
                (entry) => `${entry.system ?? ""}|${entry.code}` === nextKey
              );
              if (kind === "Coding") {
                onChange({
                  system: option?.system ?? system,
                  code: option?.code ?? code,
                  display: option?.display,
                });
                return;
              }
              onChange({
                coding: [
                  {
                    system: option?.system ?? system,
                    code: option?.code ?? code,
                    display: option?.display,
                  },
                ],
                text: option?.display,
              });
            }}
            className="h-9 rounded-md border border-foreground/20 bg-background px-3 text-sm"
          >
            <option value="">Select value</option>
            {options.map((option) => {
              const key = `${option.system ?? ""}|${option.code}`;
              return (
                <option key={key} value={key}>
                  {formatOptionLabel(option.system, option.code, option.display)}
                </option>
              );
            })}
          </select>
          {onRemove ? (
            <Button variant="ghost" size="sm" onClick={onRemove} className="w-fit">
              Remove
            </Button>
          ) : null}
        </div>
      );
    }

    if (kind === "Coding") {
      return (
        <div className="grid gap-2 md:grid-cols-2">
          <Input
            value={currentCoding?.system ?? ""}
            onChange={(event) =>
              onChange({
                system: event.target.value,
                code: currentCoding?.code ?? "",
                display: currentCoding?.display,
              })
            }
            placeholder="System URL"
          />
          <Input
            value={currentCoding?.code ?? ""}
            onChange={(event) =>
              onChange({
                system: currentCoding?.system,
                code: event.target.value,
                display: currentCoding?.display,
              })
            }
            placeholder="Code"
          />
        </div>
      );
    }

    return (
      <Input
        value={isRecord(value) && typeof value.text === "string" ? value.text : ""}
        onChange={(event) => onChange({ text: event.target.value })}
        placeholder="Display text"
      />
    );
  }

  return (
    <div className={cn("grid gap-2", onRemove ? "md:grid-cols-[1fr_auto]" : "")}>
      <Input
        value={typeof value === "string" ? value : value ? String(value) : ""}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Enter value"
      />
      {onRemove ? (
        <Button variant="ghost" size="sm" onClick={onRemove}>
          Remove
        </Button>
      ) : null}
    </div>
  );
};
