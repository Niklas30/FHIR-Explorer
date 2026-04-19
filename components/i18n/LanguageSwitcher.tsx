"use client";

import { Check, Globe, Languages, MonitorSmartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useI18n } from "@/components/i18n/I18nProvider";
import { byLocale } from "@/lib/i18n/select";
import type { Locale } from "@/lib/i18n/types";
import { cn } from "@/lib/utils";

type LanguageSwitcherProps = {
  className?: string;
};

const SUPPORTED_LOCALES: Array<{
  value: Locale;
  nativeName: string;
  englishName: string;
}> = [
  { value: "de", nativeName: "Deutsch", englishName: "German" },
  { value: "en", nativeName: "English", englishName: "English" },
  { value: "fr", nativeName: "Français", englishName: "French" },
  { value: "es", nativeName: "Español", englishName: "Spanish" },
  { value: "it", nativeName: "Italiano", englishName: "Italian" },
];

const useLanguageUi = () => {
  const { locale, localeMode } = useI18n();
  const text = byLocale(locale, {
    de: {
      language: "Sprache",
      languageAria: "Sprache auswählen",
      chooseLanguage: "Sprache auswählen",
      system: "System",
      systemHint: "Folgt der Browser-Sprache",
      autoShort: "Auto",
    },
    en: {
      language: "Language",
      languageAria: "Select language",
      chooseLanguage: "Choose language",
      system: "System",
      systemHint: "Follows browser language",
      autoShort: "Auto",
    },
    fr: {
      language: "Langue",
      languageAria: "Choisir la langue",
      chooseLanguage: "Choisir la langue",
      system: "Système",
      systemHint: "Suit la langue du navigateur",
      autoShort: "Auto",
    },
    es: {
      language: "Idioma",
      languageAria: "Seleccionar idioma",
      chooseLanguage: "Seleccionar idioma",
      system: "Sistema",
      systemHint: "Sigue el idioma del navegador",
      autoShort: "Auto",
    },
    it: {
      language: "Lingua",
      languageAria: "Seleziona lingua",
      chooseLanguage: "Seleziona lingua",
      system: "Sistema",
      systemHint: "Segue la lingua del browser",
      autoShort: "Auto",
    },
  });

  const currentLabel =
    localeMode === "system"
      ? text.autoShort
      : localeMode.toUpperCase();

  const labelForLocale = (entry: (typeof SUPPORTED_LOCALES)[number]) => {
    if (locale === "de" || locale === "fr" || locale === "es" || locale === "it") {
      return entry.nativeName;
    }
    return entry.englishName;
  };

  return { locale, localeMode, text, currentLabel, labelForLocale };
};

export const LanguageSwitcher = ({ className }: LanguageSwitcherProps) => {
  const { localeMode, setLocaleMode } = useI18n();
  const { text, labelForLocale } = useLanguageUi();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          className={cn(className)}
          aria-label={text.languageAria}
          title={text.language}
        >
          <Languages className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[180px]">
        <DropdownMenuLabel>{text.language}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => setLocaleMode("system")}>
          <MonitorSmartphone className="size-4" />
          <span>{text.system}</span>
          {localeMode === "system" ? <Check className="ml-auto size-4" /> : null}
        </DropdownMenuItem>
        {SUPPORTED_LOCALES.map((entry) => (
          <DropdownMenuItem key={entry.value} onClick={() => setLocaleMode(entry.value)}>
            <Globe className="size-4" />
            <span>{labelForLocale(entry)}</span>
            {localeMode === entry.value ? <Check className="ml-auto size-4" /> : null}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export const LanguageMenuSub = () => {
  const { localeMode, setLocaleMode } = useI18n();
  const { text, currentLabel, labelForLocale } = useLanguageUi();

  return (
    <DropdownMenuSub>
      <DropdownMenuSubTrigger>
        <Languages className="size-4" />
        {text.language}
        <DropdownMenuShortcut>{currentLabel}</DropdownMenuShortcut>
      </DropdownMenuSubTrigger>
      <DropdownMenuSubContent className="min-w-[240px]">
        <DropdownMenuLabel>{text.chooseLanguage}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuRadioGroup
          value={localeMode}
          onValueChange={(value) => setLocaleMode(value as "system" | Locale)}
        >
          <DropdownMenuRadioItem value="system">
            <MonitorSmartphone className="size-4" />
            <span>{text.system}</span>
            <DropdownMenuShortcut>{text.systemHint}</DropdownMenuShortcut>
          </DropdownMenuRadioItem>
          {SUPPORTED_LOCALES.map((entry) => (
            <DropdownMenuRadioItem key={entry.value} value={entry.value}>
              <Globe className="size-4" />
              <span>{labelForLocale(entry)}</span>
              <DropdownMenuShortcut>{entry.value.toUpperCase()}</DropdownMenuShortcut>
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuSubContent>
    </DropdownMenuSub>
  );
};
