import type { Locale } from "@/lib/i18n/types";

type Dictionary<T> = {
  de: T;
  en: T;
};

export const byLocale = <T>(locale: Locale, dictionary: Dictionary<T>) =>
  locale === "de" ? dictionary.de : dictionary.en;
