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
import {
  createDefaultFieldValue,
  getChoiceKeys,
  getNodeChildren,
  getNodeKey,
  isNodePresent,
  setChildValue,
  validateResource,
  type SchemaContext,
  type SchemaNode,
  type SchemaTree,
} from "@/lib/fhir-editor/schema";
import { buildDatasetReferenceIndex } from "@/lib/fhir-editor/references";
import { ElementEditor } from "@/components/editor/resource-detail/schema-editor/ElementEditor";
import { SchemaEditorProvider } from "@/components/editor/resource-detail/schema-editor/context";
import { useResourceDetailText } from "@/components/editor/resource-detail/text";
import { formatTemplate } from "@/components/editor/resource-detail/utils";
import { UnknownFieldsSection } from "@/components/editor/resource-detail/UnknownFieldsSection";

type ResourceDetailPanelProps = {
  resource: DatasetResource | null;
  schemaTree: SchemaTree | null;
  schemaCtx: SchemaContext | null;
  datasetResources: DatasetResource[];
  onSelectResource: (resourceId: string) => void;
  onUpdateResource: (resource: DatasetResource) => void;
  onRemoveResource: (resourceId: string) => void;
};

export type ResourceDetailPanelHandle = {
  focusSearch: () => void;
};

const matchesQuery = (node: SchemaNode, normalizedQuery: string) => {
  if (!normalizedQuery) return true;
  const haystack = `${node.label} ${node.path} ${node.short ?? ""}`.toLowerCase();
  return haystack.includes(normalizedQuery);
};

export const ResourceDetailPanel = forwardRef<
  ResourceDetailPanelHandle,
  ResourceDetailPanelProps
>(function ResourceDetailPanel(
  {
    resource,
    schemaTree,
    schemaCtx,
    datasetResources,
    onSelectResource,
    onUpdateResource,
    onRemoveResource,
  },
  ref
) {
  const { locale, text } = useResourceDetailText();
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
    const stored = window.localStorage.getItem("fhir-explorer-field-search-visible");
    if (stored === "true" || stored === "false") {
      setShowSearch(stored === "true");
    }
    setSettingsLoaded(true);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!settingsLoaded) return;
    window.localStorage.setItem(
      "fhir-explorer-field-search-visible",
      String(showSearch)
    );
  }, [showSearch, settingsLoaded]);

  const rootChildren = useMemo(() => {
    if (!schemaTree || !schemaCtx) return [];
    return getNodeChildren(schemaTree.root, undefined, schemaCtx, schemaTree).children;
  }, [schemaTree, schemaCtx]);

  const referenceIndex = useMemo(
    () => buildDatasetReferenceIndex(datasetResources),
    [datasetResources]
  );

  const content = resource?.content;

  const validationIssues = useMemo(() => {
    if (!content || !schemaTree || !schemaCtx) return [];
    return validateResource(content, schemaTree, schemaCtx, {
      existingReferences: referenceIndex,
      locale,
    });
  }, [content, schemaTree, schemaCtx, referenceIndex, locale]);

  const requiredCount = rootChildren.filter((node) => node.min > 0).length;
  const optionalCount = rootChildren.length - requiredCount;

  const visibleNodes = useMemo(() => {
    if (!content) return [];
    const normalizedQuery = listQuery.trim().toLowerCase();
    return rootChildren.filter(
      (node) =>
        (isNodePresent(node, content) || node.min > 0) &&
        matchesQuery(node, normalizedQuery)
    );
  }, [rootChildren, content, listQuery]);

  const allAddableNodes = useMemo(() => {
    if (!content) return [];
    return rootChildren.filter(
      (node) => !isNodePresent(node, content) && node.min === 0 && node.max !== "0"
    );
  }, [rootChildren, content]);

  const addableNodes = useMemo(() => {
    const normalizedQuery = fieldQuery.trim().toLowerCase();
    if (!normalizedQuery) return allAddableNodes;
    return allAddableNodes.filter((node) => matchesQuery(node, normalizedQuery));
  }, [allAddableNodes, fieldQuery]);

  if (!resource || !content) {
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

  const handleAddNode = (node: SchemaNode) => {
    handleUpdate(
      setChildValue(content, getNodeKey(node), createDefaultFieldValue(node))
    );
  };

  const handleRemoveNode = (node: SchemaNode) => {
    let next = content;
    const keys = node.isChoice ? getChoiceKeys(node) : [node.key];
    for (const key of keys) {
      next = setChildValue(next, key, undefined);
    }
    handleUpdate(next);
  };

  const knownTopLevel = new Set<string>(["resourceType"]);
  for (const node of rootChildren) {
    if (node.isChoice) {
      for (const key of getChoiceKeys(node)) {
        knownTopLevel.add(key);
        knownTopLevel.add(`_${key}`);
      }
    } else {
      knownTopLevel.add(node.key);
      knownTopLevel.add(`_${node.key}`);
    }
  }
  const unknownKeys = Object.keys(content).filter((key) => !knownTopLevel.has(key));

  const editorContextValue =
    schemaTree && schemaCtx
      ? {
          ctx: schemaCtx,
          tree: schemaTree,
          datasetResources,
          referenceIndex,
          validationIssues,
          onSelectResource,
        }
      : null;

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-foreground/10 px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="text-sm font-semibold text-foreground">{text.fieldsTitle}</div>
            <div className="text-xs text-muted-foreground">
              {formatTemplate(text.requiredCount, {
                required: requiredCount,
                optional: optionalCount,
              })}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowSearch((previous) => !previous)}
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
              disabled={allAddableNodes.length === 0}
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
        <div className="grid gap-3 p-4">
          {!editorContextValue || visibleNodes.length === 0 ? (
            <div className="rounded-lg border border-dashed border-foreground/15 px-3 py-6 text-center text-sm text-muted-foreground">
              <div>{text.noFieldsForProfile}</div>
              {editorContextValue ? (
                <div className="mt-3 flex justify-center">
                  <Button
                    size="sm"
                    onClick={() => {
                      setFieldQuery("");
                      setFieldDialogOpen(true);
                    }}
                    disabled={allAddableNodes.length === 0}
                    className="gap-1.5"
                  >
                    <Plus className="size-4" />
                    {text.addField}
                  </Button>
                </div>
              ) : null}
            </div>
          ) : (
            <SchemaEditorProvider value={editorContextValue}>
              {visibleNodes.map((node) => (
                <ElementEditor
                  key={node.elementId}
                  node={node}
                  parentValue={content}
                  onParentChange={handleUpdate}
                  path=""
                  depth={0}
                  onRemoveElement={
                    node.min === 0 && isNodePresent(node, content)
                      ? () => handleRemoveNode(node)
                      : undefined
                  }
                />
              ))}
            </SchemaEditorProvider>
          )}
          <UnknownFieldsSection
            unknownKeys={unknownKeys}
            content={content}
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
              {addableNodes.length === 0 ? (
                <div className="px-3 py-4 text-sm text-muted-foreground">
                  {text.noFieldsAvailable}
                </div>
              ) : (
                <div className="grid gap-1 p-2">
                  {addableNodes.map((node) => (
                    <button
                      key={node.elementId}
                      type="button"
                      onClick={() => {
                        handleAddNode(node);
                        setFieldQuery("");
                        setFieldDialogOpen(false);
                      }}
                      className="rounded-md border border-foreground/10 px-3 py-2 text-left text-sm hover:border-foreground/30 hover:bg-muted/40"
                    >
                      <div className="font-medium text-foreground">{node.label}</div>
                      <div className="text-xs text-muted-foreground">
                        {node.path}
                        {node.short ? ` · ${node.short}` : ""}
                      </div>
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
