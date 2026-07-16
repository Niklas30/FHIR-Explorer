import type { CodingOption } from "@/lib/fhir-editor/registry";
import { resolveValueSetOptions } from "@/lib/fhir-editor/registry";
import type { SchemaContext, SchemaNode } from "@/lib/fhir-editor/schema";
import { getNodeChildren, isRecord } from "@/lib/fhir-editor/schema";
import { getSliceDiscriminatorPattern } from "@/lib/fhir-editor/schema/slicing";

const uniqueOptions = (options: CodingOption[]) => {
  const unique = new Map<string, CodingOption>();
  for (const option of options) {
    const key = `${option.system ?? ""}|${option.code}`;
    if (!unique.has(key)) unique.set(key, option);
  }
  return Array.from(unique.values());
};

const collectCodingsFromValue = (value: unknown): CodingOption[] => {
  const options: CodingOption[] = [];
  if (!isRecord(value)) return options;
  if (typeof value.code === "string") {
    options.push({
      system: typeof value.system === "string" ? value.system : undefined,
      code: value.code,
      display: typeof value.display === "string" ? value.display : undefined,
    });
  }
  if (Array.isArray(value.coding)) {
    for (const coding of value.coding) {
      options.push(...collectCodingsFromValue(coding));
    }
  }
  return options;
};

/**
 * Coding options offered for a node: bound ValueSet options plus fixed /
 * pattern codings contributed by the profile (element itself and slices).
 */
export const getCodingOptionsForNode = (
  node: SchemaNode,
  ctx: SchemaContext
): CodingOption[] => {
  const options: CodingOption[] = [];
  options.push(...resolveValueSetOptions(node.binding?.valueSet, ctx.registry));
  options.push(...collectCodingsFromValue(node.fixedValue ?? node.patternValue));
  for (const slice of node.slices) {
    options.push(...collectCodingsFromValue(slice.fixedValue ?? slice.patternValue));
    if (slice.binding?.valueSet) {
      options.push(...resolveValueSetOptions(slice.binding.valueSet, ctx.registry));
    }
  }
  return uniqueOptions(options);
};

export type IdentifierSystemOption = { system: string; label: string };

/**
 * Allowed identifier systems derived from slice discriminators
 * (e.g. "identifier:TelematikID" fixing Identifier.system).
 */
export const getIdentifierSystemsForNode = (
  node: SchemaNode,
  ctx: SchemaContext
): IdentifierSystemOption[] => {
  const options: IdentifierSystemOption[] = [];
  const seen = new Set<string>();
  for (const slice of node.slices) {
    const pattern = getSliceDiscriminatorPattern(slice, ctx);
    const system = isRecord(pattern) && typeof pattern.system === "string" ? pattern.system : undefined;
    if (!system || seen.has(system)) continue;
    seen.add(system);
    options.push({ system, label: slice.sliceName ?? system });
  }
  return options;
};

/** Identifier.type options from slice patterns and the type binding. */
export const getIdentifierTypeOptionsForNode = (
  node: SchemaNode,
  ctx: SchemaContext
): CodingOption[] => {
  const options: CodingOption[] = [];
  for (const slice of node.slices) {
    const pattern = getSliceDiscriminatorPattern(slice, ctx);
    if (isRecord(pattern)) {
      options.push(...collectCodingsFromValue(pattern.type));
    }
    const typeChild = slice.children.find((child) => child.key === "type");
    if (typeChild) {
      options.push(...collectCodingsFromValue(typeChild.fixedValue ?? typeChild.patternValue));
      if (typeChild.binding?.valueSet) {
        options.push(...resolveValueSetOptions(typeChild.binding.valueSet, ctx.registry));
      }
    }
  }
  const typeChild = node.children.find((child) => child.key === "type");
  if (typeChild?.binding?.valueSet) {
    options.push(...resolveValueSetOptions(typeChild.binding.valueSet, ctx.registry));
  }
  return uniqueOptions(options);
};

/**
 * System codes allowed for a ContactPoint element, resolved from the
 * binding on its `system` child (profile constraints included).
 */
export const getContactPointSystemOptions = (
  node: SchemaNode,
  ctx: SchemaContext
): CodingOption[] => {
  const { children } = getNodeChildren(node, "ContactPoint", ctx);
  const system = children.find((child) => child.key === "system");
  if (!system?.binding?.valueSet) return [];
  return resolveValueSetOptions(system.binding.valueSet, ctx.registry);
};

/** Human readable cardinality, e.g. "1..*" or "0..1". */
export const formatCardinality = (node: SchemaNode) => `${node.min}..${node.max}`;
