import type { Locale } from "@fhir-explorer/core/i18n/types";

type Dictionary<T> = Partial<Record<Locale, T>> & {
  en: T;
};

export const byLocale = <T>(locale: Locale, dictionary: Dictionary<T>) =>
  dictionary[locale] ?? dictionary.en;
