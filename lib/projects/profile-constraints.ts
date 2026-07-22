import type { SchemaNode } from "@/lib/fhir-editor/schema";

export type BindingStrength = "required" | "extensible" | "preferred" | "example";

export type ElementBinding = {
  strength?: BindingStrength;
  valueSet?: string;
};

/** The constraints this editor manages for a single element (differential). */
export type ElementConstraint = {
  min?: number;
  max?: string;
  mustSupport?: boolean;
  binding?: ElementBinding;
  short?: string;
};

/** A partial update; `null` clears a field, `undefined` leaves it unchanged. */
export type ConstraintPatch = {
  min?: number | null;
  max?: string | null;
  mustSupport?: boolean | null;
  binding?: ElementBinding | null;
  short?: string | null;
};

/** A base-type element rendered in the constraint editor. */
export type BaseElement = {
  path: string;
  label: string;
  baseMin: number;
  baseMax: string;
  typeCodes: string[];
  baseBinding?: string;
  short?: string;
  bindable: boolean;
};

const BINDABLE_TYPES = new Set(["code", "Coding", "CodeableConcept", "Quantity", "string"]);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value && typeof value === "object" && !Array.isArray(value));

/** Map a SchemaNode from the base type's schema tree to a BaseElement. */
export const toBaseElement = (node: SchemaNode): BaseElement => {
  const typeCodes = node.types.map((t) => t.code).filter(Boolean) as string[];
  return {
    path: node.path,
    label: node.label,
    baseMin: node.min,
    baseMax: node.max,
    typeCodes,
    baseBinding: node.binding?.valueSet as string | undefined,
    short: node.short,
    bindable: typeCodes.some((code) => BINDABLE_TYPES.has(code)),
  };
};

export const formatCardinality = (min: number | undefined, max: string | undefined): string =>
  `${min ?? 0}..${max ?? "*"}`;

const differentialElements = (content: Record<string, unknown>): Record<string, unknown>[] => {
  const differential = content.differential;
  if (isRecord(differential) && Array.isArray(differential.element)) {
    return differential.element.filter(isRecord) as Record<string, unknown>[];
  }
  return [];
};

const matchesPath = (element: Record<string, unknown>, path: string): boolean =>
  element.id === path || (element.id === undefined && element.path === path);

/** Read the constraints currently declared for an element path. */
export const readConstraint = (
  content: Record<string, unknown>,
  path: string
): ElementConstraint => {
  const element = differentialElements(content).find((el) => matchesPath(el, path));
  if (!element) return {};
  const binding = isRecord(element.binding) ? element.binding : undefined;
  return {
    min: typeof element.min === "number" ? element.min : undefined,
    max: typeof element.max === "string" ? element.max : undefined,
    mustSupport: element.mustSupport === true ? true : undefined,
    binding: binding
      ? {
          strength: binding.strength as BindingStrength | undefined,
          valueSet: typeof binding.valueSet === "string" ? binding.valueSet : undefined,
        }
      : undefined,
    short: typeof element.short === "string" ? element.short : undefined,
  };
};

/** True when the element carries no managed constraints beyond its identity. */
const isEmptyElement = (element: Record<string, unknown>): boolean => {
  const managed = ["min", "max", "mustSupport", "binding", "short"];
  const hasManaged = managed.some((key) => element[key] !== undefined);
  const otherKeys = Object.keys(element).filter(
    (key) => key !== "id" && key !== "path" && !managed.includes(key)
  );
  return !hasManaged && otherKeys.length === 0;
};

/**
 * Immutably upsert an element's constraints into `content.differential`.
 * A `null` field clears it; an element left with no constraints (and no other
 * author-set keys) is removed entirely. Pure — returns a new content object.
 */
export const writeConstraint = (
  content: Record<string, unknown>,
  path: string,
  patch: ConstraintPatch
): Record<string, unknown> => {
  const existing = differentialElements(content);
  const index = existing.findIndex((el) => matchesPath(el, path));
  const target: Record<string, unknown> =
    index >= 0 ? { ...existing[index] } : { id: path, path };

  const apply = (key: keyof ConstraintPatch, value: unknown) => {
    if (value === undefined) return;
    if (value === null) {
      delete target[key];
      return;
    }
    target[key] = value;
  };

  apply("min", patch.min);
  apply("max", patch.max);
  // mustSupport is only meaningful when true.
  if (patch.mustSupport !== undefined) {
    if (patch.mustSupport) target.mustSupport = true;
    else delete target.mustSupport;
  }
  if (patch.binding !== undefined) {
    if (patch.binding === null) {
      delete target.binding;
    } else {
      const binding: Record<string, unknown> = {};
      if (patch.binding.strength) binding.strength = patch.binding.strength;
      if (patch.binding.valueSet) binding.valueSet = patch.binding.valueSet;
      if (Object.keys(binding).length > 0) target.binding = binding;
      else delete target.binding;
    }
  }
  apply("short", patch.short);

  const nextElements = [...existing];
  if (isEmptyElement(target)) {
    if (index >= 0) nextElements.splice(index, 1);
  } else if (index >= 0) {
    nextElements[index] = target;
  } else {
    nextElements.push(target);
  }

  const nextContent = { ...content };
  if (nextElements.length > 0) {
    nextContent.differential = { element: nextElements };
  } else {
    delete nextContent.differential;
  }
  return nextContent;
};

/** Number of elements carrying constraints in the differential. */
export const countConstraints = (content: Record<string, unknown>): number =>
  differentialElements(content).filter((el) => !isEmptyElement(el)).length;

/** Whether a given element path has any managed constraint set. */
export const hasConstraint = (content: Record<string, unknown>, path: string): boolean => {
  const element = differentialElements(content).find((el) => matchesPath(el, path));
  return Boolean(element && !isEmptyElement(element));
};
