"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
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
import { ScrollArea } from "@/components/ui/scroll-area";
import { AlertTriangle } from "lucide-react";
import { useI18n } from "@/components/i18n/I18nProvider";
import { byLocale } from "@/lib/i18n/select";
import { buildProjectKey } from "@/lib/projects/storage";
import type { PackageManifest, PackageRecord } from "@/lib/fhir-importer/types";
import { projectEditorText } from "@/components/project-editor/project-editor/text";
import { toast } from "sonner";

const CORE_ID = "hl7.fhir.r4.core";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  availablePackages: PackageRecord[];
  existingKeys: Set<string>;
  onCreate: (manifest: PackageManifest) => void;
  /** When set, prefill the form from this manifest (create-from / duplicate). */
  initialManifest?: PackageManifest | null;
  /** Duplicate mode: adjust title and suggest a "-copy" package name. */
  isDuplicate?: boolean;
};

export const NewProjectDialog = ({
  open,
  onOpenChange,
  availablePackages,
  existingKeys,
  onCreate,
  initialManifest = null,
  isDuplicate = false,
}: Props) => {
  const { locale } = useI18n();
  const t = byLocale(locale, projectEditorText);

  const [name, setName] = useState("");
  const [version, setVersion] = useState("0.1.0");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [author, setAuthor] = useState("");
  const [canonical, setCanonical] = useState("");
  const [fhirVersion, setFhirVersion] = useState("4.0.1");
  const [jurisdiction, setJurisdiction] = useState("");
  const [selectedDeps, setSelectedDeps] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!open) return;
    if (initialManifest) {
      setName(
        isDuplicate ? `${initialManifest.name}${t.copySuffix}` : initialManifest.name
      );
      setVersion(initialManifest.version);
      setTitle(initialManifest.title ?? "");
      setDescription(initialManifest.description ?? "");
      setAuthor(initialManifest.author ?? "");
      setCanonical(initialManifest.canonical ?? "");
      setFhirVersion(initialManifest.fhirVersions?.[0] ?? "4.0.1");
      setJurisdiction(initialManifest.jurisdiction ?? "");
      setSelectedDeps({ ...(initialManifest.dependencies ?? {}) });
      return;
    }
    setName("");
    setVersion("0.1.0");
    setTitle("");
    setDescription("");
    setAuthor("");
    setCanonical("");
    setFhirVersion("4.0.1");
    setJurisdiction("");
    // Pre-select the core package if present — it is required for authoring.
    const core = availablePackages.find((pkg) => pkg.id === CORE_ID);
    setSelectedDeps(core ? { [core.id]: core.version } : {});
  }, [open, availablePackages, initialManifest, isDuplicate, t.copySuffix]);

  const coreMissing = useMemo(
    () => !availablePackages.some((pkg) => pkg.id === CORE_ID),
    [availablePackages]
  );

  const toggleDep = (pkg: PackageRecord) => {
    setSelectedDeps((prev) => {
      const next = { ...prev };
      if (next[pkg.id]) {
        delete next[pkg.id];
      } else {
        next[pkg.id] = pkg.version;
      }
      return next;
    });
  };

  const handleCreate = () => {
    const trimmedName = name.trim();
    const trimmedVersion = version.trim();
    if (!trimmedName) {
      toast.error(t.nameRequired);
      return;
    }
    if (!trimmedVersion) {
      toast.error(t.versionRequired);
      return;
    }
    const key = buildProjectKey(trimmedName, trimmedVersion);
    if (existingKeys.has(key)) {
      toast.error(t.duplicateProject);
      return;
    }
    const dependencies = Object.keys(selectedDeps).length ? selectedDeps : undefined;
    const manifest: PackageManifest = {
      name: trimmedName,
      version: trimmedVersion,
      title: title.trim() || undefined,
      description: description.trim() || undefined,
      author: author.trim() || undefined,
      canonical: canonical.trim() || undefined,
      fhirVersions: fhirVersion.trim() ? [fhirVersion.trim()] : undefined,
      jurisdiction: jurisdiction.trim() || undefined,
      type: "IG",
      dependencies,
    };
    onCreate(manifest);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isDuplicate ? t.duplicateDialogTitle : t.dialogTitle}</DialogTitle>
          <DialogDescription>
            {isDuplicate ? t.duplicateDialogDescription : t.dialogDescription}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label htmlFor="project-name">{t.nameLabel}</Label>
              <Input
                id="project-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder={t.namePlaceholder}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="project-version">{t.versionLabel}</Label>
              <Input
                id="project-version"
                value={version}
                onChange={(event) => setVersion(event.target.value)}
                placeholder={t.versionPlaceholder}
              />
            </div>
          </div>
          <p className="-mt-2 text-xs text-muted-foreground">{t.nameHint}</p>

          <div className="grid gap-2">
            <Label htmlFor="project-title">{t.titleLabel}</Label>
            <Input
              id="project-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder={t.titlePlaceholder}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="project-description">{t.descriptionLabel}</Label>
            <Input
              id="project-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label htmlFor="project-author">{t.authorLabel}</Label>
              <Input
                id="project-author"
                value={author}
                onChange={(event) => setAuthor(event.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="project-fhir-version">{t.fhirVersionLabel}</Label>
              <Input
                id="project-fhir-version"
                value={fhirVersion}
                onChange={(event) => setFhirVersion(event.target.value)}
              />
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="project-canonical">{t.canonicalLabel}</Label>
            <Input
              id="project-canonical"
              value={canonical}
              onChange={(event) => setCanonical(event.target.value)}
              placeholder={t.canonicalPlaceholder}
            />
            <p className="text-xs text-muted-foreground">{t.canonicalHint}</p>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="project-jurisdiction">{t.jurisdictionLabel}</Label>
            <Input
              id="project-jurisdiction"
              value={jurisdiction}
              onChange={(event) => setJurisdiction(event.target.value)}
            />
          </div>

          <div className="grid gap-2">
            <Label>{t.dependenciesLabel}</Label>
            <p className="text-xs text-muted-foreground">{t.dependenciesHint}</p>
            {coreMissing ? (
              <div className="flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-400">
                <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                <div className="grid gap-1">
                  <span>{t.coreMissingWarning}</span>
                  <Button asChild size="sm" variant="outline" className="w-fit">
                    <Link href="/importer">{t.goToImporter}</Link>
                  </Button>
                </div>
              </div>
            ) : null}
            {availablePackages.length === 0 ? (
              <p className="text-xs text-muted-foreground">{t.noPackagesImported}</p>
            ) : (
              <ScrollArea className="max-h-40 rounded-md border border-foreground/15">
                <div className="grid gap-1 p-2">
                  {availablePackages.map((pkg) => (
                    <label
                      key={pkg.key}
                      className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-sm hover:bg-muted/50"
                    >
                      <input
                        type="checkbox"
                        checked={Boolean(selectedDeps[pkg.id])}
                        onChange={() => toggleDep(pkg)}
                      />
                      <span className="font-mono text-xs">{pkg.key}</span>
                    </label>
                  ))}
                </div>
              </ScrollArea>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t.cancel}
          </Button>
          <Button onClick={handleCreate}>{isDuplicate ? t.duplicate : t.create}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
