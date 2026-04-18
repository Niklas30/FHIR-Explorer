import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default async function DatasetEditorPlaceholder({
  params,
}: {
  params: Promise<{ "dataset-id": string }>;
}) {
  const resolvedParams = await params;
  const datasetId = resolvedParams["dataset-id"];

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-10">
      <Card className="border-foreground/10">
        <CardHeader>
          <CardTitle className="text-2xl">Dataset Editor</CardTitle>
          <CardDescription>
            Dataset editing is not available yet. This page will be upgraded in a future
            release.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="rounded-lg border border-foreground/10 bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
            Dataset id: {datasetId}
          </div>
          <Button asChild className="w-fit" variant="secondary">
            <Link href="/editor">Back to Projects Overview</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
