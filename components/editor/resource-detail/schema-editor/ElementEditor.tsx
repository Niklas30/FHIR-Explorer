"use client";

import { useMemo, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  ChevronRight,
  Copy,
  Plus,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import type { SchemaNode } from "@/lib/fhir-editor/schema";
import {
  asItems,
  createDefaultFieldValue,
  createDefaultValue,
  detectChoiceType,
  getChoiceKey,
  getChoiceKeys,
  getNodeChildren,
  getNodeKey,
  getReferenceTargetTypes,
  isNodePresent,
  isRecord,
  isUppercaseTypeCode,
  parseMaxCount,
  resolveRenderKind,
  setChildValue,
} from "@/lib/fhir-editor/schema";
import {
  getSliceDiscriminatorPattern,
  matchesSlice,
} from "@/lib/fhir-editor/schema/slicing";
import { getReferenceCreationTargets } from "@/lib/fhir-editor/reference-targets";
import { isBrokenLocalReference } from "@/lib/fhir-editor/references";
import { PopupSearchSelect } from "@/components/editor/resource-detail/PopupSearchSelect";
import { useResourceDetailText } from "@/components/editor/resource-detail/text";
import {
  extractReferenceString,
  formatTemplate,
  getFieldValidationIssues,
} from "@/components/editor/resource-detail/utils";
import { UnknownValueEditor } from "@/components/editor/resource-detail/UnknownValueEditor";
import { CodingFieldInput } from "@/components/editor/resource-detail/field-input/CodingFieldInput";
import { ContactPointFieldInput } from "@/components/editor/resource-detail/field-input/ContactPointFieldInput";
import { IdentifierFieldInput } from "@/components/editor/resource-detail/field-input/IdentifierFieldInput";
import { QuantityFieldInput } from "@/components/editor/resource-detail/field-input/QuantityFieldInput";
import { ReferenceFieldInput } from "@/components/editor/resource-detail/field-input/ReferenceFieldInput";
import {
  MAX_EDITOR_DEPTH,
  useSchemaEditor,
} from "@/components/editor/resource-detail/schema-editor/context";
import {
  getCodingOptionsForNode,
  getContactPointSystemOptions,
  getIdentifierSystemsForNode,
  getIdentifierTypeOptionsForNode,
} from "@/components/editor/resource-detail/schema-editor/helpers";
import { PrimitiveValueInput } from "@/components/editor/resource-detail/schema-editor/PrimitiveValueInput";
import { ExtensionEditor } from "@/components/editor/resource-detail/schema-editor/ExtensionEditor";
import { NarrativeEditor } from "@/components/editor/resource-detail/schema-editor/NarrativeEditor";
import { PrimitiveExtensionsSection } from "@/components/editor/resource-detail/schema-editor/PrimitiveExtensionsSection";
import {
  ChoiceTypeSelector,
  NodeBadges,
  NodeInfoTooltip,
  joinPath,
} from "@/components/editor/resource-detail/schema-editor/shared";

/* ------------------------------------------------------------------ */
/* Reference                                                           */
/* ------------------------------------------------------------------ */

const ReferenceValueEditor = ({
  node,
  value,
  onChange,
}: {
  node: SchemaNode;
  value: unknown;
  onChange: (value: unknown) => void;
}) => {
  const {
    ctx,
    datasetResources,
    referenceIndex,
    onSelectResource,
    onCreateReferenceTarget,
  } = useSchemaEditor();
  const { text } = useResourceDetailText();
  const [includeDisplay, setIncludeDisplay] = useState(false);

  const targets = useMemo(() => getReferenceTargetTypes(node, ctx), [node, ctx]);
  const allowAny = targets.has("*") || targets.size === 0;
  const referenceOptions = useMemo(
    () =>
      datasetResources.filter((resource) =>
        allowAny ? true : targets.has(resource.resourceType)
      ),
    [datasetResources, targets, allowAny]
  );

  const creationTargets = useMemo(
    () => (onCreateReferenceTarget ? getReferenceCreationTargets(node, ctx) : []),
    [node, ctx, onCreateReferenceTarget]
  );

  const handleCreateTarget = (targetKey: string) => {
    const target = creationTargets.find(
      (entry) => (entry.profileUrl ?? entry.resourceType) === targetKey
    );
    if (!target || !onCreateReferenceTarget) return;
    const reference = onCreateReferenceTarget(target);
    if (reference) {
      onChange({ reference });
    }
  };

  const reference = extractReferenceString(value);
  const broken =
    reference && isBrokenLocalReference(reference, referenceIndex) ? reference : null;

  return (
    <div className="grid gap-2">
      <ReferenceFieldInput
        value={value}
        referenceOptions={referenceOptions}
        allDatasetResources={datasetResources}
        onOpenResource={onSelectResource}
        includeReferenceDisplay={includeDisplay}
        setIncludeReferenceDisplay={setIncludeDisplay}
        onChange={onChange}
        brokenReference={broken}
      />
      {creationTargets.length > 0 ? (
        <div className="w-fit min-w-56">
          <PopupSearchSelect
            value=""
            options={creationTargets.map((target) => ({
              value: target.profileUrl ?? target.resourceType,
              label: `${target.label} (${target.resourceType})`,
              searchText: `${target.label} ${target.resourceType} ${target.profileUrl ?? ""}`,
            }))}
            placeholder={`+ ${text.createReferenceTarget}`}
            searchPlaceholder={text.searchTargetTypes}
            onValueChange={handleCreateTarget}
          />
        </div>
      ) : null}
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* Generic complex editor                                              */
/* ------------------------------------------------------------------ */

const GenericComplexEditor = ({
  node,
  typeCode,
  value,
  onChange,
  path,
  depth,
}: {
  node: SchemaNode;
  typeCode?: string;
  value: unknown;
  onChange: (value: unknown) => void;
  path: string;
  depth: number;
}) => {
  const { ctx, tree } = useSchemaEditor();
  const { text } = useResourceDetailText();
  const record = isRecord(value) ? value : {};

  const children = useMemo(
    () => getNodeChildren(node, typeCode, ctx, tree).children,
    [node, typeCode, ctx, tree]
  );

  if (children.length === 0) {
    return (
      <div className="grid gap-2">
        <div className="text-xs text-muted-foreground">{text.noEditableChildren}</div>
        <UnknownValueEditor value={value} onChange={onChange} />
      </div>
    );
  }

  const visible = children.filter(
    (child) => isNodePresent(child, record) || child.min > 0
  );
  const visibleIds = new Set(visible.map((child) => child.elementId));
  const addable = children.filter(
    (child) => !visibleIds.has(child.elementId) && child.max !== "0"
  );

  const removeChild = (child: SchemaNode) => {
    let next = record;
    const keys = child.isChoice ? getChoiceKeys(child) : [child.key];
    for (const key of keys) {
      next = setChildValue(next, key, undefined);
    }
    onChange(next);
  };

  return (
    <div className="grid gap-3">
      {visible.map((child) => (
        <ElementEditor
          key={child.elementId}
          node={child}
          parentValue={record}
          onParentChange={onChange}
          path={path}
          depth={depth + 1}
          onRemoveElement={child.min === 0 ? () => removeChild(child) : undefined}
        />
      ))}
      {addable.length > 0 ? (
        <div className="w-fit min-w-48">
          <PopupSearchSelect
            value=""
            options={addable.map((child) => ({
              value: child.elementId,
              label: child.label,
              searchText: `${child.label} ${child.path}`,
            }))}
            placeholder={`+ ${text.addSubField}`}
            searchPlaceholder={text.searchFields}
            onValueChange={(elementId) => {
              const child = addable.find((entry) => entry.elementId === elementId);
              if (!child) return;
              onChange(
                setChildValue(record, getNodeKey(child), createDefaultFieldValue(child))
              );
            }}
          />
        </div>
      ) : null}
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* Single value dispatch                                               */
/* ------------------------------------------------------------------ */

type ValueEditorProps = {
  node: SchemaNode;
  typeCode?: string;
  value: unknown;
  onChange: (value: unknown) => void;
  path: string;
  depth: number;
};

/**
 * Wraps a dedicated datatype editor with a toggle to the generic recursive
 * editor for full access to all sub-elements (multiple codings, period, …).
 */
const DedicatedEditorWithDetails = ({
  typeCode,
  dedicated,
  ...props
}: ValueEditorProps & { typeCode: string; dedicated: React.ReactNode }) => {
  const [showDetails, setShowDetails] = useState(false);
  const { text } = useResourceDetailText();

  return (
    <div className="grid gap-2">
      {showDetails ? <GenericComplexEditor {...props} typeCode={typeCode} /> : dedicated}
      <button
        type="button"
        onClick={() => setShowDetails((previous) => !previous)}
        className="w-fit text-xs text-muted-foreground underline-offset-2 hover:underline"
      >
        {showDetails ? text.collapse : text.expand}
      </button>
    </div>
  );
};

const ValueEditor = (props: ValueEditorProps) => {
  const { node, typeCode, value, onChange, path, depth } = props;
  const { ctx } = useSchemaEditor();

  const codingOptions = useMemo(
    () => getCodingOptionsForNode(node, ctx),
    [node, ctx]
  );

  const renderKind = resolveRenderKind(typeCode);

  if (depth >= MAX_EDITOR_DEPTH) {
    return <UnknownValueEditor value={value} onChange={onChange} />;
  }

  switch (renderKind.kind) {
    case "primitive":
      return (
        <PrimitiveValueInput
          primitive={renderKind.primitive}
          value={value}
          options={codingOptions}
          onChange={onChange}
        />
      );
    case "Reference":
      return <ReferenceValueEditor node={node} value={value} onChange={onChange} />;
    case "Coding":
    case "CodeableConcept":
      return (
        <DedicatedEditorWithDetails
          {...props}
          typeCode={renderKind.kind}
          dedicated={
            <CodingFieldInput
              kind={renderKind.kind}
              value={value}
              options={codingOptions}
              onChange={onChange}
            />
          }
        />
      );
    case "Identifier":
      return (
        <DedicatedEditorWithDetails
          {...props}
          typeCode="Identifier"
          dedicated={
            <IdentifierFieldInput
              value={value}
              identifierSystems={getIdentifierSystemsForNode(node, ctx)}
              identifierTypeOptions={getIdentifierTypeOptionsForNode(node, ctx)}
              onChange={onChange}
            />
          }
        />
      );
    case "Quantity":
      return (
        <DedicatedEditorWithDetails
          {...props}
          typeCode={typeCode ?? "Quantity"}
          dedicated={
            <QuantityFieldInput value={value} options={codingOptions} onChange={onChange} />
          }
        />
      );
    case "ContactPoint":
      return (
        <DedicatedEditorWithDetails
          {...props}
          typeCode="ContactPoint"
          dedicated={
            <ContactPointFieldInput
              value={value}
              options={getContactPointSystemOptions(node, ctx)}
              onChange={onChange}
            />
          }
        />
      );
    case "Extension":
      return (
        <ExtensionEditor
          node={node}
          value={value}
          onChange={onChange}
          path={path}
          depth={depth}
        />
      );
    case "Narrative":
      return <NarrativeEditor value={value} onChange={onChange} />;
    case "complex":
      return (
        <GenericComplexEditor
          node={node}
          typeCode={renderKind.typeCode}
          value={value}
          onChange={onChange}
          path={path}
          depth={depth}
        />
      );
    default:
      return <UnknownValueEditor value={value} onChange={onChange} />;
  }
};

/* ------------------------------------------------------------------ */
/* Repeating values                                                    */
/* ------------------------------------------------------------------ */

type ItemActions = {
  update: (index: number, next: unknown) => void;
  remove: (index: number) => void;
  duplicate: (index: number) => void;
  move: (index: number, direction: -1 | 1) => void;
};

const ItemToolbar = ({
  index,
  count,
  actions,
  canRemove,
  canAdd,
}: {
  index: number;
  count: number;
  actions: ItemActions;
  canRemove: boolean;
  canAdd: boolean;
}) => {
  const { text } = useResourceDetailText();
  return (
    <div className="flex items-center gap-1">
      <Button
        size="icon-sm"
        variant="ghost"
        aria-label={text.moveUp}
        title={text.moveUp}
        disabled={index === 0}
        onClick={() => actions.move(index, -1)}
      >
        <ArrowUp className="size-3.5" />
      </Button>
      <Button
        size="icon-sm"
        variant="ghost"
        aria-label={text.moveDown}
        title={text.moveDown}
        disabled={index === count - 1}
        onClick={() => actions.move(index, 1)}
      >
        <ArrowDown className="size-3.5" />
      </Button>
      <Button
        size="icon-sm"
        variant="ghost"
        aria-label={text.duplicate}
        title={text.duplicate}
        disabled={!canAdd}
        onClick={() => actions.duplicate(index)}
      >
        <Copy className="size-3.5" />
      </Button>
      <Button
        size="icon-sm"
        variant="ghost"
        aria-label={text.remove}
        title={text.remove}
        disabled={!canRemove}
        className="text-destructive hover:text-destructive"
        onClick={() => actions.remove(index)}
      >
        <Trash2 className="size-3.5" />
      </Button>
    </div>
  );
};

const RepeatingValueList = ({
  node,
  typeCode,
  items,
  onItemsChange,
  fieldPath,
  depth,
}: {
  node: SchemaNode;
  typeCode?: string;
  items: unknown[];
  onItemsChange: (next: unknown[]) => void;
  fieldPath: string;
  depth: number;
}) => {
  const { ctx } = useSchemaEditor();
  const { text } = useResourceDetailText();

  const maxCount = parseMaxCount(node.max);
  const canAdd = maxCount === null || items.length < maxCount;
  const canRemove = items.length > node.min;

  const actions: ItemActions = {
    update: (index, next) => {
      const nextItems = [...items];
      nextItems[index] = next;
      onItemsChange(nextItems);
    },
    remove: (index) => onItemsChange(items.filter((_, i) => i !== index)),
    duplicate: (index) => {
      const nextItems = [...items];
      nextItems.splice(index + 1, 0, JSON.parse(JSON.stringify(items[index] ?? null)));
      onItemsChange(nextItems);
    },
    move: (index, direction) => {
      const target = index + direction;
      if (target < 0 || target >= items.length) return;
      const nextItems = [...items];
      const [entry] = nextItems.splice(index, 1);
      nextItems.splice(target, 0, entry);
      onItemsChange(nextItems);
    },
  };

  const sliceSections = node.slices.filter((slice) => slice.sliceName);
  const partitioned = useMemo(() => {
    if (sliceSections.length === 0) return null;
    const bySlice = new Map<string, Array<{ item: unknown; index: number }>>();
    for (const slice of sliceSections) {
      bySlice.set(slice.sliceName as string, []);
    }
    const rest: Array<{ item: unknown; index: number }> = [];
    items.forEach((item, index) => {
      const owner = sliceSections.find((slice) => matchesSlice(slice, item, ctx));
      if (owner?.sliceName) {
        bySlice.get(owner.sliceName)?.push({ item, index });
      } else {
        rest.push({ item, index });
      }
    });
    return { bySlice, rest };
  }, [items, sliceSections, ctx]);

  const addItem = (sliceNode?: SchemaNode) => {
    if (!canAdd) return;
    const base = createDefaultValue(sliceNode ?? node, typeCode);
    const pattern = sliceNode ? getSliceDiscriminatorPattern(sliceNode, ctx) : null;
    const item = pattern && isRecord(base) ? { ...base, ...pattern } : pattern ?? base;
    onItemsChange([...items, item]);
  };

  const renderItems = (
    entries: Array<{ item: unknown; index: number }>,
    itemNode: SchemaNode
  ) =>
    entries.map(({ item, index }) => (
      <div
        key={index}
        className="rounded-md border border-foreground/10 bg-muted/20 px-3 py-2.5"
      >
        <div className="flex items-center justify-between gap-2">
          <div className="text-[11px] font-medium text-muted-foreground">
            {formatTemplate(text.itemLabel, { index: index + 1 })}
          </div>
          <ItemToolbar
            index={index}
            count={items.length}
            actions={actions}
            canRemove={canRemove}
            canAdd={canAdd}
          />
        </div>
        <div className="mt-2">
          <ValueEditor
            node={itemNode}
            typeCode={typeCode ?? itemNode.types[0]?.code}
            value={item}
            onChange={(next) => actions.update(index, next)}
            path={`${fieldPath}[${index}]`}
            depth={depth}
          />
        </div>
      </div>
    ));

  if (!partitioned) {
    return (
      <div className="grid gap-2">
        {items.length === 0 ? (
          <div className="rounded-md border border-dashed border-foreground/15 px-3 py-2.5 text-xs text-muted-foreground">
            {text.noEntriesYet}
          </div>
        ) : null}
        {renderItems(
          items.map((item, index) => ({ item, index })),
          node
        )}
        <Button
          size="sm"
          variant="outline"
          className="w-fit gap-1.5"
          disabled={!canAdd}
          onClick={() => addItem()}
        >
          <Plus className="size-3.5" />
          {text.addEntry}
        </Button>
      </div>
    );
  }

  return (
    <div className="grid gap-3">
      {sliceSections.map((slice) => {
        const entries = partitioned.bySlice.get(slice.sliceName as string) ?? [];
        const sliceMax = parseMaxCount(slice.max);
        const canAddSlice = canAdd && (sliceMax === null || entries.length < sliceMax);
        return (
          <div
            key={slice.elementId}
            className="grid gap-2 rounded-md border border-foreground/10 px-3 py-2.5"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-foreground">{slice.label}</span>
                <NodeInfoTooltip node={slice} />
              </div>
              <NodeBadges node={slice} errorCount={0} />
            </div>
            {renderItems(entries, slice)}
            {entries.length === 0 && slice.min > 0 ? (
              <div className="rounded-md border border-dashed border-emerald-600/30 px-3 py-2 text-xs text-emerald-700">
                {text.required}
              </div>
            ) : null}
            <Button
              size="sm"
              variant="outline"
              className="w-fit gap-1.5"
              disabled={!canAddSlice}
              onClick={() => addItem(slice)}
            >
              <Plus className="size-3.5" />
              {text.addEntry}
            </Button>
          </div>
        );
      })}
      <div className="grid gap-2 rounded-md border border-foreground/10 px-3 py-2.5">
        <div className="text-xs font-semibold text-muted-foreground">{text.otherEntries}</div>
        {partitioned.rest.length === 0 ? (
          <div className="rounded-md border border-dashed border-foreground/15 px-3 py-2 text-xs text-muted-foreground">
            {text.noEntriesYet}
          </div>
        ) : (
          renderItems(partitioned.rest, node)
        )}
        <Button
          size="sm"
          variant="outline"
          className="w-fit gap-1.5"
          disabled={!canAdd}
          onClick={() => addItem()}
        >
          <Plus className="size-3.5" />
          {text.addEntry}
        </Button>
      </div>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* Element editor (entry point, recursive)                             */
/* ------------------------------------------------------------------ */

export type ElementEditorProps = {
  node: SchemaNode;
  parentValue: Record<string, unknown>;
  onParentChange: (next: Record<string, unknown>) => void;
  /** Issue path of the parent scope ("" at resource root). */
  path: string;
  depth: number;
  onRemoveElement?: () => void;
};

export function ElementEditor({
  node,
  parentValue,
  onParentChange,
  path,
  depth,
  onRemoveElement,
}: ElementEditorProps) {
  const { validationIssues } = useSchemaEditor();
  const { text } = useResourceDetailText();
  const isComplexValue =
    node.isChoice ||
    node.types.some(
      (type) => type.code && type.code[0] === type.code[0].toUpperCase()
    ) ||
    node.children.length > 0;
  const [collapsed, setCollapsed] = useState(depth >= 3 && isComplexValue);

  const detected = detectChoiceType(node, parentValue);
  const selectedTypeCode = node.isChoice ? detected?.type.code : node.types[0]?.code;
  const key = node.isChoice
    ? detected?.key ?? getChoiceKey(node, selectedTypeCode ?? node.types[0]?.code ?? "")
    : node.key;
  const value = parentValue[key];
  const fieldPath = joinPath(path, key);

  const issues = getFieldValidationIssues(validationIssues, fieldPath);
  const errorCount = issues.filter((issue) => issue.severity === "error").length;

  const handleValueChange = (next: unknown) => {
    onParentChange(setChildValue(parentValue, key, next));
  };

  const handleSelectChoiceType = (typeCode: string) => {
    const nextKey = getChoiceKey(node, typeCode);
    if (nextKey === key && value !== undefined) return;
    let next = parentValue;
    for (const choiceKey of getChoiceKeys(node)) {
      next = setChildValue(next, choiceKey, undefined);
    }
    next = setChildValue(next, nextKey, createDefaultValue(node, typeCode));
    onParentChange(next);
  };

  return (
    <div className="rounded-lg border border-foreground/10 bg-background px-3.5 py-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          {isComplexValue ? (
            <button
              type="button"
              onClick={() => setCollapsed((previous) => !previous)}
              className="text-muted-foreground hover:text-foreground"
              aria-label={collapsed ? text.expand : text.collapse}
            >
              {collapsed ? (
                <ChevronRight className="size-4" />
              ) : (
                <ChevronDown className="size-4" />
              )}
            </button>
          ) : null}
          <Label className="truncate text-sm font-semibold text-foreground">
            {node.label}
          </Label>
          <NodeInfoTooltip node={node} />
        </div>
        <div className="flex items-center gap-2">
          <NodeBadges node={node} errorCount={errorCount} />
          {onRemoveElement ? (
            <button
              type="button"
              onClick={onRemoveElement}
              className="text-xs text-destructive hover:text-destructive/80"
            >
              {text.remove}
            </button>
          ) : null}
        </div>
      </div>

      {collapsed ? null : (
        <div className="mt-2.5 grid gap-2.5">
          {issues.length > 0 ? (
            <div className="grid gap-1 rounded-md border border-destructive/30 bg-destructive/5 px-2 py-1.5 text-xs text-destructive">
              {issues.slice(0, 5).map((issue, index) => (
                <div key={`${issue.code}-${issue.path}-${index}`}>{issue.message}</div>
              ))}
            </div>
          ) : null}

          {node.isChoice ? (
            <ChoiceTypeSelector
              node={node}
              selectedType={selectedTypeCode}
              onSelectType={handleSelectChoiceType}
            />
          ) : null}

          {node.isChoice && !detected ? (
            <div className="rounded-md border border-dashed border-foreground/15 px-3 py-2 text-xs text-muted-foreground">
              {text.selectType}
            </div>
          ) : node.isArray ? (
            <RepeatingValueList
              node={node}
              typeCode={selectedTypeCode}
              items={asItems(value)}
              onItemsChange={(nextItems) =>
                handleValueChange(nextItems.length > 0 ? nextItems : undefined)
              }
              fieldPath={fieldPath}
              depth={depth}
            />
          ) : (
            <>
              <ValueEditor
                node={node}
                typeCode={selectedTypeCode}
                value={value}
                onChange={handleValueChange}
                path={fieldPath}
                depth={depth}
              />
              {selectedTypeCode &&
              !isUppercaseTypeCode(selectedTypeCode) &&
              depth < MAX_EDITOR_DEPTH - 1 ? (
                <PrimitiveExtensionsSection
                  node={node}
                  valueKey={key}
                  parentValue={parentValue}
                  onParentChange={onParentChange}
                  path={path}
                  depth={depth}
                />
              ) : null}
            </>
          )}
        </div>
      )}
    </div>
  );
}
