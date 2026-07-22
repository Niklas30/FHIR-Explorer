"use client";

import { useMemo } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { AuthoredResource } from "@/lib/projects/types";
import { resourceLabel } from "@/lib/projects/content";
import type { ProjectEditorText } from "@/components/project-editor/project-editor/text";

type Props = {
  text: ProjectEditorText;
  resource: AuthoredResource | null;
};

export const ReadOnlyResourcePanel = ({ text, resource }: Props) => {
  const json = useMemo(
    () => (resource ? JSON.stringify(resource.content, null, 2) : ""),
    [resource]
  );

  if (!resource) {
    return (
      <div className="flex h-full items-center justify-center p-6 text-sm text-muted-foreground">
        {text.emptySection}
      </div>
    );
  }

  const label = resourceLabel(resource);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="border-b border-foreground/10 px-4 py-3">
        <div className="truncate text-sm font-semibold text-foreground">{label}</div>
        <div className="font-mono text-xs text-muted-foreground">{resource.resourceType}</div>
      </div>
      <ScrollArea className="min-h-0 flex-1">
        <pre className="whitespace-pre-wrap break-words p-4 font-mono text-xs text-foreground/90">
          {json}
        </pre>
      </ScrollArea>
    </div>
  );
};
