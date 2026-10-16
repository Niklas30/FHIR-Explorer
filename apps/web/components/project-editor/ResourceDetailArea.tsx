"use client";

import { Button } from "@fhir-explorer/ui/ui/button";
import { ResourceDetailPanel } from "@fhir-explorer/ui/editor/ResourceDetailPanel";
import { ResourceJsonPanel } from "@/components/editor/ResourceJsonPanel";
import type { DatasetResource } from "@fhir-explorer/core/datasets/content";
import type { SchemaContext, SchemaTree } from "@fhir-explorer/core/fhir-editor/schema";
import type { StructureDefinition } from "@fhir-explorer/core/fhir-editor/registry";
import type { AuthoredResource } from "@fhir-explorer/core/projects/types";
import { ReadOnlyResourcePanel } from "@/components/project-editor/ReadOnlyResourcePanel";
import { ProfileConstraintsPanel } from "@fhir-explorer/ui/editor/ProfileConstraintsPanel";
import type { ProjectEditorText } from "@/components/project-editor/project-editor/text";

export type DetailMode = "constraints" | "form" | "summary" | "json";

type Props = {
  text: ProjectEditorText;
  resource: AuthoredResource;
  isProfileLike: boolean;
  readOnly: boolean;
  detailMode: DetailMode;
  detailModes: DetailMode[];
  onModeChange: (mode: DetailMode) => void;
  resources: AuthoredResource[];
  schemaCtx: SchemaContext | null;
  schemaTree: SchemaTree | null;
  resolveStructureDefinition: (canonical: string) => StructureDefinition | null;
  valueSetOptions: Array<{ url: string; label: string }>;
  usedBy: AuthoredResource[];
  onContentChange: (content: Record<string, unknown>) => void;
  onSelectResource: (resourceId: string) => void;
  onUpdateResource: (resource: AuthoredResource) => void;
  onRemoveResource: (resourceId: string) => void;
};

const modeLabel = (mode: DetailMode, text: ProjectEditorText) => {
  if (mode === "constraints") return text.viewConstraints;
  if (mode === "form") return text.viewForm;
  if (mode === "summary") return text.nodeDashboard;
  return text.viewJson;
};

export const ResourceDetailArea = ({
  text,
  resource,
  isProfileLike,
  readOnly,
  detailMode,
  detailModes,
  onModeChange,
  resources,
  schemaCtx,
  schemaTree,
  resolveStructureDefinition,
  valueSetOptions,
  usedBy,
  onContentChange,
  onSelectResource,
  onUpdateResource,
  onRemoveResource,
}: Props) => {
  const renderBody = () => {
    if (detailMode === "constraints" && isProfileLike) {
      return (
        <ProfileConstraintsPanel
          content={resource.content as Record<string, unknown>}
          readOnly={readOnly}
          schemaCtx={schemaCtx}
          resolveStructureDefinition={resolveStructureDefinition}
          valueSetOptions={valueSetOptions}
          usedBy={usedBy.map((r) => ({
            id: r.id,
            label: r.title || (r.content.name as string) || r.resourceType,
          }))}
          onContentChange={onContentChange}
          onSelectResource={onSelectResource}
        />
      );
    }
    if (detailMode === "summary") {
      return <ReadOnlyResourcePanel text={text} resource={resource} />;
    }
    if (detailMode === "json") {
      return (
        <ResourceJsonPanel
          resource={resource as unknown as DatasetResource}
          datasetResources={resources as unknown as DatasetResource[]}
          schemaTree={schemaTree}
          schemaCtx={schemaCtx}
          onUpdateResource={(r) => onUpdateResource(r as unknown as AuthoredResource)}
        />
      );
    }
    return (
      <ResourceDetailPanel
        resource={resource as unknown as DatasetResource}
        schemaTree={schemaTree}
        schemaCtx={schemaCtx}
        datasetResources={resources as unknown as DatasetResource[]}
        onSelectResource={onSelectResource}
        onUpdateResource={(r) => onUpdateResource(r as unknown as AuthoredResource)}
        onRemoveResource={onRemoveResource}
      />
    );
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center gap-1 border-b border-foreground/10 px-3 py-2">
        {detailModes.map((mode) => (
          <Button
            key={mode}
            size="sm"
            variant={detailMode === mode ? "secondary" : "ghost"}
            onClick={() => onModeChange(mode)}
          >
            {modeLabel(mode, text)}
          </Button>
        ))}
      </div>
      <div className="min-h-0 flex-1">{renderBody()}</div>
    </div>
  );
};
