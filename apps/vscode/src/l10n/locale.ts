import * as vscode from "vscode";
import { isLocale, type Locale } from "@fhir-explorer/core/i18n/types";

/**
 * The locale the shared core and components should speak: VS Code's display
 * language, reduced to one of the five the project ships, English otherwise.
 */
export const hostLocale = (): Locale => {
  const language = vscode.env.language.split("-")[0];
  return isLocale(language) ? language : "en";
};
