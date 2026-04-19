import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import { AlertTriangle, ArrowRight, Check, ChevronsUpDown, Plus, Search } from "lucide-react";
import { useI18n } from "@/components/i18n/I18nProvider";
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
import {
  buildDatasetReferenceIndex,
  isBrokenLocalReference,
  parseLocalReference,
} from "@/lib/fhir-editor/references";
import {
  validateResourceWithProfile,
  type ValidationIssue,
} from "@/lib/fhir-editor/validation";
import { byLocale } from "@/lib/i18n/select";
import { cn } from "@/lib/utils";

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

const formatOptionLabel = (system?: string, code?: string, display?: string) => {
  const label = display || code || "?";
  if (system) {
    const tail = system.split("/").pop();
    return `${label} · ${tail ?? system}`;
  }
  return label;
};

const normalizeTimeWithSeconds = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (/^\\d{2}:\\d{2}$/.test(trimmed)) {
    return `${trimmed}:00`;
  }
  return trimmed;
};

const parseMaxCardinality = (max?: string) => {
  if (!max || max === "*") return null;
  const parsed = Number(max);
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return parsed;
};

const isIssueForPath = (issuePath: string, targetPath: string) => {
  if (issuePath === targetPath) return true;
  return (
    issuePath.startsWith(`${targetPath}.`) ||
    issuePath.startsWith(`${targetPath}[`)
  );
};

const getFieldValidationIssues = (
  issues: ValidationIssue[],
  targetPath: string
) =>
  issues.filter(
    (issue) =>
      issue.code !== "reference-broken" && isIssueForPath(issue.path, targetPath)
  );

const formatTemplate = (template: string, values: Record<string, string | number>) =>
  template.replace(/\{(\w+)\}/g, (_, key) => String(values[key] ?? ""));

const useResourceDetailText = () => {
  const { locale } = useI18n();
  const enText = {
    unknownLabel: "Unknown",
    fieldsTitle: "Fields",
    pickResourceToEdit: "Pick a resource to edit",
    selectResourceToStart: "Select a resource to start editing its fields.",
    requiredCount: "{required} required, {optional} optional",
    ariaToggleSearch: "Toggle search",
    remove: "Remove",
    addField: "Add field",
    searchFields: "Search fields",
    noFieldsForProfile: "No fields available for this profile.",
    unknownFieldsTitle: "Unknown fields",
    unknownField: "Unknown field",
    notInProfile: "Not in profile",
    addValue: "Add value",
    addFieldDialogTitle: "Add field",
    addFieldDialogDescription: "Search and select a field to add to this resource.",
    noFieldsAvailable: "No fields available.",
    close: "Close",
    required: "Required",
    multiple: "Multiple",
    brokenReferenceTarget: "Broken reference target",
    missingTarget: "Missing target",
    validationErrorTooltip: "{count} validation error{suffix}",
    noValuesYet: "No values yet.",
    groupEntries: "Group · {count} entries",
    addEntry: "Add entry",
    noEntriesYet: "No entries yet.",
    entry: "Entry {index}",
    object: "Object",
    noFieldsYet: "No fields yet.",
    rawJson: "Raw JSON",
    jsonMustBeObject: "JSON must be an object.",
    invalidJson: "Invalid JSON",
    popupSearchPlaceholder: "Search",
    popupNoOptions: "No options available.",
    popupClear: "Clear",
    setDisplay: "Set display",
    selectReference: "Select reference",
    searchResources: "Search resources",
    noMatchingResources: "No matching resources.",
    referencePlaceholder: "ResourceType/id",
    openReferencedResource: "Open referenced resource",
    selectSystem: "Select system",
    searchSystems: "Search systems",
    selectIdentifierType: "Select identifier type",
    searchIdentifierTypes: "Search identifier types",
    systemUri: "System URI",
    identifierValue: "Identifier value",
    useOptional: "Use (optional)",
    searchUseValues: "Search use values",
    typeTextOptional: "Type text (optional)",
    typeSystemOptional: "Type system (optional)",
    typeCodeOptional: "Type code (optional)",
    typeDisplayOptional: "Type display (optional)",
    enabled: "Enabled",
    selectValue: "Select value",
    searchValues: "Search values",
    enterCode: "Enter code",
    orEnterCustomValue: "Or enter a custom value",
    systemUrl: "System URL",
    code: "Code",
    displayOptional: "Display (optional)",
    textOptional: "Text (optional)",
    searchValue: "Search value",
    removeValue: "Remove value",
    enterValue: "Enter value",
  };
  const text = byLocale(locale, {
    de: {
      unknownLabel: "Unbekannt",
      fieldsTitle: "Felder",
      pickResourceToEdit: "Wähle eine Ressource zum Bearbeiten",
      selectResourceToStart: "Wähle eine Ressource aus, um ihre Felder zu bearbeiten.",
      requiredCount: "{required} erforderlich, {optional} optional",
      ariaToggleSearch: "Suche umschalten",
      remove: "Entfernen",
      addField: "Feld hinzufügen",
      searchFields: "Felder suchen",
      noFieldsForProfile: "Keine Felder für dieses Profil verfügbar.",
      unknownFieldsTitle: "Unbekannte Felder",
      unknownField: "Unbekanntes Feld",
      notInProfile: "Nicht im Profil",
      addValue: "Wert hinzufügen",
      addFieldDialogTitle: "Feld hinzufügen",
      addFieldDialogDescription:
        "Suche ein Feld und füge es dieser Ressource hinzu.",
      noFieldsAvailable: "Keine Felder verfügbar.",
      close: "Schließen",
      required: "Erforderlich",
      multiple: "Mehrfach",
      brokenReferenceTarget: "Fehlendes Referenzziel",
      missingTarget: "Fehlendes Ziel",
      validationErrorTooltip: "{count} Validierungsfehler",
      noValuesYet: "Noch keine Werte.",
      groupEntries: "Gruppe · {count} Einträge",
      addEntry: "Eintrag hinzufügen",
      noEntriesYet: "Noch keine Einträge.",
      entry: "Eintrag {index}",
      object: "Objekt",
      noFieldsYet: "Noch keine Felder.",
      rawJson: "Rohes JSON",
      jsonMustBeObject: "JSON muss ein Objekt sein.",
      invalidJson: "Ungültiges JSON",
      popupSearchPlaceholder: "Suchen",
      popupNoOptions: "Keine Optionen verfügbar.",
      popupClear: "Leeren",
      setDisplay: "Display setzen",
      selectReference: "Referenz auswählen",
      searchResources: "Ressourcen suchen",
      noMatchingResources: "Keine passenden Ressourcen.",
      referencePlaceholder: "Ressourcentyp/id",
      openReferencedResource: "Referenzierte Ressource öffnen",
      selectSystem: "System auswählen",
      searchSystems: "Systeme suchen",
      selectIdentifierType: "Identifiertyp auswählen",
      searchIdentifierTypes: "Identifiertypen suchen",
      systemUri: "System-URI",
      identifierValue: "Identifier-Wert",
      useOptional: "Verwendung (optional)",
      searchUseValues: "Verwendungswerte suchen",
      typeTextOptional: "Typ-Text (optional)",
      typeSystemOptional: "Typ-System (optional)",
      typeCodeOptional: "Typ-Code (optional)",
      typeDisplayOptional: "Typ-Anzeige (optional)",
      enabled: "Aktiv",
      selectValue: "Wert auswählen",
      searchValues: "Werte suchen",
      enterCode: "Code eingeben",
      orEnterCustomValue: "Oder eigenen Wert eingeben",
      systemUrl: "System-URL",
      code: "Code",
      displayOptional: "Anzeige (optional)",
      textOptional: "Text (optional)",
      searchValue: "Wert suchen",
      removeValue: "Wert entfernen",
      enterValue: "Wert eingeben",
    },
    en: enText,
    fr: {
      ...enText,
      fieldsTitle: "Champs",
      remove: "Supprimer",
      addField: "Ajouter un champ",
      addFieldDialogTitle: "Ajouter un champ",
      addValue: "Ajouter une valeur",
      apply: "Appliquer",
      close: "Fermer",
      searchFields: "Rechercher des champs",
      removeValue: "Supprimer la valeur",
      enterValue: "Saisir une valeur",
    },
    es: {
      ...enText,
      fieldsTitle: "Campos",
      remove: "Eliminar",
      addField: "Agregar campo",
      addFieldDialogTitle: "Agregar campo",
      addValue: "Agregar valor",
      close: "Cerrar",
      searchFields: "Buscar campos",
      removeValue: "Eliminar valor",
      enterValue: "Introducir valor",
    },
    it: {
      ...enText,
      fieldsTitle: "Campi",
      remove: "Rimuovi",
      addField: "Aggiungi campo",
      addFieldDialogTitle: "Aggiungi campo",
      addValue: "Aggiungi valore",
      close: "Chiudi",
      searchFields: "Cerca campi",
      removeValue: "Rimuovi valore",
      enterValue: "Inserisci valore",
    },
  });

  return { locale, text };
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

  useImperativeHandle(
    ref,
    () => ({
      focusSearch,
    }),
    [focusSearch]
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem("fhir-explorer-field-search-visible");
    if (stored === "true" || stored === "false") {
      setShowSearch(stored === "true");
    }
    setSettingsLoaded(true);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!settingsLoaded) return;
    window.localStorage.setItem("fhir-explorer-field-search-visible", String(showSearch));
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
          <div className="text-sm font-semibold text-foreground">{text.fieldsTitle}</div>
          <div className="text-xs text-muted-foreground">{text.pickResourceToEdit}</div>
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
            <div className="text-sm font-semibold text-foreground">{text.fieldsTitle}</div>
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
          {unknownKeys.length > 0 ? (
            <div className="grid gap-3 rounded-lg border border-dashed border-foreground/15 px-4 py-3">
              <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {text.unknownFieldsTitle}
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
                          <div className="text-sm font-semibold text-foreground">
                            {text.unknownField}
                          </div>
                        </div>
                        <span className="rounded-full border border-foreground/20 px-2 py-0.5 text-[10px] uppercase text-muted-foreground">
                          {text.notInProfile}
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
                            {text.addValue}
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
            <DialogDescription>
              {text.addFieldDialogDescription}
            </DialogDescription>
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

const FieldRow = ({
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
  const kind = field.path.endsWith(".identifier")
    ? "Identifier"
    : resolveFieldKind(field);
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
  const canAddItem =
    effectiveRepeating && (maxItems === null || values.length < maxItems);
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
  const fieldErrorCount = fieldValidationIssues.filter(
    (issue) => issue.severity === "error"
  ).length;

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
            <button
              type="button"
              onClick={onRemove}
              className="text-xs text-destructive hover:text-destructive/80"
            >
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
          <Button
            variant="outline"
            size="sm"
            onClick={addItem}
            className="w-fit"
            disabled={!canAddItem}
          >
            {text.addValue}
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
  referenceIndex: Set<string>;
  validationIssues: ValidationIssue[];
  onChange: (nextContent: Record<string, unknown>) => void;
  onSelectResource: (resourceId: string) => void;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value && typeof value === "object" && !Array.isArray(value));

const ComplexFieldGroup = ({
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
  const rootKind = group.root.path.endsWith(".identifier")
    ? "Identifier"
    : resolveFieldKind(group.root);
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
  const rootErrorCount = rootValidationIssues.filter(
    (issue) => issue.severity === "error"
  ).length;

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
            <Label className="text-sm font-semibold text-foreground">
              {group.root.label}
            </Label>
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
                      canRemoveEntry
                        ? "hover:text-destructive/80"
                        : "cursor-not-allowed opacity-50"
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
                      onChange={(nextValue) =>
                        handleItemChange(isRecord(nextValue) ? nextValue : {})
                      }
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
                      onChange={(nextValue) =>
                        handleItemChange(isRecord(nextValue) ? nextValue : {})
                      }
                      allDatasetResources={datasetResources}
                      onOpenResource={onSelectResource}
                    />
                  ) : isCodeableRoot ? (
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
        <Label className="text-sm font-semibold text-foreground">
          {group.root.label}
        </Label>
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
            onChange={(nextValue) =>
              handleObjectChange(isRecord(nextValue) ? nextValue : {})
            }
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
            onChange={(nextValue) =>
              handleObjectChange(isRecord(nextValue) ? nextValue : {})
            }
            allDatasetResources={datasetResources}
            onOpenResource={onSelectResource}
          />
        ) : isCodeableRoot ? (
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
        <Button
          variant="outline"
          size="sm"
          onClick={() => onChange([...value, ""])}
          className="w-fit"
        >
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

type FieldInputProps = {
  kind: ReturnType<typeof resolveFieldKind>;
  value: unknown;
  options: Array<{ system?: string; code: string; display?: string }>;
  referenceOptions: DatasetResource[];
  identifierSystems?: Array<{ system: string; label: string }>;
  identifierTypeOptions?: Array<{ system?: string; code: string; display?: string }>;
  onChange: (value: unknown) => void;
  onRemove?: () => void;
  brokenReference?: string | null;
  allDatasetResources?: DatasetResource[];
  onOpenResource?: (resourceId: string) => void;
};

const IDENTIFIER_USE_OPTIONS = ["usual", "official", "temp", "secondary", "old"];

const getCodingAt = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== "object") return {};
  const record = value as Record<string, unknown>;
  const coding = record["coding"];
  if (Array.isArray(coding) && coding.length > 0) {
    const first = coding[0];
    if (first && typeof first === "object") {
      return first as Record<string, unknown>;
    }
  }
  return record;
};

const setCodingAt = (value: Record<string, unknown>, coding: Record<string, unknown>) => {
  if ("coding" in value || "text" in value) {
    return {
      ...value,
      coding: [coding],
    };
  }
  return {
    coding: [coding],
  };
};

const isReferenceValue = (
  value: unknown
): value is { reference?: string; display?: string; identifier?: unknown } =>
  Boolean(value && typeof value === "object" && "reference" in (value as Record<string, unknown>));

const extractReferenceString = (value: unknown): string | null => {
  if (typeof value === "string" && value.trim().length > 0) {
    return value.trim();
  }
  if (
    isReferenceValue(value) &&
    typeof value.reference === "string" &&
    value.reference.trim().length > 0
  ) {
    return value.reference.trim();
  }
  return null;
};

type PopupSearchOption = {
  value: string;
  label: string;
  searchText?: string;
};

type PopupSearchSelectProps = {
  value: string;
  options: PopupSearchOption[];
  placeholder: string;
  onValueChange: (value: string) => void;
  searchPlaceholder?: string;
  emptyMessage?: string;
  clearLabel?: string;
};

const PopupSearchSelect = ({
  value,
  options,
  placeholder,
  onValueChange,
  searchPlaceholder,
  emptyMessage,
  clearLabel,
}: PopupSearchSelectProps) => {
  const { text } = useResourceDetailText();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const effectiveSearchPlaceholder = searchPlaceholder ?? text.popupSearchPlaceholder;
  const effectiveEmptyMessage = emptyMessage ?? text.popupNoOptions;
  const effectiveClearLabel = clearLabel ?? text.popupClear;
  const selected = options.find((option) => option.value === value);
  const normalizedQuery = query.trim().toLowerCase();
  const filteredOptions = options.filter((option) => {
    if (!normalizedQuery) return true;
    const haystack = `${option.label} ${option.searchText ?? ""}`.toLowerCase();
    return haystack.includes(normalizedQuery);
  });

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex h-9 w-full items-center justify-between rounded-md border border-foreground/20 bg-background px-3 text-sm"
      >
        <span className={selected ? "text-foreground" : "text-muted-foreground"}>
          {selected?.label ?? placeholder}
        </span>
        <ChevronsUpDown className="size-4 text-muted-foreground" />
      </button>
      <Dialog
        open={open}
        onOpenChange={(nextOpen) => {
          setOpen(nextOpen);
          if (!nextOpen) {
            setQuery("");
          }
        }}
      >
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{placeholder}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <Input
              autoFocus
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={effectiveSearchPlaceholder}
            />
            <div className="max-h-80 overflow-auto rounded-md border border-foreground/10">
              <div className="grid gap-1 p-2">
                <button
                  type="button"
                  onClick={() => {
                    onValueChange("");
                    setOpen(false);
                  }}
                  className={cn(
                    "flex items-center justify-between rounded-md px-3 py-2 text-left text-sm hover:bg-muted/40",
                    !value ? "bg-muted/50" : ""
                  )}
                >
                  <span>{effectiveClearLabel}</span>
                  {!value ? <Check className="size-4 text-muted-foreground" /> : null}
                </button>
                {filteredOptions.length === 0 ? (
                  <div className="px-3 py-2 text-sm text-muted-foreground">
                    {effectiveEmptyMessage}
                  </div>
                ) : (
                  filteredOptions.map((option, index) => (
                    <button
                      key={`${option.value}-${index}`}
                      type="button"
                      onClick={() => {
                        onValueChange(option.value);
                        setOpen(false);
                      }}
                      className={cn(
                        "flex items-center justify-between rounded-md px-3 py-2 text-left text-sm hover:bg-muted/40",
                        value === option.value ? "bg-muted/50" : ""
                      )}
                    >
                      <span>{option.label}</span>
                      {value === option.value ? (
                        <Check className="size-4 text-muted-foreground" />
                      ) : null}
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

const FieldInput = ({
  kind,
  value,
  options,
  referenceOptions,
  identifierSystems,
  identifierTypeOptions,
  onChange,
  onRemove,
  brokenReference,
  allDatasetResources = [],
  onOpenResource,
}: FieldInputProps) => {
  const { text } = useResourceDetailText();
  const [includeReferenceDisplay, setIncludeReferenceDisplay] = useState(false);

  const renderReferenceInput = (currentValue: unknown) => {
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
      typeof currentValue === "object" && currentValue && "reference" in currentValue
        ? String((currentValue as { reference?: string }).reference ?? "")
        : typeof currentValue === "string"
        ? currentValue
        : "";
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
    const referenceSelectOptions = referenceOptions.map((entry) => {
      const name =
        typeof entry.content.name === "string" && entry.content.name.trim()
          ? entry.content.name.trim()
          : "";
      const title =
        typeof entry.content.title === "string" && entry.content.title.trim()
          ? entry.content.title.trim()
          : "";
      const displayId =
        typeof entry.content.id === "string" && entry.content.id
          ? entry.content.id
          : entry.id;
      const reference = getReferenceValue(entry);
      return {
        value: reference,
        label: getReferenceLabel(entry),
        searchText: `${entry.resourceType} ${entry.title ?? ""} ${name} ${title} ${displayId}`,
      };
    });

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
            onChange={(event) =>
              onChange({ reference: event.target.value })
            }
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

  if (kind === "Identifier") {
    const current = (value && typeof value === "object" ? value : {}) as Record<string, unknown>;
    const system = typeof current.system === "string" ? current.system : "";
    const idValue = typeof current.value === "string" ? current.value : "";
    const use = typeof current.use === "string" ? current.use : "";
    const type = (current.type && typeof current.type === "object" ? current.type : {}) as Record<string, unknown>;
    const coding = getCodingAt(type);
    const typeSystem = typeof coding.system === "string" ? coding.system : "";
    const typeCode = typeof coding.code === "string" ? coding.code : "";
    const typeDisplay = typeof coding.display === "string" ? coding.display : "";
    const typeText = typeof type["text"] === "string" ? (type["text"] as string) : "";
    const typeOptions = identifierTypeOptions ?? [];
    const typeKey = typeCode ? `${typeSystem}|${typeCode}` : "";

    const systemOptions = identifierSystems ?? [];
    return (
      <div className="grid gap-2">
        {systemOptions.length > 0 ? (
          <PopupSearchSelect
            value={system}
            options={systemOptions.map((option) => ({
              value: option.system,
              label: option.label,
              searchText: option.system,
            }))}
            placeholder={text.selectSystem}
            searchPlaceholder={text.searchSystems}
            onValueChange={(nextSystem) =>
              onChange({ ...current, system: nextSystem || undefined })
            }
          />
        ) : null}
        {typeOptions.length > 0 ? (
          <PopupSearchSelect
            value={typeKey}
            options={typeOptions.map((option) => {
              const key = `${option.system ?? ""}|${option.code}`;
              return {
                value: key,
                label: formatOptionLabel(option.system, option.code, option.display),
                searchText: `${option.system ?? ""} ${option.code} ${option.display ?? ""}`,
              };
            })}
            placeholder={text.selectIdentifierType}
            searchPlaceholder={text.searchIdentifierTypes}
            onValueChange={(nextKey) => {
              if (!nextKey) {
                const rest = { ...current };
                delete rest.type;
                onChange(rest);
                return;
              }
              const [systemValue, codeValue] = nextKey.split("|");
              const match = typeOptions.find(
                (option) => `${option.system ?? ""}|${option.code}` === nextKey
              );
              const nextCoding = {
                system: match?.system ?? systemValue,
                code: match?.code ?? codeValue,
                display: match?.display,
              };
              onChange({ ...current, type: setCodingAt(type, nextCoding) });
            }}
          />
        ) : null}
        <div className="grid gap-2 md:grid-cols-2">
          <Input
            value={system}
            onChange={(event) => onChange({ ...current, system: event.target.value })}
            placeholder={text.systemUri}
          />
          <Input
            value={idValue}
            onChange={(event) => onChange({ ...current, value: event.target.value })}
            placeholder={text.identifierValue}
          />
        </div>
        <div className="grid gap-2 md:grid-cols-2">
          <PopupSearchSelect
            value={use}
            options={IDENTIFIER_USE_OPTIONS.map((option) => ({
              value: option,
              label: option,
            }))}
            placeholder={text.useOptional}
            searchPlaceholder={text.searchUseValues}
            onValueChange={(nextUse) =>
              onChange({ ...current, use: nextUse || undefined })
            }
          />
          <Input
            value={typeText}
            onChange={(event) =>
              onChange({ ...current, type: { ...type, text: event.target.value } })
            }
            placeholder={text.typeTextOptional}
          />
        </div>
        <div className="grid gap-2 md:grid-cols-3">
          <Input
            value={typeSystem}
            onChange={(event) => {
              const nextCoding = { ...coding, system: event.target.value };
              onChange({ ...current, type: setCodingAt(type, nextCoding) });
            }}
            placeholder={text.typeSystemOptional}
          />
          <Input
            value={typeCode}
            onChange={(event) => {
              const nextCoding = { ...coding, code: event.target.value };
              onChange({ ...current, type: setCodingAt(type, nextCoding) });
            }}
            placeholder={text.typeCodeOptional}
          />
          <Input
            value={typeDisplay}
            onChange={(event) => {
              const nextCoding = { ...coding, display: event.target.value };
              onChange({ ...current, type: setCodingAt(type, nextCoding) });
            }}
            placeholder={text.typeDisplayOptional}
          />
        </div>
        {onRemove ? (
          <Button variant="ghost" size="sm" onClick={onRemove} className="w-fit">
            {text.remove}
          </Button>
        ) : null}
      </div>
    );
  }

  if (kind === "boolean") {
    return (
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          className="h-4 w-4 rounded border border-foreground/20"
          checked={Boolean(value)}
          onChange={(event) => onChange(event.target.checked)}
        />
        <span className="text-xs text-muted-foreground">{text.enabled}</span>
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
    const current = typeof value === "string" ? value : "";
    return (
      <Input
        type="time"
        step="1"
        value={normalizeTimeWithSeconds(current)}
        onChange={(event) => onChange(normalizeTimeWithSeconds(event.target.value))}
      />
    );
  }

  if (kind === "code") {
    if (options.length > 0) {
      const current = typeof value === "string" ? value : "";
      return (
        <PopupSearchSelect
          value={current}
          options={options.map((option) => ({
            value: option.code,
            label: formatOptionLabel(option.system, option.code, option.display),
            searchText: `${option.system ?? ""} ${option.code} ${option.display ?? ""}`,
          }))}
          placeholder={text.selectValue}
          searchPlaceholder={text.searchValues}
          onValueChange={(nextValue) => {
            onChange(nextValue || undefined);
          }}
        />
      );
    }
    return (
      <Input
        value={typeof value === "string" ? value : value ? String(value) : ""}
        onChange={(event) => onChange(event.target.value)}
        placeholder={text.enterCode}
      />
    );
  }

  if ((kind === "string" || kind === "uri" || kind === "url") && options.length > 0) {
    const current = typeof value === "string" ? value : value ? String(value) : "";
    return (
      <div className="grid gap-2">
        <PopupSearchSelect
          value={current}
          options={options.map((option) => ({
            value: option.code,
            label: formatOptionLabel(option.system, option.code, option.display),
            searchText: `${option.system ?? ""} ${option.code} ${option.display ?? ""}`,
          }))}
          placeholder={text.selectValue}
          searchPlaceholder={text.searchValues}
          onValueChange={(nextValue) => onChange(nextValue || undefined)}
        />
        <Input
          value={current}
          onChange={(event) => onChange(event.target.value)}
          placeholder={text.orEnterCustomValue}
        />
      </div>
    );
  }

  if (kind === "Reference" || isReferenceValue(value)) {
    return renderReferenceInput(value);
  }

  if (kind === "Coding" || kind === "CodeableConcept") {
    const conceptValue = isRecord(value) ? value : {};
    const conceptCodings = Array.isArray(conceptValue.coding)
      ? conceptValue.coding.filter(isRecord)
      : [];

    const toCleanCoding = (entry: Record<string, unknown>) => {
      const next: Record<string, unknown> = {};
      if (typeof entry.system === "string" && entry.system.trim().length > 0) {
        next.system = entry.system;
      }
      if (typeof entry.code === "string" && entry.code.trim().length > 0) {
        next.code = entry.code;
      }
      if (typeof entry.display === "string" && entry.display.trim().length > 0) {
        next.display = entry.display;
      }
      return next;
    };

    const withConcept = (nextConcept: Record<string, unknown>) => {
      onChange(Object.keys(nextConcept).length > 0 ? nextConcept : undefined);
    };

    const codingOptions = options.map((option) => {
      const key = `${option.system ?? ""}|${option.code}`;
      return {
        value: key,
        label: formatOptionLabel(option.system, option.code, option.display),
        searchText: `${option.system ?? ""} ${option.code} ${option.display ?? ""}`,
      };
    });

    if (kind === "Coding") {
      const currentCoding = isRecord(value) ? value : {};
      const currentSystem = typeof currentCoding.system === "string" ? currentCoding.system : "";
      const currentCode = typeof currentCoding.code === "string" ? currentCoding.code : "";
      const currentDisplay = typeof currentCoding.display === "string" ? currentCoding.display : "";
      const currentKey = currentCode ? `${currentSystem}|${currentCode}` : "";

      const updateCoding = (nextPartial: Record<string, unknown>) => {
        const nextCoding = {
          ...currentCoding,
          ...nextPartial,
        };
        const cleaned = toCleanCoding(nextCoding);
        onChange(Object.keys(cleaned).length > 0 ? cleaned : undefined);
      };

      return (
        <div className="grid gap-2">
          {options.length > 0 ? (
            <PopupSearchSelect
              value={currentKey}
              options={codingOptions}
              placeholder={text.selectValue}
              searchPlaceholder={text.searchValues}
              onValueChange={(nextKey) => {
                if (!nextKey) {
                  onChange(undefined);
                  return;
                }
                const [system, code] = nextKey.split("|");
                const option = options.find(
                  (entry) => `${entry.system ?? ""}|${entry.code}` === nextKey
                );
                updateCoding({
                  system: option?.system ?? system,
                  code: option?.code ?? code,
                  display: option?.display,
                });
              }}
            />
          ) : null}
          <div className="grid gap-2 md:grid-cols-3">
            <Input
              value={currentSystem}
              onChange={(event) => updateCoding({ system: event.target.value })}
              placeholder={text.systemUrl}
            />
            <Input
              value={currentCode}
              onChange={(event) => updateCoding({ code: event.target.value })}
              placeholder={text.code}
            />
            <Input
              value={currentDisplay}
              onChange={(event) => updateCoding({ display: event.target.value })}
              placeholder={text.displayOptional}
            />
          </div>
          {onRemove ? (
            <Button variant="ghost" size="sm" onClick={onRemove} className="w-fit">
              {text.remove}
            </Button>
          ) : null}
        </div>
      );
    }

    const conceptText = typeof conceptValue.text === "string" ? conceptValue.text : "";

    const updateConceptText = (nextText: string) => {
      const nextConcept: Record<string, unknown> = { ...conceptValue };
      if (nextText.trim().length === 0) {
        delete nextConcept.text;
      } else {
        nextConcept.text = nextText;
      }
      withConcept(nextConcept);
    };

    const updateCodingAt = (index: number, nextPartial: Record<string, unknown>) => {
      const nextCodings = [...conceptCodings];
      const current = nextCodings[index] ?? {};
      const merged = toCleanCoding({
        ...current,
        ...nextPartial,
      });
      if (Object.keys(merged).length > 0) {
        nextCodings[index] = merged;
      } else if (index < nextCodings.length) {
        nextCodings.splice(index, 1);
      }

      const nextConcept: Record<string, unknown> = { ...conceptValue };
      if (nextCodings.length > 0) {
        nextConcept.coding = nextCodings;
      } else {
        delete nextConcept.coding;
      }
      withConcept(nextConcept);
    };

    const updateCodingFromOption = (index: number, nextKey: string) => {
      if (!nextKey) {
        updateCodingAt(index, { system: "", code: "", display: "" });
        return;
      }
      const [system, code] = nextKey.split("|");
      const option = options.find((entry) => `${entry.system ?? ""}|${entry.code}` === nextKey);
      updateCodingAt(index, {
        system: option?.system ?? system,
        code: option?.code ?? code,
        display: option?.display,
      });
    };

    const addCoding = () => {
      const nextCodings = [...conceptCodings];
      const firstOption = options[0];
      if (firstOption) {
        nextCodings.push(
          toCleanCoding({
            system: firstOption.system,
            code: firstOption.code,
            display: firstOption.display,
          })
        );
      } else {
        nextCodings.push({});
      }
      const nextConcept: Record<string, unknown> = {
        ...conceptValue,
        coding: nextCodings,
      };
      withConcept(nextConcept);
    };

    const removeCodingAt = (index: number) => {
      const nextCodings = conceptCodings.filter((_, idx) => idx !== index);
      const nextConcept: Record<string, unknown> = { ...conceptValue };
      if (nextCodings.length > 0) {
        nextConcept.coding = nextCodings;
      } else {
        delete nextConcept.coding;
      }
      withConcept(nextConcept);
    };

    return (
      <div className="grid gap-3">
        <Input
          value={conceptText}
          onChange={(event) => updateConceptText(event.target.value)}
          placeholder={text.textOptional}
        />
        {conceptCodings.length === 0 ? (
          <div className="rounded-md border border-dashed border-foreground/15 px-3 py-2 text-xs text-muted-foreground">
            {text.noValuesYet}
          </div>
        ) : null}
        {conceptCodings.map((coding, index) => {
          const codingSystem = typeof coding.system === "string" ? coding.system : "";
          const codingCode = typeof coding.code === "string" ? coding.code : "";
          const codingDisplay = typeof coding.display === "string" ? coding.display : "";
          const codingKey = codingCode ? `${codingSystem}|${codingCode}` : "";

          return (
            <div key={`${index}-${codingKey}`} className="grid gap-2 rounded-md border border-foreground/10 p-2">
              {options.length > 0 ? (
                <PopupSearchSelect
                  value={codingKey}
                  options={codingOptions}
                  placeholder={text.searchValue}
                  searchPlaceholder={text.searchValues}
                  onValueChange={(nextKey) => updateCodingFromOption(index, nextKey)}
                />
              ) : null}
              <div className="grid gap-2 md:grid-cols-3">
                <Input
                  value={codingSystem}
                  onChange={(event) => updateCodingAt(index, { system: event.target.value })}
                  placeholder={text.systemUrl}
                />
                <Input
                  value={codingCode}
                  onChange={(event) => updateCodingAt(index, { code: event.target.value })}
                  placeholder={text.code}
                />
                <Input
                  value={codingDisplay}
                  onChange={(event) => updateCodingAt(index, { display: event.target.value })}
                  placeholder={text.displayOptional}
                />
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => removeCodingAt(index)}
                className="w-fit"
              >
                {text.removeValue}
              </Button>
            </div>
          );
        })}
        <Button variant="outline" size="sm" onClick={addCoding} className="w-fit">
          {text.addValue}
        </Button>
      </div>
    );
  }

  if (value !== null && typeof value === "object") {
    return (
      <div className="grid gap-2">
        <UnknownValueEditor value={value} onChange={onChange} />
        {onRemove ? (
          <Button variant="ghost" size="sm" onClick={onRemove} className="w-fit">
            {text.remove}
          </Button>
        ) : null}
      </div>
    );
  }

  return (
    <div className={cn("grid gap-2", onRemove ? "md:grid-cols-[1fr_auto]" : "")}>
      <Input
        value={typeof value === "string" ? value : value ? String(value) : ""}
        onChange={(event) => onChange(event.target.value)}
        placeholder={text.enterValue}
      />
      {onRemove ? (
        <Button variant="ghost" size="sm" onClick={onRemove}>
          {text.remove}
        </Button>
      ) : null}
    </div>
  );
};
