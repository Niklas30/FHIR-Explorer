export type Locale = "de" | "en" | "fr" | "es" | "it";

export const isLocale = (value: string): value is Locale =>
  value === "de" ||
  value === "en" ||
  value === "fr" ||
  value === "es" ||
  value === "it";
