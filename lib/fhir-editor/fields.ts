import type { CodingOption, ElementDefinitionType, FhirRegistry } from "@/lib/fhir-editor/registry";
import { resolveValueSetOptions } from "@/lib/fhir-editor/registry";
import type { FieldDefinition } from "@/lib/fhir-editor/profiles";
import { resolveProfileType } from "@/lib/fhir-editor/profiles";

export type FieldKind =
  | "string"
  | "markdown"
  | "boolean"
  | "number"
  | "date"
  | "dateTime"
  | "time"
  | "code"
  | "uri"
  | "url"
  | "Identifier"
  | "Coding"
  | "CodeableConcept"
  | "Reference"
  | "unknown";

const getTypeCodes = (types?: ElementDefinitionType[]) =>
  (types ?? []).map((type) => type.code).filter((code): code is string => Boolean(code));

export const resolveFieldKind = (field: FieldDefinition): FieldKind => {
  const codes = getTypeCodes(field.type);
  if (codes.length === 0 && field.path.endsWith(".identifier")) return "Identifier";
  if (codes.includes("Reference")) return "Reference";
  if (codes.includes("CodeableConcept")) return "CodeableConcept";
  if (codes.includes("Coding")) return "Coding";
  if (codes.includes("Identifier")) return "Identifier";
  if (codes.includes("boolean")) return "boolean";
  if (
    codes.includes("integer") ||
    codes.includes("decimal") ||
    codes.includes("positiveInt") ||
    codes.includes("unsignedInt")
  ) {
    return "number";
  }
  if (codes.includes("date")) return "date";
  if (codes.includes("dateTime") || codes.includes("instant")) return "dateTime";
  if (codes.includes("time")) return "time";
  if (codes.includes("uri")) return "uri";
  if (codes.includes("url")) return "url";
  if (codes.includes("code")) return "code";
  if (codes.includes("markdown")) return "markdown";
  if (codes.includes("string") || codes.includes("id")) return "string";
  return "unknown";
};

export const isRepeatingField = (field: FieldDefinition) => {
  const effectiveMax = field.baseMax ?? field.max;
  if (!effectiveMax && field.path.endsWith(".identifier")) {
    return true;
  }
  return Boolean(effectiveMax && effectiveMax !== "1" && effectiveMax !== "0");
};

export const getFieldValue = (
  content: Record<string, unknown>,
  field: FieldDefinition
) => {
  let cursor: unknown = content;
  for (const segment of field.segments) {
    if (!cursor || typeof cursor !== "object" || Array.isArray(cursor)) {
      return undefined;
    }
    cursor = (cursor as Record<string, unknown>)[segment];
  }
  return cursor;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value && typeof value === "object" && !Array.isArray(value));

export const setFieldValue = (
  content: Record<string, unknown>,
  field: FieldDefinition,
  value: unknown
) => {
  const next = { ...content };
  let cursor: Record<string, unknown> = next;

  field.segments.forEach((segment, index) => {
    if (index === field.segments.length - 1) {
      cursor[segment] = value;
      return;
    }
    const current = cursor[segment];
    if (!isRecord(current)) {
      cursor[segment] = {};
    } else {
      cursor[segment] = { ...current };
    }
    cursor = cursor[segment] as Record<string, unknown>;
  });

  return next;
};

export const removeFieldValue = (
  content: Record<string, unknown>,
  field: FieldDefinition
) => {
  const next = { ...content };
  let cursor: Record<string, unknown> = next;

  field.segments.forEach((segment, index) => {
    if (index === field.segments.length - 1) {
      delete cursor[segment];
      return;
    }
    const current = cursor[segment];
    if (!isRecord(current)) {
      return;
    }
    cursor[segment] = { ...current };
    cursor = cursor[segment] as Record<string, unknown>;
  });

  return next;
};

export const isFieldFilled = (
  content: Record<string, unknown>,
  field: FieldDefinition
) => {
  const value = getFieldValue(content, field);
  if (value === null || value === undefined) return false;
  if (typeof value === "string") return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "object") return Object.keys(value).length > 0;
  return true;
};

export const getDefaultValueForField = (
  field: FieldDefinition,
  registry?: FhirRegistry
) => {
  const kind = resolveFieldKind(field);
  const isRepeating = isRepeatingField(field);
  const typeCodes = getTypeCodes(field.type);
  const hasComplexType = typeCodes.some(
    (code) => code && code[0] === code[0].toUpperCase()
  );
  const single = () => {
    switch (kind) {
      case "boolean":
        return false;
      case "number":
        return 0;
      case "Coding": {
        const options = registry
          ? resolveValueSetOptions(field.binding?.valueSet, registry)
          : [];
        if (options.length > 0) {
          const first = options[0];
          return {
            system: first.system,
            code: first.code,
            display: first.display,
          };
        }
        return { system: "", code: "", display: "" };
      }
      case "CodeableConcept": {
        const options = registry
          ? resolveValueSetOptions(field.binding?.valueSet, registry)
          : [];
        if (options.length > 0) {
          const first = options[0];
          return {
            coding: [
              {
                system: first.system,
                code: first.code,
                display: first.display,
              },
            ],
            text: first.display,
          };
        }
        return { text: "" };
      }
      case "Reference":
        return { reference: "" };
      case "Identifier":
        return { system: "", value: "" };
      case "time":
        return "";
      default:
        if (hasComplexType) {
          return {};
        }
        return "";
    }
  };

  if (isRepeating) {
    return [single()];
  }
  return single();
};

export const resolveValueSetChoices = (
  field: FieldDefinition,
  registry?: FhirRegistry
): CodingOption[] => {
  if (!registry) return [];
  return resolveValueSetOptions(field.binding?.valueSet, registry);
};

export const resolveReferenceTargets = (
  field: FieldDefinition,
  registry?: FhirRegistry
) => {
  const targets = new Set<string>();
  if (!field.type) return targets;
  for (const type of field.type) {
    if (type.code !== "Reference") continue;
    const targetProfiles = type.targetProfile ?? type.profile ?? [];
    if (targetProfiles.length === 0) {
      targets.add("*");
      continue;
    }
    for (const canonical of targetProfiles) {
      const resolved = registry ? resolveProfileType(canonical, registry) : undefined;
      if (resolved) {
        targets.add(resolved);
      } else if (canonical) {
        const inferred = canonical.split("/").pop();
        if (inferred) targets.add(inferred);
      }
    }
  }
  return targets;
};
