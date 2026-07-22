"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { PackageManifest } from "@/lib/fhir-importer/types";
import type { ProjectEditorText } from "@/components/project-editor/project-editor/text";

type Props = {
  text: ProjectEditorText;
  manifest: PackageManifest;
  onChange: (manifest: PackageManifest) => void;
  readOnly?: boolean;
};

export const ManifestEditor = ({ text, manifest, onChange, readOnly = false }: Props) => {
  const patch = (partial: Partial<PackageManifest>) => {
    if (readOnly) return;
    onChange({ ...manifest, ...partial });
  };

  const emptyToUndefined = (value: string) => (value.trim() ? value : undefined);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="border-b border-foreground/10 px-4 py-3">
        <div className="text-sm font-semibold text-foreground">{text.manifestTitle}</div>
        <div className="text-xs text-muted-foreground">{text.manifestDescription}</div>
      </div>
      <ScrollArea className="min-h-0 flex-1">
        <fieldset disabled={readOnly} className="mx-auto grid max-w-2xl gap-4 p-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label htmlFor="manifest-name">{text.nameLabel}</Label>
              <Input id="manifest-name" value={manifest.name} readOnly disabled />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="manifest-version">{text.versionLabel}</Label>
              <Input id="manifest-version" value={manifest.version} readOnly disabled />
            </div>
          </div>
          <p className="-mt-2 text-xs text-muted-foreground">{text.manifestNameReadonlyHint}</p>

          <div className="grid gap-2">
            <Label htmlFor="manifest-title">{text.titleLabel}</Label>
            <Input
              id="manifest-title"
              value={manifest.title ?? ""}
              onChange={(event) => patch({ title: emptyToUndefined(event.target.value) })}
              placeholder={text.titlePlaceholder}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="manifest-description">{text.descriptionLabel}</Label>
            <Input
              id="manifest-description"
              value={manifest.description ?? ""}
              onChange={(event) => patch({ description: emptyToUndefined(event.target.value) })}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label htmlFor="manifest-author">{text.authorLabel}</Label>
              <Input
                id="manifest-author"
                value={manifest.author ?? ""}
                onChange={(event) => patch({ author: emptyToUndefined(event.target.value) })}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="manifest-fhir-version">{text.fhirVersionLabel}</Label>
              <Input
                id="manifest-fhir-version"
                value={manifest.fhirVersions?.[0] ?? ""}
                onChange={(event) =>
                  patch({
                    fhirVersions: event.target.value.trim()
                      ? [event.target.value.trim()]
                      : undefined,
                  })
                }
              />
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="manifest-canonical">{text.canonicalLabel}</Label>
            <Input
              id="manifest-canonical"
              value={manifest.canonical ?? ""}
              onChange={(event) => patch({ canonical: emptyToUndefined(event.target.value) })}
              placeholder={text.canonicalPlaceholder}
            />
            <p className="text-xs text-muted-foreground">{text.canonicalHint}</p>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="manifest-jurisdiction">{text.jurisdictionLabel}</Label>
            <Input
              id="manifest-jurisdiction"
              value={manifest.jurisdiction ?? ""}
              onChange={(event) => patch({ jurisdiction: emptyToUndefined(event.target.value) })}
            />
          </div>
        </fieldset>
      </ScrollArea>
    </div>
  );
};
