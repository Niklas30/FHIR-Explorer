import {
  getStructureDefinitionByCanonical,
  normalizeCanonical,
  type FhirRegistry,
  type StructureDefinition,
} from "@fhir-explorer/core/fhir-editor/registry";
import type { ResourcePayload } from "@fhir-explorer/core/fhir-importer/types";

/**
 * The conformance resources a profile actually needs.
 *
 * The schema engine resolves data types, extensions and bindings lazily, which
 * means it needs the whole registry in reach. A registry built from the core
 * IG is tens of megabytes — fine in a browser tab that owns it, not something
 * to hand to another process per open editor.
 *
 * The closure of a single profile is one to three orders of magnitude smaller,
 * so the extension computes it once in the host and ships only that.
 */

const CORE_TYPE_PREFIX = "http://hl7.org/fhir/StructureDefinition/";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value && typeof value === "object" && !Array.isArray(value));

const asStringArray = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === "string") : [];

/** Every canonical a structure definition can pull in through its elements. */
const referencedCanonicals = (definition: StructureDefinition): string[] => {
  const found: string[] = [];

  if (typeof definition.baseDefinition === "string") {
    found.push(definition.baseDefinition);
  }

  const elements = [
    ...(Array.isArray(definition.snapshot?.element) ? definition.snapshot.element : []),
    ...(Array.isArray(definition.differential?.element)
      ? definition.differential.element
      : []),
  ];

  for (const element of elements) {
    if (!isRecord(element)) continue;

    for (const type of Array.isArray(element.type) ? element.type : []) {
      if (!isRecord(type)) continue;
      if (typeof type.code === "string") {
        // Primitive and complex types are structure definitions of their own;
        // lowercase codes like `string` resolve to the same url space.
        found.push(`${CORE_TYPE_PREFIX}${type.code}`);
      }
      found.push(...asStringArray(type.profile));
      found.push(...asStringArray(type.targetProfile));
    }

    if (isRecord(element.binding) && typeof element.binding.valueSet === "string") {
      found.push(element.binding.valueSet);
    }
  }

  return found;
};

/** Systems and value sets a value set's compose refers to. */
const referencedByValueSet = (valueSet: unknown): string[] => {
  if (!isRecord(valueSet)) return [];
  const compose = valueSet.compose;
  if (!isRecord(compose)) return [];

  const found: string[] = [];
  for (const key of ["include", "exclude"] as const) {
    for (const entry of Array.isArray(compose[key]) ? (compose[key] as unknown[]) : []) {
      if (!isRecord(entry)) continue;
      if (typeof entry.system === "string") found.push(entry.system);
      found.push(...asStringArray(entry.valueSet));
    }
  }
  return found;
};

const toPayload = (content: Record<string, unknown>, canonical: string): ResourcePayload => ({
  key: canonical,
  packageKey: "closure",
  resourceType: String(content.resourceType),
  id: typeof content.id === "string" ? content.id : undefined,
  url: canonical,
  content,
});

/**
 * Collect everything reachable from `rootCanonical` as payloads that can be
 * fed straight back into `buildRegistry`.
 *
 * Unresolvable canonicals are skipped rather than reported: a profile
 * referencing a package the user has not imported still has to render, and the
 * validator is the place that complains about it.
 */
export const collectProfileClosure = (
  rootCanonical: string,
  registry: FhirRegistry
): ResourcePayload[] => {
  const queue = [normalizeCanonical(rootCanonical)];
  const seen = new Set<string>();
  const payloads: ResourcePayload[] = [];

  while (queue.length > 0) {
    const canonical = normalizeCanonical(queue.pop() as string);
    if (!canonical || seen.has(canonical)) continue;
    seen.add(canonical);

    const definition = getStructureDefinitionByCanonical(registry, canonical);
    if (definition) {
      payloads.push(toPayload(definition as Record<string, unknown>, canonical));
      queue.push(...referencedCanonicals(definition));
      continue;
    }

    const valueSet = registry.valueSetsByUrl.get(canonical);
    if (valueSet) {
      payloads.push(toPayload(valueSet as Record<string, unknown>, canonical));
      queue.push(...referencedByValueSet(valueSet));
      continue;
    }

    const codeSystem = registry.codeSystemsByUrl.get(canonical);
    if (codeSystem) {
      payloads.push(toPayload(codeSystem as Record<string, unknown>, canonical));
    }
  }

  return payloads;
};
