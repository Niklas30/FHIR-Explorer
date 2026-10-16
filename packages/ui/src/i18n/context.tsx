"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { Locale } from "@fhir-explorer/core/i18n/types";

/**
 * Locale for the shared components, supplied by the host.
 *
 * Deliberately controlled: the web app derives the locale from localStorage
 * and `navigator.language`, the VS Code webview from `vscode.env.language`.
 * Neither belongs in a component library.
 */

export type LocaleMode = Locale | "system";

export type I18nContextValue = {
  locale: Locale;
  localeMode: LocaleMode;
  setLocale: (locale: Locale) => void;
  setLocaleMode: (mode: LocaleMode) => void;
};

const I18nReactContext = createContext<I18nContextValue | null>(null);

export const I18nContextProvider = ({
  value,
  children,
}: {
  value: I18nContextValue;
  children: ReactNode;
}) => <I18nReactContext.Provider value={value}>{children}</I18nReactContext.Provider>;

export const useI18n = () => {
  const context = useContext(I18nReactContext);
  if (!context) {
    throw new Error("useI18n must be used within an I18nProvider");
  }
  return context;
};
