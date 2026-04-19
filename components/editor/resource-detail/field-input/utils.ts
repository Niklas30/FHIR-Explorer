export const IDENTIFIER_USE_OPTIONS = ["usual", "official", "temp", "secondary", "old"] as const;

export const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value && typeof value === "object" && !Array.isArray(value));

export const getCodingAt = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== "object") return {};
  const record = value as Record<string, unknown>;
  const coding = record["coding"];
  if (Array.isArray(coding) && coding.length > 0) {
    const first = coding[0];
    if (first && typeof first === "object") {
      return first as Record<string, unknown>;
    }
  }
  return record;
};

export const setCodingAt = (value: Record<string, unknown>, coding: Record<string, unknown>) => {
  if ("coding" in value || "text" in value) {
    return {
      ...value,
      coding: [coding],
    };
  }
  return {
    coding: [coding],
  };
};

