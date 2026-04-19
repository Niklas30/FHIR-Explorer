import type { ValidationIssue } from "@/lib/fhir-editor/validation";

export const formatTemplate = (
  template: string,
  values: Record<string, string | number>
) => template.replace(/\{(\w+)\}/g, (_, key) => String(values[key] ?? ""));

export const formatOptionLabel = (system?: string, code?: string, display?: string) => {
  const label = display || code || "?";
  if (system) {
    const tail = system.split("/").pop();
    return `${label} · ${tail ?? system}`;
  }
  return label;
};

export const normalizeTimeWithSeconds = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (/^\\d{2}:\\d{2}$/.test(trimmed)) {
    return `${trimmed}:00`;
  }
  return trimmed;
};

export const parseMaxCardinality = (max?: string) => {
  if (!max || max === "*") return null;
  const parsed = Number(max);
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return parsed;
};

const isIssueForPath = (issuePath: string, targetPath: string) => {
  if (issuePath === targetPath) return true;
  return issuePath.startsWith(`${targetPath}.`) || issuePath.startsWith(`${targetPath}[`);
};

export const getFieldValidationIssues = (issues: ValidationIssue[], targetPath: string) =>
  issues.filter(
    (issue) => issue.code !== "reference-broken" && isIssueForPath(issue.path, targetPath)
  );

export const isReferenceValue = (
  value: unknown
): value is { reference?: string; display?: string; identifier?: unknown } =>
  Boolean(
    value && typeof value === "object" && "reference" in (value as Record<string, unknown>)
  );

export const extractReferenceString = (value: unknown): string | null => {
  if (typeof value === "string" && value.trim().length > 0) {
    return value.trim();
  }
  if (
    isReferenceValue(value) &&
    typeof value.reference === "string" &&
    value.reference.trim().length > 0
  ) {
    return value.reference.trim();
  }
  return null;
};

