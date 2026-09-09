"use client";

import { Button } from "@/components/ui/button";
import type { PackageSource } from "@/lib/fhir-importer/registry";
import type { useImportWizardText } from "@/components/importer/import-wizard/text";

/**
 * The registries one dependency can be taken from, offered as a choice.
 *
 * The automatic import picks a source and moves on. Someone working through
 * the tree by hand may have a reason to prefer another — a mirror they trust,
 * one their network can reach, or the host the package was actually published
 * to — so every registry that carries the version is listed. Registries whose
 * archives the browser may not read cannot be imported from, only opened, and
 * are labelled that way rather than offered and then failing.
 */

export type DependencySourceListProps = {
  text: ReturnType<typeof useImportWizardText>["text"];
  sources: PackageSource[] | undefined;
  /** Shown until the registries have answered, or when none carries it. */
  fallbackLink: string | null;
  isUploading: boolean;
  onImportFrom: (url: string) => void;
  onCopy: (link: string) => void;
};

export const DependencySourceList = ({
  text,
  sources,
  fallbackLink,
  isUploading,
  onImportFrom,
  onCopy,
}: DependencySourceListProps) => {
  if (!sources) {
    return (
      <p className="text-sm text-muted-foreground">
        {fallbackLink ? text.sourcesLoading : text.selectVersionForLink}
      </p>
    );
  }

  if (sources.length === 0) {
    return <p className="text-sm text-muted-foreground">{text.sourcesNone}</p>;
  }

  return (
    <div className="grid gap-2">
      <span className="text-sm font-medium text-foreground">{text.sourcesTitle}</span>
      {sources.map((source) => (
        <div
          key={source.url}
          className="flex flex-wrap items-center gap-2 rounded-lg border border-foreground/10 bg-background px-3 py-2"
        >
          <span className="text-sm font-medium text-foreground">{source.registry}</span>
          <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
            {source.url}
          </span>
          {source.fetchable ? (
            <Button size="sm" disabled={isUploading} onClick={() => onImportFrom(source.url)}>
              {text.sourceImportFrom}
            </Button>
          ) : (
            <span className="text-xs text-muted-foreground">{text.sourceDownloadOnly}</span>
          )}
          <Button asChild size="sm" variant="secondary">
            <a href={source.url} target="_blank" rel="noreferrer">
              {text.openLink}
            </a>
          </Button>
          <Button size="sm" variant="outline" onClick={() => onCopy(source.url)}>
            {text.copyLink}
          </Button>
        </div>
      ))}
    </div>
  );
};
