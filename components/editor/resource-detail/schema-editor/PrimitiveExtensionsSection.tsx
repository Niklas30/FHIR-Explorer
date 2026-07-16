"use client";

import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import type { SchemaNode } from "@/lib/fhir-editor/schema";
import {
  createPrimitiveExtensionNode,
  getPrimitiveCompanionKey,
  isEmptyCompanion,
  isRecord,
  setChildValue,
} from "@/lib/fhir-editor/schema";
import { useResourceDetailText } from "@/components/editor/resource-detail/text";
import { formatTemplate } from "@/components/editor/resource-detail/utils";
import { ElementEditor } from "@/components/editor/resource-detail/schema-editor/ElementEditor";

type PrimitiveExtensionsSectionProps = {
  node: SchemaNode;
  /** JSON property name of the primitive value ("birthDate", "valueString"). */
  valueKey: string;
  parentValue: Record<string, unknown>;
  onParentChange: (next: Record<string, unknown>) => void;
  path: string;
  depth: number;
};

/**
 * Structured editing for primitive extensions via the underscore companion
 * property ("_birthDate"). Empty companions are removed from the JSON.
 */
export const PrimitiveExtensionsSection = ({
  node,
  valueKey,
  parentValue,
  onParentChange,
  path,
  depth,
}: PrimitiveExtensionsSectionProps) => {
  const { text } = useResourceDetailText();
  const companionKey = getPrimitiveCompanionKey(valueKey);
  const rawCompanion = parentValue[companionKey];
  const companion = isRecord(rawCompanion) ? rawCompanion : {};
  const extensionCount = Array.isArray(companion.extension)
    ? companion.extension.length
    : 0;
  const [open, setOpen] = useState(extensionCount > 0);

  const extensionNode = useMemo(() => createPrimitiveExtensionNode(node), [node]);

  const handleCompanionChange = (next: Record<string, unknown>) => {
    onParentChange(
      setChildValue(parentValue, companionKey, isEmptyCompanion(next) ? undefined : next)
    );
  };

  return (
    <div className="grid gap-2">
      <button
        type="button"
        onClick={() => setOpen((previous) => !previous)}
        className="flex w-fit items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
      >
        {open ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
        {formatTemplate(text.primitiveExtensions, { count: extensionCount })}
      </button>
      {open ? (
        <ElementEditor
          node={extensionNode}
          parentValue={companion}
          onParentChange={handleCompanionChange}
          path={path ? `${path}.${companionKey}` : companionKey}
          depth={depth + 1}
        />
      ) : null}
    </div>
  );
};
