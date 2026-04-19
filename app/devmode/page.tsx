"use client";

import Link from "next/link";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { setDevModeEnabled } from "@/lib/dev-mode";

export default function DevModePage() {
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
          <CardTitle className="text-2xl">Dev Mode</CardTitle>
          <CardDescription>
            Beim Aufruf von <code>/devmode</code> wird der Modus automatisch aktiviert.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">Dev Mode wurde beim Öffnen dieser Seite aktiviert.</p>

          <div className="flex flex-wrap gap-3">
            <Button onClick={handleEnable}>Dev Mode aktivieren</Button>
            <Button variant="outline" onClick={handleDisable}>
              Dev Mode deaktivieren
            </Button>
            <Button asChild variant="secondary">
              <Link href="/">Zur Startseite</Link>
            </Button>
          </div>

          <p className="text-sm text-muted-foreground">
            Wenn ein Editor-Fehler auftritt, zeigt die Fehlerseite im aktiven Dev Mode zusätzliche Details (z. B.
            Message, Digest, Stacktrace) auch im Produktionsbetrieb.
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
