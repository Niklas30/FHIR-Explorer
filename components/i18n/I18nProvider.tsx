"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { isLocale, type Locale } from "@/lib/i18n/types";

const LOCALE_STORAGE_KEY = "health-compose-locale";
type LocaleMode = Locale | "system";

type I18nContextValue = {
  locale: Locale;
  localeMode: LocaleMode;
  setLocale: (locale: Locale) => void;
  setLocaleMode: (mode: LocaleMode) => void;
};

const I18nContext = createContext<I18nContextValue | null>(null);

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
    () => ({
      locale,
      localeMode,
      setLocale,
      setLocaleMode,
    }),
    [locale, localeMode, setLocale, setLocaleMode]
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
};

export const useI18n = () => {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error("useI18n must be used within an I18nProvider");
  }
  return context;
};
