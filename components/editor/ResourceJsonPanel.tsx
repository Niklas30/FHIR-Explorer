import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import type { DatasetResource } from "@/lib/datasets/content";

type ResourceJsonPanelProps = {
  resource: DatasetResource | null;
  onUpdateResource: (resource: DatasetResource) => void;
};

export const ResourceJsonPanel = ({
  resource,
  onUpdateResource,
}: ResourceJsonPanelProps) => {
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!resource) {
      setDraft("");
      setError(null);
      return;
    }
    setDraft(JSON.stringify(resource.content, null, 2));
    setError(null);
  }, [resource]);

  const validateDraft = (nextDraft: string) => {
    try {
      const parsed = JSON.parse(nextDraft);
      if (!parsed || typeof parsed !== "object") {
        setError("JSON must be an object.");
        return false;
      }
      setError(null);
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid JSON.");
      return false;
    }
  };

  const applyDraft = () => {
    if (!resource) return;
    if (!validateDraft(draft)) return;
    const parsed = JSON.parse(draft);
    onUpdateResource({
      ...resource,
      content: parsed as Record<string, unknown>,
      updatedAt: Date.now(),
    });
  };

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-foreground/10 px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="text-sm font-semibold text-foreground">Resource JSON</div>
            <div className="text-xs text-muted-foreground">
              Edit JSON and sync with the form
            </div>
          </div>
          <Button size="sm" variant="outline" onClick={applyDraft} disabled={!resource}>
            Apply
          </Button>
        </div>
      </div>
      <div className="flex-1 min-h-0 p-3">
        {resource ? (
          <div className="flex h-full flex-col gap-2">
            <textarea
              value={draft}
              onChange={(event) => {
                const nextDraft = event.target.value;
                setDraft(nextDraft);
                validateDraft(nextDraft);
              }}
              onBlur={applyDraft}
              className={[
                "h-full min-h-0 w-full flex-1 resize-none rounded-lg border bg-slate-950/95 p-4 text-xs text-slate-100 focus-visible:outline-none focus-visible:ring-2",
                error
                  ? "border-destructive/60 focus-visible:ring-destructive/40"
                  : "border-foreground/10 focus-visible:ring-foreground/30",
              ].join(" ")}
              spellCheck={false}
            />
            {error ? (
              <div className="text-xs text-destructive">{error}</div>
            ) : null}
          </div>
        ) : (
          <div className="flex h-full items-center justify-center rounded-lg border border-dashed border-foreground/15 px-3 py-6 text-center text-sm text-muted-foreground">
            Select a resource to inspect the JSON payload.
          </div>
        )}
      </div>
    </div>
  );
};
