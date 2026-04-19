export type Locale = "de" | "en";

export const isLocale = (value: string): value is Locale =>
  value === "de" || value === "en";
