import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function Home() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 px-4 py-12">
      <Card className="w-full max-w-3xl border-foreground/10 bg-background/80">
        <CardHeader>
          <CardTitle className="text-3xl">FHIR Compose</CardTitle>
          <CardDescription>
            Start the client-side FHIR package importer and resolve dependencies entirely in the browser.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <p className="text-sm text-muted-foreground">
            The importer wizard guides you through downloading packages, uploading .tgz archives, and tracking
            dependency progress. Everything is stored locally in IndexedDB.
          </p>
          <Button asChild className="w-fit">
            <Link href="/importer">Open Importer Wizard</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
