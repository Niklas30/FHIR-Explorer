import type { Locale } from "@/lib/i18n/types";

type Dictionary<T> = Partial<Record<Locale, T>> & {
  en: T;
};

export const byLocale = <T>(locale: Locale, dictionary: Dictionary<T>) =>
  dictionary[locale] ?? dictionary.en;
