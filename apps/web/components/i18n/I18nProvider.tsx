"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { isLocale, type Locale } from "@fhir-explorer/core/i18n/types";
import { migrateLegacyLocalStorage } from "@fhir-explorer/core/adapters/browser/legacy-migration";
import {
  I18nContextProvider,
  type I18nContextValue,
  type LocaleMode,
} from "@fhir-explorer/ui";

// Carry pre-rename localStorage (health-compose-*) forward. Runs when the client
// bundle first evaluates this module — before any component effect reads storage.
migrateLegacyLocalStorage();

const LOCALE_STORAGE_KEY = "fhir-explorer-locale";

const detectSystemLocale = (): Locale => {
  if (typeof navigator === "undefined") return "de";
  const normalized = navigator.language.toLowerCase();
  if (normalized.startsWith("de")) return "de";
  if (normalized.startsWith("fr")) return "fr";
  if (normalized.startsWith("es")) return "es";
  if (normalized.startsWith("it")) return "it";
  return "en";
};

type I18nProviderProps = {
  children: ReactNode;
};

/**
 * Browser-side locale resolution. The shared components only consume the
 * resulting value; where it comes from — localStorage and `navigator` here,
 * `vscode.env.language` in the extension — is the host's business.
 */
export const I18nProvider = ({ children }: I18nProviderProps) => {
  const [localeMode, setLocaleModeState] = useState<LocaleMode>("system");
  const [systemLocale, setSystemLocale] = useState<Locale>(detectSystemLocale);
  const locale = localeMode === "system" ? systemLocale : localeMode;

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem(LOCALE_STORAGE_KEY);
    if (stored === "system" || (stored && isLocale(stored))) {
      setLocaleModeState(stored as LocaleMode);
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const handleLanguageChange = () => {
      setSystemLocale(detectSystemLocale());
    };
    handleLanguageChange();
    window.addEventListener("languagechange", handleLanguageChange);
    return () => window.removeEventListener("languagechange", handleLanguageChange);
  }, []);

  useEffect(() => {
    if (typeof document === "undefined") return;
    document.documentElement.lang = locale;
    if (typeof window !== "undefined") {
      window.localStorage.setItem(LOCALE_STORAGE_KEY, localeMode);
    }
  }, [locale, localeMode]);

  const setLocale = useCallback((nextLocale: Locale) => {
    setLocaleModeState(nextLocale);
  }, []);

  const setLocaleMode = useCallback((mode: LocaleMode) => {
    setLocaleModeState(mode);
  }, []);

  const value = useMemo<I18nContextValue>(
    () => ({ locale, localeMode, setLocale, setLocaleMode }),
    [locale, localeMode, setLocale, setLocaleMode]
  );

  return <I18nContextProvider value={value}>{children}</I18nContextProvider>;
};

// Re-exported so the app's own components keep importing the hook from here.
export { useI18n } from "@fhir-explorer/ui";
