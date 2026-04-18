import {
  isRepeatingField,
  resolveFieldKind,
  resolveValueSetChoices,
} from "@/lib/fhir-editor/fields";
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

type PathNode = {
  value: unknown;
  relativePath: string;
};

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
  issues: ValidationIssue[]
) => {
  if (!coding.code || options.length === 0) return;

  const optionsByCode = options.filter((option) => option.code === coding.code);
  if (optionsByCode.length === 0) {
    pushIssue(issues, {
      code: "binding-code",
      path,
      message: `Code "${coding.code}" ist im gebundenen ValueSet nicht erlaubt.`,
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
        message: `System "${coding.system}" ist für Code "${coding.code}" im gebundenen ValueSet nicht erlaubt.`,
      });
    }
  }
};

const validateSingleFieldValue = (
  field: FieldDefinition,
  value: unknown,
  path: string,
  registry: FhirRegistry | undefined,
  issues: ValidationIssue[]
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
          message: `Identifier-System "${system}" ist im Profil nicht erlaubt.`,
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
          message: `Identifier-Typ "${typeCoding.code}" ist im Profil nicht erlaubt.`,
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
      issues
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
        message: "Mindestens ein Coding aus dem gebundenen ValueSet ist erforderlich.",
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
        issues
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
        message: `Wert "${value}" ist im gebundenen ValueSet nicht erlaubt.`,
      });
    }
  }
};

const validateField = (
  content: Record<string, unknown>,
  field: FieldDefinition,
  registry: FhirRegistry | undefined,
  issues: ValidationIssue[]
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
  const parents = expandParentNodes(rawParents);

  const repeating = isRepeatingField(field);
  const min = Math.max(0, field.min ?? 0);
  const max = parseMaxCardinality(field.max);

  if (parents.length === 0) {
    if (parentSegments.length === 0 && min > 0) {
      pushIssue(issues, {
        code: "required",
        path: field.path,
        message: "Pflichtfeld ist nicht befüllt.",
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
          message: "Dieses Feld muss als Array geführt werden.",
        });
      }

      if (count < min) {
        pushIssue(issues, {
          code: "cardinality-min",
          path: fieldPath,
          message: `Mindestens ${min} Wert(e) erforderlich, aktuell ${count}.`,
        });
      }

      if (max !== null && count > max) {
        pushIssue(issues, {
          code: "cardinality-max",
          path: fieldPath,
          message: `Maximal ${max} Wert(e) erlaubt, aktuell ${count}.`,
        });
      }

      if (Array.isArray(value)) {
        value.forEach((entry, index) =>
          validateSingleFieldValue(field, entry, `${fieldPath}[${index}]`, registry, issues)
        );
      } else if (value !== undefined && value !== null) {
        validateSingleFieldValue(field, value, fieldPath, registry, issues);
      }
      continue;
    }

    if (Array.isArray(value)) {
      if (value.length < min) {
        pushIssue(issues, {
          code: "cardinality-min",
          path: fieldPath,
          message: `Mindestens ${min} Wert(e) erforderlich, aktuell ${value.length}.`,
        });
        continue;
      }
      if (value.length > 1) {
        pushIssue(issues, {
          code: "cardinality-single",
          path: fieldPath,
          message: `Dieses Feld darf nur einmal vorkommen, aktuell ${value.length} Einträge.`,
        });
        continue;
      }
      if (value.length === 1) {
        validateSingleFieldValue(field, value[0], `${fieldPath}[0]`, registry, issues);
      }
      continue;
    }

    if (min > 0 && !isPresent(value)) {
      pushIssue(issues, {
        code: "required",
        path: fieldPath,
        message: "Pflichtfeld ist nicht befüllt.",
      });
      continue;
    }

    validateSingleFieldValue(field, value, fieldPath, registry, issues);
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
  registry?: FhirRegistry
): ValidationIssue[] => {
  const issues: ValidationIssue[] = [];
  for (const field of fields) {
    validateField(content, field, registry, issues);
  }
  return dedupeIssues(issues);
};
