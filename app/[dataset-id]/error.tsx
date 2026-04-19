"use client";

import Link from "next/link";
import { useEffect, useMemo } from "react";
import { useI18n } from "@/components/i18n/I18nProvider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { byLocale } from "@/lib/i18n/select";
import { isDevModeEnabled } from "@/lib/dev-mode";

export default function DatasetEditorError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const { locale } = useI18n();
  const showDetails = isDevModeEnabled();
  const text = byLocale(locale, {
    de: {
      title: "Editor-Fehler",
      description: "Beim Laden oder Rendern des Editors ist ein Fehler aufgetreten.",
      noMessage: "(keine Nachricht)",
      devModeHintPrefix: "Für technische Details kann Dev Mode über",
      devModeHintSuffix: "aktiviert werden.",
      retry: "Erneut versuchen",
      openDevMode: "Dev Mode öffnen",
      home: "Zur Startseite",
    },
    en: {
      title: "Editor error",
      description: "An error occurred while loading or rendering the editor.",
      noMessage: "(no message)",
      devModeHintPrefix: "For technical details, you can enable Dev Mode via",
      devModeHintSuffix: ".",
      retry: "Try again",
      openDevMode: "Open Dev Mode",
      home: "Back to home",
    },
    fr: {
      title: "Erreur de l'éditeur",
      description: "Une erreur est survenue lors du chargement ou du rendu de l'éditeur.",
      noMessage: "(pas de message)",
      devModeHintPrefix:
        "Pour les détails techniques, vous pouvez activer le mode Dev via",
      devModeHintSuffix: ".",
      retry: "Réessayer",
      openDevMode: "Ouvrir le mode Dev",
      home: "Retour à l'accueil",
    },
    es: {
      title: "Error del editor",
      description: "Ocurrió un error al cargar o renderizar el editor.",
      noMessage: "(sin mensaje)",
      devModeHintPrefix:
        "Para más detalles técnicos, puedes activar el modo Dev en",
      devModeHintSuffix: ".",
      retry: "Reintentar",
      openDevMode: "Abrir modo Dev",
      home: "Volver al inicio",
    },
    it: {
      title: "Errore editor",
      description: "Si è verificato un errore durante il caricamento o il rendering dell'editor.",
      noMessage: "(nessun messaggio)",
      devModeHintPrefix:
        "Per i dettagli tecnici puoi attivare la modalità Dev tramite",
      devModeHintSuffix: ".",
      retry: "Riprova",
      openDevMode: "Apri modalità Dev",
      home: "Torna alla home",
    },
  });

  useEffect(() => {
    console.error(error);
  }, [error]);

  const errorDetails = useMemo(() => {
    const lines = [`message: ${error.message || text.noMessage}`];
    if (error.digest) {
      lines.push(`digest: ${error.digest}`);
    }
    if (error.stack) {
      lines.push("");
      lines.push(error.stack);
    }
    return lines.join("\n");
  }, [error, text.noMessage]);

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
          {showDetails ? (
            <pre className="max-h-[45dvh] overflow-auto rounded-md border border-foreground/10 bg-muted/30 p-3 text-xs whitespace-pre-wrap">
              {errorDetails}
            </pre>
          ) : (
            <p className="text-sm text-muted-foreground">
              {text.devModeHintPrefix} <code>/devmode</code> {text.devModeHintSuffix}
            </p>
          )}

          <div className="flex flex-wrap gap-3">
            <Button onClick={reset}>{text.retry}</Button>
            <Button asChild variant="outline">
              <Link href="/devmode">{text.openDevMode}</Link>
            </Button>
            <Button asChild variant="secondary">
              <Link href="/">{text.home}</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
