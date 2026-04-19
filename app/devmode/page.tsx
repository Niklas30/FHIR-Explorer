"use client";

import Link from "next/link";
import { useEffect } from "react";
import { LanguageSwitcher } from "@/components/i18n/LanguageSwitcher";
import { useI18n } from "@/components/i18n/I18nProvider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { byLocale } from "@/lib/i18n/select";
import { setDevModeEnabled } from "@/lib/dev-mode";

export default function DevModePage() {
  const { locale } = useI18n();
  const text = byLocale(locale, {
    de: {
      title: "Dev Mode",
      description:
        "Beim Aufruf von /devmode wird der Modus automatisch aktiviert.",
      activatedNotice: "Dev Mode wurde beim Öffnen dieser Seite aktiviert.",
      enable: "Dev Mode aktivieren",
      disable: "Dev Mode deaktivieren",
      home: "Zur Startseite",
      details:
        "Wenn ein Editor-Fehler auftritt, zeigt die Fehlerseite im aktiven Dev Mode zusätzliche Details (z. B. Message, Digest, Stacktrace) auch im Produktionsbetrieb.",
    },
    en: {
      title: "Dev Mode",
      description: "Opening /devmode automatically enables this mode.",
      activatedNotice: "Dev Mode was enabled when opening this page.",
      enable: "Enable Dev Mode",
      disable: "Disable Dev Mode",
      home: "Back to home",
      details:
        "If an editor error occurs, the error page shows extra details in active Dev Mode (for example message, digest, stack trace), even in production.",
    },
  });

  useEffect(() => {
    setDevModeEnabled(true);
  }, []);

  const handleEnable = () => {
    setDevModeEnabled(true);
    window.location.reload();
  };

  const handleDisable = () => {
    setDevModeEnabled(false);
    window.location.reload();
  };

  return (
    <main className="mx-auto flex min-h-[100dvh] w-full max-w-3xl items-center px-4 py-10">
      <Card className="w-full border-foreground/10">
        <CardHeader>
          <CardTitle className="text-2xl">{text.title}</CardTitle>
          <CardDescription>
            {text.description}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">{text.activatedNotice}</p>

          <div className="flex flex-wrap gap-3">
            <Button onClick={handleEnable}>{text.enable}</Button>
            <Button variant="outline" onClick={handleDisable}>
              {text.disable}
            </Button>
            <LanguageSwitcher />
            <Button asChild variant="secondary">
              <Link href="/">{text.home}</Link>
            </Button>
          </div>

          <p className="text-sm text-muted-foreground">
            {text.details}
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
