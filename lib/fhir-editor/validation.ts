import {
  isRepeatingField,
  resolveFieldKind,
  resolveValueSetChoices,
} from "@/lib/fhir-editor/fields";
import { collectBrokenReferences } from "@/lib/fhir-editor/references";
import { byLocale } from "@/lib/i18n/select";
import type { Locale } from "@/lib/i18n/types";
import { normalizeCanonical, type FhirRegistry } from "@/lib/fhir-editor/registry";
import type { FieldDefinition } from "@/lib/fhir-editor/profiles";

export type ValidationIssue = {
  severity: "error" | "warning";
  code: string;
  path: string;
  message: string;
};

type CodingValue = {
  system?: string;
  code?: string;
};

type ValidationOptions = {
  existingReferences?: Set<string>;
  locale?: Locale;
};

type PathNode = {
  value: unknown;
  relativePath: string;
};

type ValidationText = {
  bindingCode: string;
  bindingSystem: string;
  identifierSystem: string;
  identifierType: string;
  bindingRequired: string;
  bindingPrimitive: string;
  required: string;
  cardinalityArray: string;
  cardinalityMin: string;
  cardinalityMax: string;
  cardinalitySingle: string;
  referenceBroken: string;
};

const format = (template: string, values: Record<string, string | number>) =>
  template.replace(/\{(\w+)\}/g, (_, key) => String(values[key] ?? ""));

const getValidationText = (locale: Locale): ValidationText =>
  byLocale(locale, {
    de: {
      bindingCode: 'Code "{code}" ist im gebundenen ValueSet nicht erlaubt.',
      bindingSystem:
        'System "{system}" ist für Code "{code}" im gebundenen ValueSet nicht erlaubt.',
      identifierSystem: 'Identifier-System "{system}" ist im Profil nicht erlaubt.',
      identifierType: 'Identifier-Typ "{code}" ist im Profil nicht erlaubt.',
      bindingRequired: "Mindestens ein Coding aus dem gebundenen ValueSet ist erforderlich.",
      bindingPrimitive: 'Wert "{value}" ist im gebundenen ValueSet nicht erlaubt.',
      required: "Pflichtfeld ist nicht befüllt.",
      cardinalityArray: "Dieses Feld muss als Array geführt werden.",
      cardinalityMin: "Mindestens {min} Wert(e) erforderlich, aktuell {count}.",
      cardinalityMax: "Maximal {max} Wert(e) erlaubt, aktuell {count}.",
      cardinalitySingle: "Dieses Feld darf nur einmal vorkommen, aktuell {count} Einträge.",
      referenceBroken: 'Referenz "{reference}" zeigt auf fehlende Resource "{targetKey}".',
    },
    en: {
      bindingCode: 'Code "{code}" is not allowed in the bound ValueSet.',
      bindingSystem:
        'System "{system}" is not allowed for code "{code}" in the bound ValueSet.',
      identifierSystem: 'Identifier system "{system}" is not allowed by the profile.',
      identifierType: 'Identifier type "{code}" is not allowed by the profile.',
      bindingRequired: "At least one coding from the bound ValueSet is required.",
      bindingPrimitive: 'Value "{value}" is not allowed in the bound ValueSet.',
      required: "Required field is missing.",
      cardinalityArray: "This field must be represented as an array.",
      cardinalityMin: "At least {min} value(s) required, currently {count}.",
      cardinalityMax: "At most {max} value(s) allowed, currently {count}.",
      cardinalitySingle: "This field may occur only once, currently {count} entries.",
      referenceBroken: 'Reference "{reference}" points to missing resource "{targetKey}".',
    },
  });

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value && typeof value === "object" && !Array.isArray(value));

const parseMaxCardinality = (max?: string) => {
  if (!max || max === "*") return null;
  const parsed = Number(max);
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return parsed;
};

const isPresent = (value: unknown): boolean => {
  if (value === null || value === undefined) return false;
  if (typeof value === "string") return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "object") return Object.keys(value).length > 0;
  return true;
};

const normalizeSystem = (system: string | undefined) =>
  system ? normalizeCanonical(system) : undefined;

const codingMatchesOption = (
  coding: CodingValue,
  option: { system?: string; code: string }
) => {
  if (!coding.code || option.code !== coding.code) return false;
  if (!coding.system) return true;
  if (!option.system) return false;
  return normalizeSystem(option.system) === normalizeSystem(coding.system);
};

const getIdentifierTypeCoding = (identifierType: unknown): CodingValue | null => {
  if (!isRecord(identifierType)) return null;
  const codings = identifierType.coding;
  if (!Array.isArray(codings) || codings.length === 0) return null;
  const first = codings[0];
  if (!isRecord(first)) return null;
  return {
    system: typeof first.system === "string" ? first.system : undefined,
    code: typeof first.code === "string" ? first.code : undefined,
  };
};

const appendPathSegment = (path: string, segment: string) =>
  path ? `${path}.${segment}` : segment;

const appendPathIndex = (path: string, index: number) =>
  path ? `${path}[${index}]` : `[${index}]`;

const buildIssuePath = (field: FieldDefinition, relativePath: string) => {
  const dotIndex = field.path.indexOf(".");
  if (dotIndex === -1) {
    return relativePath || field.path;
  }
  const root = field.path.slice(0, dotIndex);
  return relativePath ? `${root}.${relativePath}` : field.path;
};

const resolvePathNodes = (
  value: unknown,
  segments: string[],
  relativePath = ""
): PathNode[] => {
  if (segments.length === 0) {
    return [{ value, relativePath }];
  }

  if (Array.isArray(value)) {
    return value.flatMap((entry, index) =>
      resolvePathNodes(entry, segments, appendPathIndex(relativePath, index))
    );
  }

  if (!isRecord(value)) {
    return [];
  }

  const [segment, ...rest] = segments;
  const nextValue = value[segment];
  const nextPath = appendPathSegment(relativePath, segment);
  return resolvePathNodes(nextValue, rest, nextPath);
};

const expandParentNodes = (nodes: PathNode[]): PathNode[] =>
  nodes.flatMap((node) => {
    if (!Array.isArray(node.value)) {
      return [node];
    }
    return node.value.map((entry, index) => ({
      value: entry,
      relativePath: appendPathIndex(node.relativePath, index),
    }));
  });

const pushIssue = (
  issues: ValidationIssue[],
  issue: Omit<ValidationIssue, "severity"> & { severity?: ValidationIssue["severity"] }
) => {
  issues.push({
    severity: issue.severity ?? "error",
    code: issue.code,
    path: issue.path,
    message: issue.message,
  });
};

const validateCodingAgainstOptions = (
  coding: CodingValue,
  options: Array<{ system?: string; code: string }>,
  path: string,
  issues: ValidationIssue[],
  text: ValidationText
) => {
  if (!coding.code || options.length === 0) return;

  const optionsByCode = options.filter((option) => option.code === coding.code);
  if (optionsByCode.length === 0) {
    pushIssue(issues, {
      code: "binding-code",
      path,
      message: format(text.bindingCode, { code: coding.code }),
    });
    return;
  }

  if (coding.system) {
    const hasSystemMatch = optionsByCode.some((option) =>
      option.system
        ? normalizeSystem(option.system) === normalizeSystem(coding.system)
        : false
    );
    if (!hasSystemMatch) {
      pushIssue(issues, {
        code: "binding-system",
        path,
        message: format(text.bindingSystem, {
          system: coding.system,
          code: coding.code,
        }),
      });
    }
  }
};

const validateSingleFieldValue = (
  field: FieldDefinition,
  value: unknown,
  path: string,
  registry: FhirRegistry | undefined,
  issues: ValidationIssue[],
  text: ValidationText
) => {
  const kind = field.path.endsWith(".identifier")
    ? "Identifier"
    : resolveFieldKind(field);
  const options = registry ? resolveValueSetChoices(field, registry) : [];

  if (kind === "Reference") {
    return;
  }

  if (kind === "Identifier") {
    if (!isRecord(value)) return;

    const system = typeof value.system === "string" ? value.system : undefined;
    if (system && Array.isArray(field.identifierSystems) && field.identifierSystems.length > 0) {
      const allowedSystems = new Set(
        field.identifierSystems.map((entry) => normalizeSystem(entry.system))
      );
      if (!allowedSystems.has(normalizeSystem(system))) {
        pushIssue(issues, {
          code: "identifier-system",
          path: `${path}.system`,
          message: format(text.identifierSystem, { system }),
        });
      }
    }

    const typeCoding = getIdentifierTypeCoding(value.type);
    if (typeCoding?.code && Array.isArray(field.identifierTypeOptions) && field.identifierTypeOptions.length > 0) {
      const hasTypeMatch = field.identifierTypeOptions.some((option) =>
        codingMatchesOption(typeCoding, option)
      );
      if (!hasTypeMatch) {
        pushIssue(issues, {
          code: "identifier-type",
          path: `${path}.type`,
          message: format(text.identifierType, { code: typeCoding.code }),
        });
      }
    }
    return;
  }

  if (kind === "Coding") {
    if (!isRecord(value)) return;
    validateCodingAgainstOptions(
      {
        system: typeof value.system === "string" ? value.system : undefined,
        code: typeof value.code === "string" ? value.code : undefined,
      },
      options,
      path,
      issues,
      text
    );
    return;
  }

  if (kind === "CodeableConcept") {
    if (!isRecord(value)) return;

    const codings = Array.isArray(value.coding)
      ? value.coding.filter(isRecord)
      : [];

    if (
      field.binding?.strength === "required" &&
      options.length > 0 &&
      codings.length === 0 &&
      typeof value.text !== "string"
    ) {
      pushIssue(issues, {
        code: "binding-required",
        path,
        message: text.bindingRequired,
      });
    }

    codings.forEach((coding, index) => {
      validateCodingAgainstOptions(
        {
          system: typeof coding.system === "string" ? coding.system : undefined,
          code: typeof coding.code === "string" ? coding.code : undefined,
        },
        options,
        `${path}.coding[${index}]`,
        issues,
        text
      );
    });
    return;
  }

  if (
    (kind === "code" || kind === "string" || kind === "uri" || kind === "url") &&
    typeof value === "string" &&
    options.length > 0
  ) {
    const allowedCodes = new Set(options.map((option) => option.code));
    if (!allowedCodes.has(value)) {
      pushIssue(issues, {
        code: "binding-primitive",
        path,
        message: format(text.bindingPrimitive, { value }),
      });
    }
  }
};

const validateField = (
  content: Record<string, unknown>,
  field: FieldDefinition,
  registry: FhirRegistry | undefined,
  issues: ValidationIssue[],
  text: ValidationText
) => {
  if (field.segments.length === 0) return;
  if (field.path === "id") return;
  if (field.path.endsWith(".id")) return;

  const parentSegments = field.segments.slice(0, -1);
  const leafSegment = field.segments[field.segments.length - 1];
  const rawParents =
    parentSegments.length === 0
      ? [{ value: content, relativePath: "" } satisfies PathNode]
      : resolvePathNodes(content, parentSegments);
  const parents = expandParentNodes(rawParents).filter(
    (node) => node.value !== undefined && node.value !== null
  );

  const repeating = isRepeatingField(field);
  const min = Math.max(0, field.min ?? 0);
  const max = parseMaxCardinality(field.max);

  if (parents.length === 0) {
    if (parentSegments.length === 0 && min > 0) {
      pushIssue(issues, {
        code: "required",
        path: field.path,
        message: text.required,
      });
    }
    return;
  }

  for (const parent of parents) {
    const value = isRecord(parent.value) ? parent.value[leafSegment] : undefined;
    const relativePath = appendPathSegment(parent.relativePath, leafSegment);
    const fieldPath = buildIssuePath(field, relativePath);

    if (repeating) {
      let count = 0;
      if (Array.isArray(value)) {
        count = value.length;
      } else if (value !== undefined && value !== null) {
        count = 1;
        pushIssue(issues, {
          code: "cardinality-array",
          path: fieldPath,
          message: text.cardinalityArray,
        });
      }

      if (count < min) {
        pushIssue(issues, {
          code: "cardinality-min",
          path: fieldPath,
          message: format(text.cardinalityMin, { min, count }),
        });
      }

      if (max !== null && count > max) {
        pushIssue(issues, {
          code: "cardinality-max",
          path: fieldPath,
          message: format(text.cardinalityMax, { max, count }),
        });
      }

      if (Array.isArray(value)) {
        value.forEach((entry, index) =>
          validateSingleFieldValue(
            field,
            entry,
            `${fieldPath}[${index}]`,
            registry,
            issues,
            text
          )
        );
      } else if (value !== undefined && value !== null) {
        validateSingleFieldValue(field, value, fieldPath, registry, issues, text);
      }
      continue;
    }

    if (Array.isArray(value)) {
      if (value.length < min) {
        pushIssue(issues, {
          code: "cardinality-min",
          path: fieldPath,
          message: format(text.cardinalityMin, { min, count: value.length }),
        });
        continue;
      }
      if (value.length > 1) {
        pushIssue(issues, {
          code: "cardinality-single",
          path: fieldPath,
          message: format(text.cardinalitySingle, { count: value.length }),
        });
        continue;
      }
      if (value.length === 1) {
        validateSingleFieldValue(
          field,
          value[0],
          `${fieldPath}[0]`,
          registry,
          issues,
          text
        );
      }
      continue;
    }

    if (min > 0 && !isPresent(value)) {
      pushIssue(issues, {
        code: "required",
        path: fieldPath,
        message: text.required,
      });
      continue;
    }

    validateSingleFieldValue(field, value, fieldPath, registry, issues, text);
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

export const validateResourceWithProfile = (
  content: Record<string, unknown>,
  fields: FieldDefinition[],
  registry?: FhirRegistry,
  options?: ValidationOptions
): ValidationIssue[] => {
  const locale = options?.locale ?? "de";
  const text = getValidationText(locale);
  const issues: ValidationIssue[] = [];
  for (const field of fields) {
    validateField(content, field, registry, issues, text);
  }

  if (options?.existingReferences) {
    const brokenReferences = collectBrokenReferences(content, options.existingReferences);
    for (const issue of brokenReferences) {
      pushIssue(issues, {
        code: "reference-broken",
        path: issue.jsonPath,
        message: format(text.referenceBroken, {
          reference: issue.reference,
          targetKey: issue.targetKey,
        }),
      });
    }
  }

  return dedupeIssues(issues);
};
