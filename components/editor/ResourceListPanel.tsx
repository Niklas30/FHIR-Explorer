import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, ChevronRight, MoreVertical, Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { DatasetResource } from "@/lib/datasets/content";
import {
  buildDatasetReferenceIndex,
  collectBrokenReferences,
} from "@/lib/fhir-editor/references";

type ResourceListPanelProps = {
  resources: DatasetResource[];
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
const brokenReferenceIssueCache = new Map<
  string,
  { updatedAt: number; referenceIndexSignature: string; issueCount: number }
>();

export const ResourceListPanel = ({
  resources,
  selectedId,
  onSelect,
  onCreateResource,
  onRemoveResource,
  onExportResource,
  onDuplicateResource,
}: ResourceListPanelProps) => {
  const [sortMode, setSortMode] = useState<SortMode>("lastSelected");
  const [query, setQuery] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [collapsedTypes, setCollapsedTypes] = useState<Set<string>>(() => new Set());
  const [settingsLoaded, setSettingsLoaded] = useState(false);

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

  const brokenReferenceIssuesByResourceId = useMemo(() => {
    const referenceIndex = buildDatasetReferenceIndex(resources);
    const referenceIndexSignature = Array.from(referenceIndex).sort().join("|");
    const byResourceId = new Map<string, number>();
    const nextIds = new Set(resources.map((resource) => resource.id));

    for (const resource of resources) {
      const updatedAt = resource.updatedAt ?? resource.createdAt ?? 0;
      const cached = brokenReferenceIssueCache.get(resource.id);
      if (
        cached &&
        cached.updatedAt === updatedAt &&
        cached.referenceIndexSignature === referenceIndexSignature
      ) {
        if (cached.issueCount > 0) {
          byResourceId.set(resource.id, cached.issueCount);
        }
        continue;
      }

      let issueCount = 0;
      try {
        issueCount = collectBrokenReferences(resource.content, referenceIndex, {
          maxNodes: 6_000,
          maxDepth: 50,
        }).length;
      } catch (error) {
        console.error("Failed to collect broken references for resource", resource.id, error);
      }

      const cacheEntry = { updatedAt, referenceIndexSignature, issueCount };
      brokenReferenceIssueCache.set(resource.id, cacheEntry);
      if (issueCount > 0) {
        byResourceId.set(resource.id, issueCount);
      }
    }

    for (const resourceId of brokenReferenceIssueCache.keys()) {
      if (!nextIds.has(resourceId)) {
        brokenReferenceIssueCache.delete(resourceId);
      }
    }

    return byResourceId;
  }, [resources]);

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
            <div className="text-sm font-semibold text-foreground">Resources</div>
            <div className="text-xs text-muted-foreground">{resources.length} in dataset</div>
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
            <select
              value={sortMode}
              onChange={(event) => setSortMode(event.target.value as SortMode)}
              className="h-8 rounded-md border border-foreground/20 bg-background px-2 text-xs"
            >
              <option value="lastSelected">Last selected</option>
              <option value="lastCreated">Last added</option>
              <option value="alphabetic">Alphabetic</option>
            </select>
            {onCreateResource ? (
              <Button size="sm" onClick={onCreateResource} className="gap-1.5">
                <Plus className="size-4" />
                <span className="hidden md:inline">New resource</span>
              </Button>
            ) : null}
          </div>
        </div>
        {showSearch ? (
          <div className="mt-2">
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search resources"
              className="h-8"
            />
          </div>
        ) : null}
      </div>
      <ScrollArea className="flex-1 min-h-0">
        <div className="grid gap-3 p-3">
          {resources.length === 0 ? (
            <div className="rounded-lg border border-dashed border-foreground/15 px-3 py-6 text-center text-sm text-muted-foreground">
              <div>No resources yet.</div>
              {onCreateResource ? (
                <div className="mt-3 flex justify-center">
                  <Button size="sm" onClick={onCreateResource} className="gap-1.5">
                    <Plus className="size-4" />
                    New resource
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
                    const brokenIssues = brokenReferenceIssuesByResourceId.get(resource.id) ?? 0;
                    const hasBrokenReferences = brokenIssues > 0;
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
                                aria-label="Open resource menu"
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
                                Export resource
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={(event) => {
                                  event.stopPropagation();
                                  onDuplicateResource?.(resource);
                                }}
                              >
                                Duplicate resource
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={(event) => {
                                  event.stopPropagation();
                                  onRemoveResource?.(resource.id);
                                }}
                                className="text-destructive focus:text-destructive"
                              >
                                Delete resource
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                        <span className="break-words whitespace-normal text-left text-sm font-medium leading-snug text-foreground">
                          {getResourceLabel(resource)}
                        </span>
                        <div className="flex flex-wrap items-center gap-2 text-xs leading-snug">
                          <span className="break-words whitespace-normal text-left text-muted-foreground">
                            {getResourceSecondary(resource)}
                            {resource.profile ? ` · ${resource.profile}` : ""}
                          </span>
                          {hasBrokenReferences ? (
                            <span
                              className="inline-flex items-center gap-1 rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-700"
                              title={`${brokenIssues} broken reference${brokenIssues === 1 ? "" : "s"}`}
                            >
                              <AlertTriangle className="size-3" />
                              {brokenIssues}
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
