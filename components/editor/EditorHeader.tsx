import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

type EditorHeaderProps = {
  datasetName: string;
  datasetId: string;
  projectKey?: string;
  onCreateResource: () => void;
};

export const EditorHeader = ({
  datasetName,
  datasetId,
  projectKey,
  onCreateResource,
}: EditorHeaderProps) => {
  return (
    <header className="border-b border-foreground/10 bg-background/90 px-6 py-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <Link href="/editor" className="text-sm font-medium text-foreground">
              Projects
            </Link>
            <span>/</span>
            <span className="text-sm">{datasetName}</span>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold text-foreground">{datasetName}</h1>
            <Badge variant="outline">{datasetId}</Badge>
            {projectKey ? <Badge variant="secondary">{projectKey}</Badge> : null}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button asChild variant="outline">
            <Link href="/editor">Back to projects</Link>
          </Button>
          <Button onClick={onCreateResource}>New resource</Button>
        </div>
      </div>
    </header>
  );
};
