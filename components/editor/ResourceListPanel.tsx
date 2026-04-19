import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, ChevronRight, MoreVertical, Plus, Search } from "lucide-react";
import { useI18n } from "@/components/i18n/I18nProvider";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { byLocale } from "@/lib/i18n/select";
import { cn } from "@/lib/utils";
import type { DatasetResource } from "@/lib/datasets/content";
import type { FieldDefinition } from "@/lib/fhir-editor/profiles";
import { buildFieldDefinitions, resolveProfileForResource } from "@/lib/fhir-editor/profiles";
import type { FhirRegistry } from "@/lib/fhir-editor/registry";
import { buildDatasetReferenceIndex } from "@/lib/fhir-editor/references";
import { validateResourceWithProfile } from "@/lib/fhir-editor/validation";

type ResourceListPanelProps = {
  resources: DatasetResource[];
  registry: FhirRegistry | null;
  selectedId?: string | null;
  onSelect: (resourceId: string) => void;
  onCreateResource?: () => void;
  onRemoveResource?: (resourceId: string) => void;
  onExportResource?: (resource: DatasetResource) => void;
  onDuplicateResource?: (resource: DatasetResource) => void;
};

const getResourceLabel = (resource: DatasetResource) => {
  const name = resource.content.name;
  if (typeof name === "string" && name.trim()) return name.trim();
  const title = resource.content.title;
  if (typeof title === "string" && title.trim()) return title.trim();
  if (resource.title) return resource.title;
  const id = resource.content.id;
  if (typeof id === "string" && id.trim()) return id;
  return resource.id;
};

const getResourceSecondary = (resource: DatasetResource) => {
  const id =
    typeof resource.content.id === "string" && resource.content.id.trim()
      ? resource.content.id
      : resource.id;
  return `${resource.resourceType} · ${id}`;
};

type SortMode = "lastSelected" | "lastCreated" | "alphabetic";

const SORT_STORAGE_KEY = "health-compose-resource-sort";
const SEARCH_VISIBLE_KEY = "health-compose-resource-search-visible";
const validationIssueCountCache = new Map<
  string,
  {
    updatedAt: number;
    referenceIndexSignature: string;
    profileKey: string;
    registrySignature: string;
    issueCount: number;
  }
>();

export const ResourceListPanel = ({
  resources,
  registry,
  selectedId,
  onSelect,
  onCreateResource,
  onRemoveResource,
  onExportResource,
  onDuplicateResource,
}: ResourceListPanelProps) => {
  const { locale } = useI18n();
  const [sortMode, setSortMode] = useState<SortMode>("lastSelected");
  const [query, setQuery] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [collapsedTypes, setCollapsedTypes] = useState<Set<string>>(() => new Set());
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const enText = {
    title: "Resources",
    inDataset: "{count} in dataset",
    ariaToggleSearch: "Toggle search",
    sortLastSelected: "Last selected",
    sortLastCreated: "Last added",
    sortAlphabetic: "Alphabetic",
    newResource: "New resource",
    searchResources: "Search resources",
    noResourcesYet: "No resources yet.",
    ariaOpenResourceMenu: "Open resource menu",
    exportResource: "Export resource",
    duplicateResource: "Duplicate resource",
    deleteResource: "Delete resource",
    validationErrorTooltip: "{count} validation error{suffix}",
  };
  const text = byLocale(locale, {
    de: {
      title: "Ressourcen",
      inDataset: "{count} im Dataset",
      ariaToggleSearch: "Suche umschalten",
      sortLastSelected: "Zuletzt ausgewählt",
      sortLastCreated: "Zuletzt erstellt",
      sortAlphabetic: "Alphabetisch",
      newResource: "Neue Ressource",
      searchResources: "Ressourcen suchen",
      noResourcesYet: "Noch keine Ressourcen.",
      ariaOpenResourceMenu: "Ressourcenmenü öffnen",
      exportResource: "Ressource exportieren",
      duplicateResource: "Ressource duplizieren",
      deleteResource: "Ressource löschen",
      validationErrorTooltip: "{count} Validierungsfehler",
    },
    en: enText,
    fr: {
      ...enText,
      title: "Ressources",
      sortLastSelected: "Dernière sélection",
      sortLastCreated: "Dernier ajout",
      sortAlphabetic: "Alphabétique",
      newResource: "Nouvelle ressource",
      searchResources: "Rechercher des ressources",
      noResourcesYet: "Aucune ressource pour le moment.",
      exportResource: "Exporter la ressource",
      duplicateResource: "Dupliquer la ressource",
      deleteResource: "Supprimer la ressource",
    },
    es: {
      ...enText,
      title: "Recursos",
      sortLastSelected: "Último seleccionado",
      sortLastCreated: "Último añadido",
      sortAlphabetic: "Alfabético",
      newResource: "Nuevo recurso",
      searchResources: "Buscar recursos",
      noResourcesYet: "Aún no hay recursos.",
      exportResource: "Exportar recurso",
      duplicateResource: "Duplicar recurso",
      deleteResource: "Eliminar recurso",
    },
    it: {
      ...enText,
      title: "Risorse",
      sortLastSelected: "Ultimo selezionato",
      sortLastCreated: "Ultimo aggiunto",
      sortAlphabetic: "Alfabetico",
      newResource: "Nuova risorsa",
      searchResources: "Cerca risorse",
      noResourcesYet: "Nessuna risorsa disponibile.",
      exportResource: "Esporta risorsa",
      duplicateResource: "Duplica risorsa",
      deleteResource: "Elimina risorsa",
    },
  });

  const format = (template: string, values: Record<string, string | number>) =>
    template.replace(/\{(\w+)\}/g, (_, key) => String(values[key] ?? ""));

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem(SORT_STORAGE_KEY);
    if (stored === "lastSelected" || stored === "lastCreated" || stored === "alphabetic") {
      setSortMode(stored);
    }
    const storedSearch = window.localStorage.getItem(SEARCH_VISIBLE_KEY);
    if (storedSearch === "true" || storedSearch === "false") {
      setShowSearch(storedSearch === "true");
    }
    setSettingsLoaded(true);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!settingsLoaded) return;
    window.localStorage.setItem(SORT_STORAGE_KEY, sortMode);
  }, [sortMode, settingsLoaded]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!settingsLoaded) return;
    window.localStorage.setItem(SEARCH_VISIBLE_KEY, String(showSearch));
  }, [showSearch, settingsLoaded]);

  const groupedResources = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const filtered = resources.filter((resource) => {
      if (!normalizedQuery) return true;
      const label = `${getResourceLabel(resource)} ${getResourceSecondary(resource)} ${resource.profile ?? ""}`.toLowerCase();
      return label.includes(normalizedQuery);
    });

    const sorted = [...filtered];
    sorted.sort((a, b) => {
      if (sortMode === "alphabetic") {
        return getResourceLabel(a).localeCompare(getResourceLabel(b));
      }
      if (sortMode === "lastCreated") {
        return b.createdAt - a.createdAt;
      }
      const aSelected = a.lastSelectedAt ?? 0;
      const bSelected = b.lastSelectedAt ?? 0;
      if (aSelected !== bSelected) return bSelected - aSelected;
      return b.createdAt - a.createdAt;
    });

    const map = new Map<string, DatasetResource[]>();
    for (const resource of sorted) {
      const list = map.get(resource.resourceType) ?? [];
      list.push(resource);
      map.set(resource.resourceType, list);
    }

    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [resources, sortMode, query]);

  const validationErrorsByResourceId = useMemo(() => {
    if (!registry) return new Map<string, number>();
    const referenceIndex = buildDatasetReferenceIndex(resources);
    const referenceIndexSignature = Array.from(referenceIndex).sort().join("|");
    const registrySignature = [
      registry.structureDefinitions.length,
      registry.valueSetsByUrl.size,
      registry.codeSystemsByUrl.size,
    ].join("|");
    const fieldsByProfile = new Map<string, FieldDefinition[]>();
    const byResourceId = new Map<string, number>();
    const nextIds = new Set(resources.map((resource) => resource.id));

    for (const resource of resources) {
      const updatedAt = resource.updatedAt ?? resource.createdAt ?? 0;
      const profile = resolveProfileForResource(resource.content, registry);
      if (!profile) continue;
      const profileKey = profile.url ?? profile.id ?? profile.type ?? resource.resourceType;

      const cached = validationIssueCountCache.get(resource.id);
      if (
        cached &&
        cached.updatedAt === updatedAt &&
        cached.referenceIndexSignature === referenceIndexSignature &&
        cached.profileKey === profileKey &&
        cached.registrySignature === registrySignature
      ) {
        if (cached.issueCount > 0) {
          byResourceId.set(resource.id, cached.issueCount);
        }
        continue;
      }

      const fields =
        fieldsByProfile.get(profileKey) ?? buildFieldDefinitions(profile, registry);
      if (!fieldsByProfile.has(profileKey)) {
        fieldsByProfile.set(profileKey, fields);
      }

      let issueCount = 0;
      try {
        issueCount = validateResourceWithProfile(resource.content, fields, registry, {
          existingReferences: referenceIndex,
          locale,
        }).filter((issue) => issue.severity === "error").length;
      } catch (error) {
        console.error("Failed to validate resource", resource.id, error);
      }

      const cacheEntry = {
        updatedAt,
        referenceIndexSignature,
        profileKey,
        registrySignature,
        issueCount,
      };
      validationIssueCountCache.set(resource.id, cacheEntry);
      if (issueCount > 0) {
        byResourceId.set(resource.id, issueCount);
      }
    }

    for (const resourceId of validationIssueCountCache.keys()) {
      if (!nextIds.has(resourceId)) {
        validationIssueCountCache.delete(resourceId);
      }
    }

    return byResourceId;
  }, [resources, registry, locale]);

  const toggleType = (resourceType: string) => {
    setCollapsedTypes((prev) => {
      const next = new Set(prev);
      if (next.has(resourceType)) {
        next.delete(resourceType);
      } else {
        next.add(resourceType);
      }
      return next;
    });
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="border-b border-foreground/10 px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="text-sm font-semibold text-foreground">{text.title}</div>
            <div className="text-xs text-muted-foreground">
              {format(text.inDataset, { count: resources.length })}
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
            <select
              value={sortMode}
              onChange={(event) => setSortMode(event.target.value as SortMode)}
              className="h-8 rounded-md border border-foreground/20 bg-background px-2 text-xs"
            >
              <option value="lastSelected">{text.sortLastSelected}</option>
              <option value="lastCreated">{text.sortLastCreated}</option>
              <option value="alphabetic">{text.sortAlphabetic}</option>
            </select>
            {onCreateResource ? (
              <Button size="sm" onClick={onCreateResource} className="gap-1.5">
                <Plus className="size-4" />
                <span className="hidden md:inline">{text.newResource}</span>
              </Button>
            ) : null}
          </div>
        </div>
        {showSearch ? (
          <div className="mt-2">
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={text.searchResources}
              className="h-8"
            />
          </div>
        ) : null}
      </div>
      <ScrollArea className="flex-1 min-h-0">
        <div className="grid gap-3 p-3">
          {resources.length === 0 ? (
            <div className="rounded-lg border border-dashed border-foreground/15 px-3 py-6 text-center text-sm text-muted-foreground">
              <div>{text.noResourcesYet}</div>
              {onCreateResource ? (
                <div className="mt-3 flex justify-center">
                  <Button size="sm" onClick={onCreateResource} className="gap-1.5">
                    <Plus className="size-4" />
                    {text.newResource}
                  </Button>
                </div>
              ) : null}
            </div>
          ) : (
            groupedResources.map(([resourceType, entries]) => {
              const isCollapsed = collapsedTypes.has(resourceType);
              return (
              <div key={resourceType} className="grid gap-2">
                <button
                  type="button"
                  onClick={() => toggleType(resourceType)}
                  className="flex items-center gap-2 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                  aria-expanded={!isCollapsed}
                >
                  <ChevronRight
                    className={cn("size-3 transition-transform", isCollapsed ? "" : "rotate-90")}
                  />
                  <span>
                    {resourceType} · {entries.length}
                  </span>
                </button>
                {isCollapsed ? null : (
                  <div className="grid gap-2">
                    {entries.map((resource) => {
                    const isActive = resource.id === selectedId;
                    const errorCount = validationErrorsByResourceId.get(resource.id) ?? 0;
                    const hasValidationErrors = errorCount > 0;
                    return (
                      <div
                        key={resource.id}
                        role="button"
                        tabIndex={0}
                        onClick={() => onSelect(resource.id)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            onSelect(resource.id);
                          }
                        }}
                        className={cn(
                          "relative flex min-w-0 w-full flex-col gap-1 rounded-lg border px-3 py-2 pr-10 text-left text-sm transition outline-none focus-visible:ring-2 focus-visible:ring-foreground/30",
                          isActive
                            ? "border-foreground/30 bg-muted/50"
                            : "border-foreground/10 hover:border-foreground/30 hover:bg-muted/40"
                        )}
                      >
                        <div className="absolute right-2 top-2">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button
                                type="button"
                                onClick={(event) => event.stopPropagation()}
                                className="flex h-7 w-7 items-center justify-center rounded-md border border-foreground/15 text-muted-foreground hover:border-foreground/30 hover:text-foreground"
                                aria-label={text.ariaOpenResourceMenu}
                              >
                                <MoreVertical className="size-4" />
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-44">
                              <DropdownMenuItem
                                onClick={(event) => {
                                  event.stopPropagation();
                                  onExportResource?.(resource);
                                }}
                              >
                                {text.exportResource}
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={(event) => {
                                  event.stopPropagation();
                                  onDuplicateResource?.(resource);
                                }}
                              >
                                {text.duplicateResource}
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={(event) => {
                                  event.stopPropagation();
                                  onRemoveResource?.(resource.id);
                                }}
                                className="text-destructive focus:text-destructive"
                              >
                                {text.deleteResource}
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                        <span className="min-w-0 break-words whitespace-normal text-left text-sm font-medium leading-snug text-foreground [overflow-wrap:anywhere]">
                          {getResourceLabel(resource)}
                        </span>
                        <div className="flex flex-wrap items-center gap-2 text-xs leading-snug">
                          <span className="min-w-0 break-words whitespace-normal text-left text-muted-foreground [overflow-wrap:anywhere]">
                            {getResourceSecondary(resource)}
                            {resource.profile ? ` · ${resource.profile}` : ""}
                          </span>
                          {hasValidationErrors ? (
                            <span
                              className="inline-flex items-center gap-1 rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-700"
                              title={format(text.validationErrorTooltip, {
                                count: errorCount,
                                suffix: locale === "en" && errorCount === 1 ? "" : "s",
                              })}
                            >
                              <AlertTriangle className="size-3" />
                              {errorCount}
                            </span>
                          ) : null}
                        </div>
                      </div>
                    );
                    })}
                  </div>
                )}
              </div>
            );
            })
          )}
        </div>
      </ScrollArea>
    </div>
  );
};
