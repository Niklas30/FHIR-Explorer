"use client";

import { useI18n } from "@/components/i18n/I18nProvider";
import { byLocale } from "@/lib/i18n/select";

export const ImporterLoadingFallback = () => {
  const { locale } = useI18n();
  const text = byLocale(locale, {
    de: "Importer wird geladen…",
    en: "Loading importer…",
  });

  return <div className="px-6 py-8 text-sm text-muted-foreground">{text}</div>;
};
