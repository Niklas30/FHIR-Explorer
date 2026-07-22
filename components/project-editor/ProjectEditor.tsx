"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { useI18n } from "@/components/i18n/I18nProvider";
import { byLocale } from "@/lib/i18n/select";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useImporter } from "@/components/importer/useImporter";
import { buildDependencyGraph } from "@/lib/fhir-importer/dependency-graph";
import type { PackageManifest, PackageRecord } from "@/lib/fhir-importer/types";
import type { DatasetRecord } from "@/lib/datasets/storage";
import { loadDatasets } from "@/lib/datasets/storage";
import { loadProjects } from "@/lib/projects/storage";
import type { AuthoredResource } from "@/lib/projects/types";
import { projectEditorText } from "@/components/project-editor/project-editor/text";
import { useProjectState } from "@/components/project-editor/project-editor/useProjectState";
import { useImportedProject } from "@/components/project-editor/project-editor/useImportedProject";
import { exportAuthoredProject } from "@/components/project-editor/project-editor/exportProject";
import { duplicateProject } from "@/components/project-editor/project-editor/duplicateProject";
import { ProjectWorkspace } from "@/components/project-editor/ProjectWorkspace";
import { NewProjectDialog } from "@/components/overview/dialogs/NewProjectDialog";

const EMPTY_PACKAGES: PackageRecord[] = [];
const NOOP = () => {};

type ProjectEditorProps = {
  projectKey: string;
};

export const ProjectEditor = ({ projectKey }: ProjectEditorProps) => {
  const router = useRouter();
  const { locale } = useI18n();
  const t = byLocale(locale, projectEditorText);
  const { snapshot, getResourcePayloadsByPackageKeys } = useImporter();
  const packages = snapshot?.packages ?? EMPTY_PACKAGES;
  const graph = useMemo(() => buildDependencyGraph(packages), [packages]);

  const authored = useProjectState(projectKey);

  // Only load the imported package once we know no authored project matches.
  const importedPackage = useMemo(() => {
    if (!authored.loaded || authored.project) return null;
    return packages.find((pkg) => pkg.key === projectKey) ?? null;
  }, [authored.loaded, authored.project, packages, projectKey]);

  const imported = useImportedProject({
    packageRecord: importedPackage,
    getResourcePayloadsByPackageKeys,
  });

  const isAuthored = Boolean(authored.project);
  const readOnly = !isAuthored && Boolean(importedPackage);
  const record = authored.project ?? imported.record;
  const resources = isAuthored ? authored.resources : imported.resources;

  const [datasets, setDatasets] = useState<DatasetRecord[]>([]);
  useEffect(() => {
    setDatasets(loadDatasets().filter((entry) => entry.projectKey === projectKey));
  }, [projectKey]);

  const [duplicateOpen, setDuplicateOpen] = useState(false);
  // Recomputed whenever the duplicate dialog opens so the name-collision check
  // reflects the current set of authored projects.
  const existingKeys = useMemo(() => {
    if (!duplicateOpen) return new Set<string>();
    return new Set(loadProjects().map((project) => project.key));
  }, [duplicateOpen]);

  const handleExport = async () => {
    if (!record) return;
    await exportAuthoredProject({
      project: record,
      resources,
      datasets,
      graph,
      getResourcePayloadsByPackageKeys,
    });
    toast.success(t.projectExported);
  };

  const handleConfirmDuplicate = async (manifest: PackageManifest) => {
    const key = await duplicateProject({ manifest, sourceResources: resources });
    setDuplicateOpen(false);
    toast.success(t.duplicated);
    router.push(`/project/${encodeURIComponent(key)}`);
  };

  const loading = !authored.loaded || (readOnly && !imported.loaded);

  if (loading) {
    return (
      <div className="flex h-[100dvh] items-center justify-center bg-muted/20 text-sm text-muted-foreground">
        <Loader2 className="mr-2 size-4 animate-spin" />
        {t.saving}
      </div>
    );
  }

  if (!record) {
    return (
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-10">
        <Card className="border-foreground/10">
          <CardHeader>
            <CardTitle className="text-2xl">{t.projectNotFoundTitle}</CardTitle>
            <CardDescription>{t.projectNotFoundDescription}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="secondary">
              <Link href="/">{t.backToOverview}</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <>
      <ProjectWorkspace
        record={record}
        resources={resources}
        readOnly={readOnly}
        packages={packages}
        graph={graph}
        getResourcePayloadsByPackageKeys={getResourcePayloadsByPackageKeys}
        datasets={datasets}
        savedAt={isAuthored ? authored.savedAt : null}
        onUpdateManifest={isAuthored ? authored.updateManifest : NOOP}
        onAddResource={isAuthored ? authored.addResource : (NOOP as (r: AuthoredResource) => void)}
        onUpdateResource={
          isAuthored ? authored.updateResource : (NOOP as (r: AuthoredResource) => void)
        }
        onRemoveResource={isAuthored ? authored.removeResource : NOOP}
        onExport={() => void handleExport()}
        onDuplicate={() => setDuplicateOpen(true)}
      />

      <NewProjectDialog
        open={duplicateOpen}
        onOpenChange={setDuplicateOpen}
        availablePackages={packages}
        existingKeys={existingKeys}
        initialManifest={record.manifest}
        isDuplicate
        onCreate={(manifest) => void handleConfirmDuplicate(manifest)}
      />
    </>
  );
};
