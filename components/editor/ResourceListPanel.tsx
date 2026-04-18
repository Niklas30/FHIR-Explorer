import { useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { DatasetResource } from "@/lib/datasets/content";

type ResourceListPanelProps = {
  resources: DatasetResource[];
  selectedId?: string | null;
  onSelect: (resourceId: string) => void;
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

const SORT_STORAGE_KEY = "fhir-compose-resource-sort";

export const ResourceListPanel = ({
  resources,
  selectedId,
  onSelect,
}: ResourceListPanelProps) => {
  const [sortMode, setSortMode] = useState<SortMode>("lastSelected");
  const [query, setQuery] = useState("");
  const [showSearch, setShowSearch] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem(SORT_STORAGE_KEY);
    if (stored === "lastSelected" || stored === "lastCreated" || stored === "alphabetic") {
      setSortMode(stored);
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(SORT_STORAGE_KEY, sortMode);
  }, [sortMode]);

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

  return (
    <div className="flex h-full flex-col">
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
      <ScrollArea className="h-full">
        <div className="grid gap-3 p-3">
          {resources.length === 0 ? (
            <div className="rounded-lg border border-dashed border-foreground/15 px-3 py-6 text-center text-sm text-muted-foreground">
              No resources yet. Create the first one from the header.
            </div>
          ) : (
            groupedResources.map(([resourceType, entries]) => (
              <div key={resourceType} className="grid gap-2">
                <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {resourceType} · {entries.length}
                </div>
                <div className="grid gap-2">
                  {entries.map((resource) => {
                    const isActive = resource.id === selectedId;
                    return (
                      <button
                        key={resource.id}
                        type="button"
                        onClick={() => onSelect(resource.id)}
                        className={cn(
                          "flex min-w-0 w-full flex-col gap-1 rounded-lg border px-3 py-2 text-left text-sm transition",
                          isActive
                            ? "border-foreground/30 bg-muted/50"
                            : "border-foreground/10 hover:border-foreground/30 hover:bg-muted/40"
                        )}
                      >
                        <span className="break-words whitespace-normal text-left text-sm font-medium leading-snug text-foreground">
                          {getResourceLabel(resource)}
                        </span>
                        <span className="break-words whitespace-normal text-left text-xs leading-snug text-muted-foreground">
                          {getResourceSecondary(resource)}
                          {resource.profile ? ` · ${resource.profile}` : ""}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
};
