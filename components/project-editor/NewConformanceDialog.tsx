"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useI18n } from "@/components/i18n/I18nProvider";
import { byLocale } from "@/lib/i18n/select";
import { createAuthoredResource } from "@/lib/projects/content";
import type { AuthoredResource, AuthoredResourceKind } from "@/lib/projects/types";
import type { ProfileSummary } from "@/lib/fhir-editor/profiles";
import { projectEditorText } from "@/components/project-editor/project-editor/text";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  presetKind: AuthoredResourceKind;
  canonicalBase?: string;
  profiles: ProfileSummary[];
  onCreate: (resource: AuthoredResource) => void;
};

export const NewConformanceDialog = ({
  open,
  onOpenChange,
  presetKind,
  canonicalBase,
  profiles,
  onCreate,
}: Props) => {
  const { locale } = useI18n();
  const t = byLocale(locale, projectEditorText);

  const [kind, setKind] = useState<AuthoredResourceKind>(presetKind);
  const [name, setName] = useState("");
  const [exampleType, setExampleType] = useState("");
  const [exampleProfile, setExampleProfile] = useState("");

  useEffect(() => {
    if (!open) return;
    setKind(presetKind);
    setName("");
    setExampleType("");
    setExampleProfile("");
  }, [open, presetKind]);

  const kindOptions: Array<{ value: AuthoredResourceKind; label: string }> = [
    { value: "profile", label: t.kindProfile },
    { value: "extension", label: t.kindExtension },
    { value: "valueset", label: t.kindValueSet },
    { value: "codesystem", label: t.kindCodeSystem },
    { value: "example", label: t.kindExample },
  ];

  const handleCreate = () => {
    const isExample = kind === "example";
    const resource = createAuthoredResource({
      kind,
      name: isExample ? name.trim() || "example" : name.trim() || "Unnamed",
      canonicalBase,
      exampleResourceType: isExample ? exampleType.trim() || "Basic" : undefined,
      exampleProfile: isExample && exampleProfile ? exampleProfile : undefined,
      now: Date.now(),
    });
    onCreate(resource);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t.newConformanceTitle}</DialogTitle>
          <DialogDescription>{t.newConformanceDescription}</DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="conformance-kind">{t.kindLabel}</Label>
            <select
              id="conformance-kind"
              value={kind}
              onChange={(event) => setKind(event.target.value as AuthoredResourceKind)}
              className="h-9 rounded-md border border-foreground/20 bg-background px-3 text-sm"
            >
              {kindOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          {kind === "example" ? (
            <>
              <div className="grid gap-2">
                <Label htmlFor="example-type">{t.exampleTypeLabel}</Label>
                <Input
                  id="example-type"
                  value={exampleType}
                  onChange={(event) => setExampleType(event.target.value)}
                  placeholder={t.exampleTypePlaceholder}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="example-profile">{t.exampleProfileLabel}</Label>
                <select
                  id="example-profile"
                  value={exampleProfile}
                  onChange={(event) => setExampleProfile(event.target.value)}
                  className="h-9 rounded-md border border-foreground/20 bg-background px-3 text-sm"
                >
                  <option value="">—</option>
                  {profiles.map((profile) => (
                    <option key={profile.url} value={profile.url}>
                      {profile.title ?? profile.name ?? profile.url}
                    </option>
                  ))}
                </select>
              </div>
            </>
          ) : (
            <div className="grid gap-2">
              <Label htmlFor="conformance-name">{t.resourceNameLabel}</Label>
              <Input
                id="conformance-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder={t.resourceNamePlaceholder}
              />
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t.cancel}
          </Button>
          <Button onClick={handleCreate}>{t.createBlock}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
