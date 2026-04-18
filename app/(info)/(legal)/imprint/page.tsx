import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function ImprintPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 px-4 py-12">
      <Card className="w-full max-w-3xl border-foreground/10 bg-background/80">
        <CardHeader>
          <CardTitle className="text-3xl">Imprint</CardTitle>
          <CardDescription>Legal disclosure for FHIR Compose.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <p className="text-sm text-muted-foreground">
            This is a placeholder imprint page. Replace the content with your company name, address, and
            contact details required by your jurisdiction.
          </p>
          <Button asChild className="w-fit" variant="outline">
            <Link href="/">Back to Home</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
