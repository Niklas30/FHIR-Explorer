"use client";

import Link from "next/link";
import { useEffect } from "react";
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
    fr: {
      title: "Mode Dev",
      description: "L'ouverture de /devmode active automatiquement ce mode.",
      activatedNotice: "Le mode Dev a été activé en ouvrant cette page.",
      enable: "Activer le mode Dev",
      disable: "Désactiver le mode Dev",
      home: "Retour à l'accueil",
      details:
        "En cas d'erreur de l'éditeur, la page d'erreur affiche des détails supplémentaires en mode Dev actif (message, digest, stack trace), même en production.",
    },
    es: {
      title: "Modo Dev",
      description: "Abrir /devmode activa este modo automáticamente.",
      activatedNotice: "El modo Dev se activó al abrir esta página.",
      enable: "Activar modo Dev",
      disable: "Desactivar modo Dev",
      home: "Volver al inicio",
      details:
        "Si ocurre un error del editor, la página de error muestra detalles adicionales en modo Dev activo (mensaje, digest, stack trace), incluso en producción.",
    },
    it: {
      title: "Modalità Dev",
      description: "Aprendo /devmode questa modalità si attiva automaticamente.",
      activatedNotice: "La modalità Dev è stata attivata aprendo questa pagina.",
      enable: "Attiva modalità Dev",
      disable: "Disattiva modalità Dev",
      home: "Torna alla home",
      details:
        "Se si verifica un errore dell'editor, la pagina di errore mostra dettagli aggiuntivi con modalità Dev attiva (messaggio, digest, stack trace), anche in produzione.",
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
