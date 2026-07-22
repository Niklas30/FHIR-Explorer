"use client";

import { useMemo, useState } from "react";
import { ChevronRight, ChevronDown, Link2, Star } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  buildSchemaTree,
  getNodeChildren,
  type SchemaContext,
  type SchemaNode,
} from "@/lib/fhir-editor/schema";
import type { StructureDefinition } from "@/lib/fhir-editor/registry";
import type { AuthoredResource } from "@/lib/projects/types";
import {
  countConstraints,
  formatCardinality,
  readConstraint,
  toBaseElement,
  writeConstraint,
  type BindingStrength,
  type ConstraintPatch,
} from "@/lib/projects/profile-constraints";
import type { ProjectEditorText } from "@/components/project-editor/project-editor/text";

const STRENGTHS: BindingStrength[] = ["required", "extensible", "preferred", "example"];

type ValueSetOption = { url: string; label: string };

type Props = {
  text: ProjectEditorText;
  resource: AuthoredResource;
  readOnly: boolean;
  schemaCtx: SchemaContext | null;
  resolveStructureDefinition: (canonical: string) => StructureDefinition | null;
  valueSetOptions: ValueSetOption[];
  usedBy: AuthoredResource[];
  onContentChange: (content: Record<string, unknown>) => void;
  onSelectResource: (resourceId: string) => void;
};

const ElementRow = ({
  node,
  depth,
  content,
  readOnly,
  schemaCtx,
  ownerTree,
  valueSetOptions,
  text,
  onPatch,
}: {
  node: SchemaNode;
  depth: number;
  content: Record<string, unknown>;
  readOnly: boolean;
  schemaCtx: SchemaContext;
  ownerTree: ReturnType<typeof buildSchemaTree>;
  valueSetOptions: ValueSetOption[];
  text: ProjectEditorText;
  onPatch: (path: string, patch: ConstraintPatch) => void;
}) => {
  const [expanded, setExpanded] = useState(false);
  const base = toBaseElement(node);
  const constraint = readConstraint(content, node.path);
  const hasConstraint =
    constraint.min !== undefined ||
    constraint.max !== undefined ||
    constraint.mustSupport ||
    Boolean(constraint.binding);

  const effMin = constraint.min ?? base.baseMin;
  const effMax = constraint.max ?? base.baseMax;
  const cardChanged =
    constraint.min !== undefined || constraint.max !== undefined;

  const children = useMemo(() => {
    if (!expanded) return [];
    const typeCode = node.types[0]?.code;
    return getNodeChildren(node, typeCode, schemaCtx, ownerTree ?? undefined).children;
  }, [expanded, node, schemaCtx, ownerTree]);

  const canExpand = node.types.some((t) =>
    t.code ? /^[A-Z]/.test(t.code) || t.code === "BackboneElement" : false
  );

  return (
    <>
      <div
        className={cn(
          "grid grid-cols-[1fr_auto] items-start gap-3 border-b border-foreground/5 px-3 py-2",
          hasConstraint && "bg-primary/5"
        )}
        style={{ paddingLeft: `${12 + depth * 16}px` }}
      >
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            {canExpand ? (
              <button
                type="button"
                onClick={() => setExpanded((v) => !v)}
                className="text-muted-foreground hover:text-foreground"
                aria-label={expanded ? "collapse" : "expand"}
              >
                {expanded ? (
                  <ChevronDown className="size-3.5" />
                ) : (
                  <ChevronRight className="size-3.5" />
                )}
              </button>
            ) : (
              <span className="inline-block w-3.5" />
            )}
            <span className="truncate text-sm font-medium text-foreground" title={node.path}>
              {node.label}
            </span>
            {constraint.mustSupport ? (
              <Star className="size-3 fill-amber-400 text-amber-500" aria-label="must-support" />
            ) : null}
            {base.baseBinding || constraint.binding ? (
              <Link2 className="size-3 text-emerald-600" aria-label="binding" />
            ) : null}
          </div>
          {node.short ? (
            <p className="ml-5 truncate text-xs text-muted-foreground" title={node.short}>
              {node.short}
            </p>
          ) : null}
        </div>

        <div className="flex items-center gap-1 text-xs">
          {cardChanged ? (
            <span className="text-muted-foreground line-through">
              {formatCardinality(base.baseMin, base.baseMax)}
            </span>
          ) : null}
          <span
            className={cn(
              "rounded px-1.5 py-0.5 font-mono",
              cardChanged ? "bg-primary/15 font-semibold text-foreground" : "text-muted-foreground"
            )}
          >
            {formatCardinality(effMin, effMax)}
          </span>
        </div>
      </div>

      {/* Inline controls when editing (authored) */}
      {!readOnly ? (
        <div
          className="flex flex-wrap items-center gap-3 border-b border-foreground/5 bg-muted/20 px-3 py-1.5 text-xs"
          style={{ paddingLeft: `${32 + depth * 16}px` }}
        >
          <label className="flex items-center gap-1">
            <span className="text-muted-foreground">{text.cardMin}</span>
            <Input
              type="number"
              min={0}
              value={constraint.min ?? ""}
              placeholder={String(base.baseMin)}
              onChange={(e) =>
                onPatch(node.path, {
                  min: e.target.value === "" ? null : Number(e.target.value),
                })
              }
              className="h-7 w-16"
            />
          </label>
          <label className="flex items-center gap-1">
            <span className="text-muted-foreground">{text.cardMax}</span>
            <Input
              value={constraint.max ?? ""}
              placeholder={base.baseMax}
              onChange={(e) =>
                onPatch(node.path, { max: e.target.value === "" ? null : e.target.value })
              }
              className="h-7 w-16"
            />
          </label>
          <label className="flex items-center gap-1">
            <input
              type="checkbox"
              checked={Boolean(constraint.mustSupport)}
              onChange={(e) => onPatch(node.path, { mustSupport: e.target.checked })}
            />
            <span>{text.mustSupport}</span>
          </label>
          {base.bindable ? (
            <>
              <select
                value={constraint.binding?.valueSet ?? ""}
                onChange={(e) =>
                  onPatch(node.path, {
                    binding: e.target.value
                      ? {
                          valueSet: e.target.value,
                          strength: constraint.binding?.strength ?? "required",
                        }
                      : null,
                  })
                }
                className="h-7 rounded-md border border-foreground/20 bg-background px-2"
              >
                <option value="">{text.bindingNone}</option>
                {valueSetOptions.map((vs) => (
                  <option key={vs.url} value={vs.url}>
                    {vs.label}
                  </option>
                ))}
              </select>
              {constraint.binding?.valueSet ? (
                <select
                  value={constraint.binding?.strength ?? "required"}
                  onChange={(e) =>
                    onPatch(node.path, {
                      binding: {
                        valueSet: constraint.binding?.valueSet,
                        strength: e.target.value as BindingStrength,
                      },
                    })
                  }
                  className="h-7 rounded-md border border-foreground/20 bg-background px-2"
                >
                  {STRENGTHS.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              ) : null}
            </>
          ) : null}
        </div>
      ) : null}

      {expanded
        ? children.map((child) => (
            <ElementRow
              key={child.elementId || child.path}
              node={child}
              depth={depth + 1}
              content={content}
              readOnly={readOnly}
              schemaCtx={schemaCtx}
              ownerTree={ownerTree}
              valueSetOptions={valueSetOptions}
              text={text}
              onPatch={onPatch}
            />
          ))
        : null}
    </>
  );
};

export const ProfileConstraintsPanel = ({
  text,
  resource,
  readOnly,
  schemaCtx,
  resolveStructureDefinition,
  valueSetOptions,
  usedBy,
  onContentChange,
  onSelectResource,
}: Props) => {
  const content = resource.content as Record<string, unknown>;
  const baseDefinition = typeof content.baseDefinition === "string" ? content.baseDefinition : undefined;
  const baseType = typeof content.type === "string" ? content.type : undefined;

  const baseTree = useMemo(() => {
    if (!baseDefinition || !schemaCtx) return null;
    const baseSD = resolveStructureDefinition(baseDefinition);
    return baseSD ? buildSchemaTree(baseSD, schemaCtx) : null;
  }, [baseDefinition, schemaCtx, resolveStructureDefinition]);

  const topElements = useMemo(() => {
    if (!baseTree || !schemaCtx) return [];
    return getNodeChildren(baseTree.root, undefined, schemaCtx, baseTree).children;
  }, [baseTree, schemaCtx]);

  const constraintCount = countConstraints(content);

  const onPatch = (path: string, patch: ConstraintPatch) => {
    if (readOnly) return;
    onContentChange(writeConstraint(content, path, patch));
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center justify-between gap-2 border-b border-foreground/10 px-4 py-3">
        <div className="min-w-0">
          <div className="text-sm font-semibold text-foreground">
            {text.constraintsOn} {baseType ?? "?"}
          </div>
          <div className="truncate text-xs text-muted-foreground" title={baseDefinition}>
            {baseDefinition ?? text.noBaseDefinition}
          </div>
        </div>
        <Badge variant="secondary">{constraintCount} {text.constraintsBadge}</Badge>
      </div>

      <ScrollArea className="min-h-0 flex-1">
        {!baseTree ? (
          <p className="p-4 text-sm text-muted-foreground">{text.baseNotResolved}</p>
        ) : (
          <div>
            {topElements.map((node) => (
              <ElementRow
                key={node.elementId || node.path}
                node={node}
                depth={0}
                content={content}
                readOnly={readOnly}
                schemaCtx={schemaCtx as SchemaContext}
                ownerTree={baseTree}
                valueSetOptions={valueSetOptions}
                text={text}
                onPatch={onPatch}
              />
            ))}
          </div>
        )}

        {usedBy.length > 0 ? (
          <div className="border-t border-foreground/10 p-4">
            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {text.usedBy}
            </div>
            <div className="flex flex-wrap gap-2">
              {usedBy.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => onSelectResource(r.id)}
                  className="rounded-md border border-foreground/15 px-2 py-1 text-xs hover:bg-muted/60"
                >
                  {r.title || (r.content.name as string) || r.resourceType}
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </ScrollArea>
    </div>
  );
};
