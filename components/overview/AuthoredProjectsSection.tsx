"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { FolderPlus, MoreHorizontal, Boxes, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useI18n } from "@/components/i18n/I18nProvider";
import { byLocale } from "@/lib/i18n/select";
import { formatTimestamp } from "@/components/overview/utils";
import { projectEditorText } from "@/components/project-editor/project-editor/text";
import { NewProjectDialog } from "@/components/overview/dialogs/NewProjectDialog";
import {
  createProjectRecord,
  loadProjects,
  removeProject,
  upsertProject,
} from "@/lib/projects/storage";
import {
  clearProjectResources,
  loadProjectResources,
  saveProjectResources,
} from "@/lib/projects/content";
import { duplicateProject } from "@/components/project-editor/project-editor/duplicateProject";
import type { AuthoredProjectRecord, AuthoredResource } from "@/lib/projects/types";
import type { PackageManifest, PackageRecord } from "@/lib/fhir-importer/types";

type Props = {
  availablePackages: PackageRecord[];
};

export const AuthoredProjectsSection = ({ availablePackages }: Props) => {
  const { locale } = useI18n();
  const t = byLocale(locale, projectEditorText);
  const router = useRouter();

  const [projects, setProjects] = useState<AuthoredProjectRecord[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [duplicateSource, setDuplicateSource] = useState<{
    manifest: PackageManifest;
    resources: AuthoredResource[];
  } | null>(null);

  useEffect(() => {
    setProjects(loadProjects());
  }, []);

  const existingKeys = useMemo(
    () => new Set(projects.map((project) => project.key)),
    [projects]
  );

  const formatCount = (template: string, count: number) =>
    template.replace("{count}", String(count));

  const handleCreate = (manifest: PackageManifest) => {
    const record = createProjectRecord(manifest, Date.now());
    setProjects(upsertProject(record));
    // Initialise an empty resource bucket so the editor loads instantly.
    void saveProjectResources(record.key, []);
    setDialogOpen(false);
    router.push(`/project/${encodeURIComponent(record.key)}`);
  };

  const handleDelete = (project: AuthoredProjectRecord) => {
    const ok = window.confirm(t.deleteProjectConfirm);
    if (!ok) return;
    setProjects(removeProject(project.key));
    void clearProjectResources(project.key);
    toast.success(t.projectDeleted);
  };

  const handleOpenDuplicate = async (project: AuthoredProjectRecord) => {
    const resources = await loadProjectResources(project.key);
    setDuplicateSource({ manifest: project.manifest, resources });
  };

  const handleConfirmDuplicate = async (manifest: PackageManifest) => {
    if (!duplicateSource) return;
    const key = await duplicateProject({
      manifest,
      sourceResources: duplicateSource.resources,
    });
    setProjects(loadProjects());
    setDuplicateSource(null);
    toast.success(t.duplicated);
    router.push(`/project/${encodeURIComponent(key)}`);
  };

  return (
    <section className="grid gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold text-foreground">
            <Boxes className="size-5" />
            {t.sectionTitle}
          </h2>
          <p className="text-sm text-muted-foreground">{t.sectionDescription}</p>
        </div>
        <Button size="sm" onClick={() => setDialogOpen(true)}>
          <FolderPlus className="size-4" />
          {t.newProject}
        </Button>
      </div>

      {projects.length === 0 ? (
        <p className="rounded-lg border border-dashed border-foreground/15 p-4 text-sm text-muted-foreground">
          {t.noProjectsYet}
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => {
            const title = project.manifest.title ?? project.manifest.name ?? project.id;
            const depCount = Object.keys(project.manifest.dependencies ?? {}).length;
            const href = `/project/${encodeURIComponent(project.key)}`;
            return (
              <Card key={project.key} className="border-foreground/10">
                <CardHeader>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="truncate text-base font-semibold text-foreground" title={title}>
                          {title}
                        </h3>
                        <Badge variant="secondary" className="shrink-0">
                          {t.authoredBadge}
                        </Badge>
                      </div>
                      <p className="truncate font-mono text-xs text-muted-foreground" title={project.key}>
                        {project.key}
                      </p>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button size="icon-sm" variant="ghost" aria-label={t.deleteProject}>
                          <MoreHorizontal className="size-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => void handleOpenDuplicate(project)}>
                          <Copy className="mr-2 size-4" />
                          {t.duplicate}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          variant="destructive"
                          onClick={() => handleDelete(project)}
                        >
                          {t.deleteProject}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </CardHeader>
                <CardContent className="grid gap-3">
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    <span>{formatCount(t.resourcesCount, depCount)}</span>
                    <span>
                      {t.updatedPrefix} {formatTimestamp(project.updatedAt)}
                    </span>
                  </div>
                  <Button asChild size="sm" variant="secondary" className="w-fit">
                    <Link href={href}>{t.open}</Link>
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <NewProjectDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        availablePackages={availablePackages}
        existingKeys={existingKeys}
        onCreate={handleCreate}
      />

      <NewProjectDialog
        open={Boolean(duplicateSource)}
        onOpenChange={(open) => {
          if (!open) setDuplicateSource(null);
        }}
        availablePackages={availablePackages}
        existingKeys={existingKeys}
        initialManifest={duplicateSource?.manifest ?? null}
        isDuplicate
        onCreate={(manifest) => void handleConfirmDuplicate(manifest)}
      />
    </section>
  );
};
