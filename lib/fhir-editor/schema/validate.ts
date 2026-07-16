import { normalizeCanonical, resolveValueSetOptions } from "@/lib/fhir-editor/registry";
import { collectBrokenReferences } from "@/lib/fhir-editor/references";
import { byLocale } from "@/lib/i18n/select";
import type { Locale } from "@/lib/i18n/types";
import type { SchemaContext, SchemaNode, SchemaTree } from "@/lib/fhir-editor/schema/types";
import { getNodeChildren } from "@/lib/fhir-editor/schema/tree";
import { resolveRenderKind } from "@/lib/fhir-editor/schema/render-kind";
import {
  asItems,
  detectChoiceType,
  getChoiceKeys,
  isRecord,
  matchesPattern,
  parseMaxCount,
} from "@/lib/fhir-editor/schema/values";
import { matchesSlice, partitionItemsBySlice } from "@/lib/fhir-editor/schema/slicing";

export type ValidationIssue = {
  severity: "error" | "warning";
  code: string;
  path: string;
  message: string;
};

type ValidationOptions = {
  existingReferences?: Set<string>;
  locale?: Locale;
  maxDepth?: number;
};

type ValidationText = {
  required: string;
  cardinalityArray: string;
  cardinalitySingle: string;
  cardinalityMin: string;
  cardinalityMax: string;
  choiceConflict: string;
  sliceMin: string;
  sliceMax: string;
  fixedMismatch: string;
  patternMismatch: string;
  bindingCode: string;
  bindingSystem: string;
  bindingRequired: string;
  bindingPrimitive: string;
  invalidDate: string;
  invalidDateTime: string;
  invalidTime: string;
  invalidNumber: string;
  unknownElement: string;
  referenceBroken: string;
};

const format = (template: string, values: Record<string, string | number>) =>
  template.replace(/\{(\w+)\}/g, (_, key) => String(values[key] ?? ""));

const getText = (locale: Locale): ValidationText =>
  byLocale(locale, {
    de: {
      required: "Pflichtfeld ist nicht befüllt.",
      cardinalityArray: "Dieses Feld muss als Array geführt werden.",
      cardinalitySingle: "Dieses Feld darf nur einmal vorkommen, aktuell {count} Einträge.",
      cardinalityMin: "Mindestens {min} Wert(e) erforderlich, aktuell {count}.",
      cardinalityMax: "Maximal {max} Wert(e) erlaubt, aktuell {count}.",
      choiceConflict: "Nur eine Variante von {name}[x] darf gesetzt sein ({keys}).",
      sliceMin: 'Slice "{slice}": mindestens {min} Eintrag/Einträge erforderlich, aktuell {count}.',
      sliceMax: 'Slice "{slice}": maximal {max} Eintrag/Einträge erlaubt, aktuell {count}.',
      fixedMismatch: "Wert entspricht nicht dem im Profil fixierten Wert.",
      patternMismatch: "Wert entspricht nicht dem im Profil vorgegebenen Muster.",
      bindingCode: 'Code "{code}" ist im gebundenen ValueSet nicht erlaubt.',
      bindingSystem:
        'System "{system}" ist für Code "{code}" im gebundenen ValueSet nicht erlaubt.',
      bindingRequired: "Mindestens ein Coding aus dem gebundenen ValueSet ist erforderlich.",
      bindingPrimitive: 'Wert "{value}" ist im gebundenen ValueSet nicht erlaubt.',
      invalidDate: 'Ungültiges Datum "{value}" (erwartet: JJJJ, JJJJ-MM oder JJJJ-MM-TT).',
      invalidDateTime: 'Ungültiger Zeitstempel "{value}".',
      invalidTime: 'Ungültige Uhrzeit "{value}" (erwartet: HH:MM:SS).',
      invalidNumber: 'Wert "{value}" ist keine gültige Zahl.',
      unknownElement: 'Element "{key}" ist im Profil nicht definiert.',
      referenceBroken: 'Referenz "{reference}" zeigt auf fehlende Resource "{targetKey}".',
    },
    en: {
      required: "Required field is missing.",
      cardinalityArray: "This field must be represented as an array.",
      cardinalitySingle: "This field may occur only once, currently {count} entries.",
      cardinalityMin: "At least {min} value(s) required, currently {count}.",
      cardinalityMax: "At most {max} value(s) allowed, currently {count}.",
      choiceConflict: "Only one variant of {name}[x] may be set ({keys}).",
      sliceMin: 'Slice "{slice}": at least {min} entry/entries required, currently {count}.',
      sliceMax: 'Slice "{slice}": at most {max} entry/entries allowed, currently {count}.',
      fixedMismatch: "Value does not match the fixed value required by the profile.",
      patternMismatch: "Value does not match the pattern required by the profile.",
      bindingCode: 'Code "{code}" is not allowed in the bound ValueSet.',
      bindingSystem:
        'System "{system}" is not allowed for code "{code}" in the bound ValueSet.',
      bindingRequired: "At least one coding from the bound ValueSet is required.",
      bindingPrimitive: 'Value "{value}" is not allowed in the bound ValueSet.',
      invalidDate: 'Invalid date "{value}" (expected YYYY, YYYY-MM or YYYY-MM-DD).',
      invalidDateTime: 'Invalid timestamp "{value}".',
      invalidTime: 'Invalid time "{value}" (expected HH:MM:SS).',
      invalidNumber: 'Value "{value}" is not a valid number.',
      unknownElement: 'Element "{key}" is not defined by the profile.',
      referenceBroken: 'Reference "{reference}" points to missing resource "{targetKey}".',
    },
  });

const DATE_PATTERN = /^\d{4}(-\d{2}(-\d{2})?)?$/;
const DATETIME_PATTERN =
  /^\d{4}(-\d{2}(-\d{2}(T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})?)?)?)?$/;
const TIME_PATTERN = /^\d{2}:\d{2}(:\d{2}(\.\d+)?)?$/;

const DEFAULT_MAX_DEPTH = 8;

/** Keys that are always legal on FHIR JSON objects. */
const ALWAYS_ALLOWED_KEYS = new Set(["resourceType", "fhir_comments"]);

type Walker = {
  ctx: SchemaContext;
  tree: SchemaTree;
  issues: ValidationIssue[];
  text: ValidationText;
  maxDepth: number;
};

const push = (
  walker: Walker,
  issue: Omit<ValidationIssue, "severity"> & { severity?: ValidationIssue["severity"] }
) => {
  walker.issues.push({ severity: issue.severity ?? "error", ...issue });
};

const normalizeSystem = (system?: string) =>
  system ? normalizeCanonical(system) : undefined;

const validateCodingValue = (
  walker: Walker,
  node: SchemaNode,
  value: Record<string, unknown>,
  path: string,
  options: Array<{ system?: string; code: string }>
) => {
  const code = typeof value.code === "string" ? value.code : undefined;
  const system = typeof value.system === "string" ? value.system : undefined;
  if (!code || options.length === 0) return;

  const byCode = options.filter((option) => option.code === code);
  if (byCode.length === 0) {
    push(walker, {
      code: "binding-code",
      path,
      severity: node.binding?.strength === "required" ? "error" : "warning",
      message: format(walker.text.bindingCode, { code }),
    });
    return;
  }
  if (system && !byCode.some((option) => option.system && normalizeSystem(option.system) === normalizeSystem(system))) {
    push(walker, {
      code: "binding-system",
      path,
      severity: node.binding?.strength === "required" ? "error" : "warning",
      message: format(walker.text.bindingSystem, { system, code }),
    });
  }
};

const resolveBindingOptions = (walker: Walker, node: SchemaNode) => {
  if (!node.binding?.valueSet) return [];
  return resolveValueSetOptions(node.binding.valueSet, walker.ctx.registry);
};

const validatePrimitive = (
  walker: Walker,
  node: SchemaNode,
  typeCode: string,
  value: unknown,
  path: string
) => {
  if (typeof value === "string") {
    if (typeCode === "date" && !DATE_PATTERN.test(value)) {
      push(walker, { code: "invalid-date", path, message: format(walker.text.invalidDate, { value }) });
    } else if ((typeCode === "dateTime" || typeCode === "instant") && !DATETIME_PATTERN.test(value)) {
      push(walker, { code: "invalid-datetime", path, message: format(walker.text.invalidDateTime, { value }) });
    } else if (typeCode === "time" && !TIME_PATTERN.test(value)) {
      push(walker, { code: "invalid-time", path, message: format(walker.text.invalidTime, { value }) });
    }
  }

  if (
    (typeCode === "integer" || typeCode === "decimal" || typeCode === "positiveInt" || typeCode === "unsignedInt") &&
    value !== undefined &&
    value !== null &&
    typeof value !== "number"
  ) {
    push(walker, {
      code: "invalid-number",
      path,
      message: format(walker.text.invalidNumber, { value: String(value) }),
    });
  }

  if (typeof value === "string" && (typeCode === "code" || typeCode === "string" || typeCode === "uri")) {
    const options = resolveBindingOptions(walker, node);
    if (options.length > 0 && !options.some((option) => option.code === value)) {
      push(walker, {
        code: "binding-primitive",
        path,
        severity: node.binding?.strength === "required" ? "error" : "warning",
        message: format(walker.text.bindingPrimitive, { value }),
      });
    }
  }
};

const validateComplexValue = (
  walker: Walker,
  node: SchemaNode,
  typeCode: string,
  value: unknown,
  path: string,
  depth: number
) => {
  if (!isRecord(value)) return;

  if (typeCode === "Coding") {
    validateCodingValue(walker, node, value, path, resolveBindingOptions(walker, node));
  }

  if (typeCode === "CodeableConcept") {
    const options = resolveBindingOptions(walker, node);
    const codings = Array.isArray(value.coding) ? value.coding.filter(isRecord) : [];
    if (
      node.binding?.strength === "required" &&
      options.length > 0 &&
      codings.length === 0 &&
      typeof value.text !== "string"
    ) {
      push(walker, { code: "binding-required", path, message: walker.text.bindingRequired });
    }
    codings.forEach((coding, index) =>
      validateCodingValue(walker, node, coding, `${path}.coding[${index}]`, options)
    );
  }

  if (depth >= walker.maxDepth) return;
  const { children } = getNodeChildren(node, typeCode, walker.ctx, walker.tree);
  if (children.length === 0) return;
  validateChildren(walker, children, value, path, depth + 1);
};

const validateSingleValue = (
  walker: Walker,
  node: SchemaNode,
  typeCode: string | undefined,
  value: unknown,
  path: string,
  depth: number
) => {
  if (node.fixedValue !== undefined && value !== undefined) {
    if (JSON.stringify(value) !== JSON.stringify(node.fixedValue)) {
      push(walker, { code: "fixed-mismatch", path, message: walker.text.fixedMismatch });
    }
  } else if (node.patternValue !== undefined && value !== undefined) {
    if (!matchesPattern(value, node.patternValue)) {
      push(walker, { code: "pattern-mismatch", path, message: walker.text.patternMismatch });
    }
  }

  const renderKind = resolveRenderKind(typeCode);
  if (renderKind.kind === "primitive" && typeCode) {
    validatePrimitive(walker, node, typeCode, value, path);
    return;
  }
  if (renderKind.kind === "json") return;
  if (typeCode) {
    validateComplexValue(walker, node, typeCode, value, path, depth);
  }
};

const collectKnownKeys = (children: SchemaNode[]) => {
  const known = new Set<string>(ALWAYS_ALLOWED_KEYS);
  for (const child of children) {
    if (child.isChoice) {
      for (const key of getChoiceKeys(child)) {
        known.add(key);
        known.add(`_${key}`);
      }
    } else {
      known.add(child.key);
      known.add(`_${child.key}`);
    }
  }
  return known;
};

const validateChildren = (
  walker: Walker,
  children: SchemaNode[],
  value: Record<string, unknown>,
  path: string,
  depth: number
) => {
  const joinPath = (segment: string) => (path ? `${path}.${segment}` : segment);

  for (const node of children) {
    if (node.sliceName) continue; // slice instances are matched via the base element

    const resolved = resolveNodeKey(walker, node, value, joinPath);
    if (!resolved) continue;
    const { key, selectedType } = resolved;

    const raw = value[key];
    const fieldPath = joinPath(key);

    if (raw === undefined || raw === null) {
      // A required slice makes the element itself effectively required.
      const effectivelyRequired =
        node.min > 0 || node.slices.some((slice) => slice.min > 0);
      if (effectivelyRequired) {
        push(walker, { code: "required", path: fieldPath, message: walker.text.required });
      }
      continue;
    }

    if (node.isArray) {
      validateArrayValue(walker, node, selectedType, raw, fieldPath, depth);
    } else {
      if (Array.isArray(raw)) {
        push(walker, {
          code: "cardinality-single",
          path: fieldPath,
          message: format(walker.text.cardinalitySingle, { count: raw.length }),
        });
        continue;
      }
      if (node.min > 0 && typeof raw === "string" && raw.trim().length === 0) {
        push(walker, { code: "required", path: fieldPath, message: walker.text.required });
      }
      validateSingleValue(walker, node, selectedType, raw, fieldPath, depth);
    }
  }

  const known = collectKnownKeys(children);
  for (const key of Object.keys(value)) {
    if (known.has(key)) continue;
    push(walker, {
      code: "unknown-element",
      path: joinPath(key),
      severity: "warning",
      message: format(walker.text.unknownElement, { key }),
    });
  }
};

/**
 * Resolves the serialized key and selected type for a node, handling choice
 * elements. Returns null when the (absent) element needs no further checks.
 */
const resolveNodeKey = (
  walker: Walker,
  node: SchemaNode,
  value: Record<string, unknown>,
  joinPath: (segment: string) => string
): { key: string; selectedType?: string } | null => {
  if (!node.isChoice) {
    return { key: node.key, selectedType: node.types[0]?.code };
  }

  const presentKeys = getChoiceKeys(node).filter(
    (choiceKey) => value[choiceKey] !== undefined
  );
  if (presentKeys.length > 1) {
    push(walker, {
      code: "choice-conflict",
      path: joinPath(node.key),
      message: format(walker.text.choiceConflict, {
        name: node.key,
        keys: presentKeys.join(", "),
      }),
    });
  }
  const detected = detectChoiceType(node, value);
  if (!detected) {
    if (node.min > 0) {
      push(walker, {
        code: "required",
        path: joinPath(node.key),
        message: walker.text.required,
      });
    }
    return null;
  }
  return { key: detected.key, selectedType: detected.type.code };
};

const validateSliceCardinalities = (
  walker: Walker,
  node: SchemaNode,
  items: unknown[],
  fieldPath: string
) => {
  const { bySlice } = partitionItemsBySlice(node, items, walker.ctx);
  for (const slice of node.slices) {
    if (!slice.sliceName) continue;
    const count = bySlice.get(slice.sliceName)?.length ?? 0;
    const sliceMax = parseMaxCount(slice.max);
    if (count < slice.min) {
      push(walker, {
        code: count === 0 ? "required" : "slice-cardinality-min",
        path: fieldPath,
        message:
          count === 0
            ? walker.text.required
            : format(walker.text.sliceMin, {
                slice: slice.sliceName,
                min: slice.min,
                count,
              }),
      });
    }
    if (sliceMax !== null && count > sliceMax) {
      push(walker, {
        code: "slice-cardinality-max",
        path: fieldPath,
        message: format(walker.text.sliceMax, {
          slice: slice.sliceName,
          max: sliceMax,
          count,
        }),
      });
    }
  }
};

const validateArrayValue = (
  walker: Walker,
  node: SchemaNode,
  selectedType: string | undefined,
  raw: unknown,
  fieldPath: string,
  depth: number
) => {
  if (!Array.isArray(raw)) {
    push(walker, {
      code: "cardinality-array",
      path: fieldPath,
      message: walker.text.cardinalityArray,
    });
  }
  const items = asItems(raw);
  const maxCount = parseMaxCount(node.max);
  if (items.length < node.min) {
    push(walker, {
      code: "cardinality-min",
      path: fieldPath,
      message: format(walker.text.cardinalityMin, { min: node.min, count: items.length }),
    });
  }
  if (maxCount !== null && items.length > maxCount) {
    push(walker, {
      code: "cardinality-max",
      path: fieldPath,
      message: format(walker.text.cardinalityMax, { max: maxCount, count: items.length }),
    });
  }

  // Each item is validated against the slice that claims it, so slice
  // constraints (fixed values, child cardinalities) apply per entry.
  items.forEach((item, index) => {
    const owner = node.slices.find((slice) => matchesSlice(slice, item, walker.ctx));
    validateSingleValue(
      walker,
      owner ?? node,
      owner?.types[0]?.code ?? selectedType,
      item,
      `${fieldPath}[${index}]`,
      depth
    );
  });

  if (node.slices.length > 0) {
    validateSliceCardinalities(walker, node, items, fieldPath);
  }
};

const dedupeIssues = (issues: ValidationIssue[]) => {
  const seen = new Set<string>();
  return issues.filter((issue) => {
    const key = `${issue.code}|${issue.path}|${issue.message}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

/**
 * Validates a resource instance against its resolved schema tree:
 * cardinalities, required elements, choice conflicts, fixed/pattern values,
 * required bindings, primitive formats, unknown elements and local
 * reference integrity.
 */
export const validateResource = (
  content: Record<string, unknown>,
  tree: SchemaTree,
  ctx: SchemaContext,
  options?: ValidationOptions
): ValidationIssue[] => {
  const locale = options?.locale ?? "de";
  const walker: Walker = {
    ctx,
    tree,
    issues: [],
    text: getText(locale),
    maxDepth: options?.maxDepth ?? DEFAULT_MAX_DEPTH,
  };

  const rootChildren = getNodeChildren(
    tree.root,
    undefined,
    ctx,
    tree
  ).children;
  validateChildren(walker, rootChildren, content, "", 0);

  if (options?.existingReferences) {
    for (const broken of collectBrokenReferences(content, options.existingReferences)) {
      push(walker, {
        code: "reference-broken",
        path: broken.jsonPath,
        message: format(walker.text.referenceBroken, {
          reference: broken.reference,
          targetKey: broken.targetKey,
        }),
      });
    }
  }

  return dedupeIssues(walker.issues);
};
