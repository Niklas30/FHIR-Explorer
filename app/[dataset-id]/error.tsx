"use client";

import Link from "next/link";
import { useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { isDevModeEnabled } from "@/lib/dev-mode";

export default function DatasetEditorError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const showDetails = isDevModeEnabled();

  useEffect(() => {
    console.error(error);
  }, [error]);

  const errorDetails = useMemo(() => {
    const lines = [`message: ${error.message || "(no message)"}`];
    if (error.digest) {
      lines.push(`digest: ${error.digest}`);
    }
    if (error.stack) {
      lines.push("");
      lines.push(error.stack);
    }
    return lines.join("\n");
  }, [error]);

  return (
    <main className="mx-auto flex min-h-[100dvh] w-full max-w-3xl items-center px-4 py-10">
      <Card className="w-full border-foreground/10">
        <CardHeader>
          <CardTitle className="text-2xl">Editor-Fehler</CardTitle>
          <CardDescription>
            Beim Laden oder Rendern des Editors ist ein Fehler aufgetreten.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {showDetails ? (
            <pre className="max-h-[45dvh] overflow-auto rounded-md border border-foreground/10 bg-muted/30 p-3 text-xs whitespace-pre-wrap">
              {errorDetails}
            </pre>
          ) : (
            <p className="text-sm text-muted-foreground">
              Für technische Details kann Dev Mode über <code>/devmode</code> aktiviert werden.
            </p>
          )}

          <div className="flex flex-wrap gap-3">
            <Button onClick={reset}>Erneut versuchen</Button>
            <Button asChild variant="outline">
              <Link href="/devmode">Dev Mode öffnen</Link>
            </Button>
            <Button asChild variant="secondary">
              <Link href="/">Zur Startseite</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
