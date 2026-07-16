"use client";

import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { SchemaNode } from "@/lib/fhir-editor/schema";
import {
  getExtensionDefinitionTree,
  getExtensionUrl,
  getSchemaTreeByCanonical,
  isRecord,
  setChildValue,
} from "@/lib/fhir-editor/schema";
import {
  PopupSearchSelect,
  type PopupSearchOption,
} from "@/components/editor/resource-detail/PopupSearchSelect";
import { useResourceDetailText } from "@/components/editor/resource-detail/text";
import { useSchemaEditor } from "@/components/editor/resource-detail/schema-editor/context";
import { ElementEditor } from "@/components/editor/resource-detail/schema-editor/ElementEditor";

/** Fallback value[x] node for extensions without a resolvable definition. */
const FALLBACK_EXTENSION_VALUE_NODE: SchemaNode = {
  key: "value",
  elementId: "Extension.value[x]",
  path: "Extension.value[x]",
  label: "Value",
  min: 0,
  max: "1",
  baseMax: "1",
  isArray: false,
  types: [
    { code: "string" },
    { code: "boolean" },
    { code: "integer" },
    { code: "decimal" },
    { code: "date" },
    { code: "dateTime" },
    { code: "uri" },
    { code: "code" },
    { code: "Coding" },
    { code: "CodeableConcept" },
    { code: "Quantity" },
    { code: "Period" },
    { code: "Reference" },
  ],
  isChoice: true,
  slices: [],
  children: [],
};

export const ExtensionEditor = ({
  node,
  value,
  onChange,
  path,
  depth,
}: {
  node: SchemaNode;
  value: unknown;
  onChange: (value: unknown) => void;
  path: string;
  depth: number;
}) => {
  const { ctx } = useSchemaEditor();
  const { text } = useResourceDetailText();
  const record = isRecord(value) ? value : {};
  const currentUrl = typeof record.url === "string" ? record.url : "";

  const definitionChildren = useMemo((): SchemaNode[] => {
    // 1. Inline children from the profile differential / complex extension.
    if (node.children.length > 0) return node.children;
    // 2. Definition referenced via type profile (extension slices).
    const definitionTree = getExtensionDefinitionTree(node, ctx);
    if (definitionTree) return definitionTree.root.children;
    if (currentUrl) {
      // 3. Slice of this element matching the current url.
      const slice = node.slices.find(
        (candidate) => getExtensionUrl(candidate, ctx) === currentUrl
      );
      if (slice) {
        if (slice.children.length > 0) return slice.children;
        const sliceTree = getExtensionDefinitionTree(slice, ctx);
        if (sliceTree) return sliceTree.root.children;
      }
      // 4. Extension definition registered under the url.
      const urlTree = getSchemaTreeByCanonical(currentUrl, ctx);
      if (urlTree && urlTree.definition.type === "Extension") {
        return urlTree.root.children;
      }
    }
    return [];
  }, [node, ctx, currentUrl]);

  const urlNode = definitionChildren.find((child) => child.key === "url");
  const valueNode = definitionChildren.find((child) => child.key === "value");
  const subExtensionNode = definitionChildren.find(
    (child) => child.key === "extension" && child.slices.length > 0
  );

  const fixedUrl =
    (typeof urlNode?.fixedValue === "string" ? urlNode.fixedValue : undefined) ??
    getExtensionUrl(node, ctx);

  const urlSuggestions: PopupSearchOption[] = [];
  for (const slice of node.slices) {
    const sliceUrl = getExtensionUrl(slice, ctx);
    if (sliceUrl) {
      urlSuggestions.push({
        value: sliceUrl,
        label: slice.sliceName ?? sliceUrl,
        searchText: sliceUrl,
      });
    }
  }

  const effectiveValueNode =
    valueNode && valueNode.max !== "0"
      ? valueNode
      : !subExtensionNode && definitionChildren.length === 0
        ? FALLBACK_EXTENSION_VALUE_NODE
        : null;

  return (
    <div className="grid gap-3">
      <div className="grid gap-1">
        <Label className="text-xs text-muted-foreground">{text.extensionUrl}</Label>
        {fixedUrl ? (
          <div
            className="truncate rounded-md border border-foreground/10 bg-muted/40 px-3 py-2 text-xs text-muted-foreground"
            title={fixedUrl}
          >
            {fixedUrl}
          </div>
        ) : (
          <div className="grid gap-1">
            {urlSuggestions.length > 0 ? (
              <PopupSearchSelect
                value={currentUrl}
                options={urlSuggestions}
                placeholder={text.selectValue}
                onValueChange={(nextUrl) =>
                  onChange(setChildValue(record, "url", nextUrl || undefined))
                }
              />
            ) : null}
            <Input
              value={currentUrl}
              placeholder="https://…"
              onChange={(event) =>
                onChange(setChildValue(record, "url", event.target.value || undefined))
              }
            />
          </div>
        )}
      </div>
      {fixedUrl && currentUrl !== fixedUrl ? (
        // Keep the serialized url in sync with the profile-defined url.
        <Button
          size="sm"
          variant="outline"
          className="w-fit"
          onClick={() => onChange(setChildValue(record, "url", fixedUrl))}
        >
          {text.addValue}: url
        </Button>
      ) : null}
      {effectiveValueNode ? (
        <ElementEditor
          node={effectiveValueNode}
          parentValue={record}
          onParentChange={onChange}
          path={path}
          depth={depth + 1}
        />
      ) : null}
      {subExtensionNode ? (
        <ElementEditor
          node={subExtensionNode}
          parentValue={record}
          onParentChange={onChange}
          path={path}
          depth={depth + 1}
        />
      ) : null}
    </div>
  );
};
