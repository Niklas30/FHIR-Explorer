import { useEffect, useMemo, useState } from "react";
import { useI18n } from "@/components/i18n/I18nProvider";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import type { DatasetResource } from "@/lib/datasets/content";
import { byLocale } from "@/lib/i18n/select";
import type { FhirRegistry } from "@/lib/fhir-editor/registry";
import type { FieldDefinition } from "@/lib/fhir-editor/profiles";
import { buildDatasetReferenceIndex } from "@/lib/fhir-editor/references";
import { validateResourceWithProfile } from "@/lib/fhir-editor/validation";

type ResourceJsonPanelProps = {
  resource: DatasetResource | null;
  datasetResources: DatasetResource[];
  fields: FieldDefinition[];
  registry: FhirRegistry | null;
  onUpdateResource: (resource: DatasetResource) => void;
};

export const ResourceJsonPanel = ({
  resource,
  datasetResources,
  fields,
  registry,
  onUpdateResource,
}: ResourceJsonPanelProps) => {
  const { locale } = useI18n();
  const [draft, setDraft] = useState("");
  const enText = {
    jsonMustBeObject: "JSON must be an object.",
    invalidJson: "Invalid JSON.",
    title: "Resource JSON",
    subtitle: "Edit JSON and sync with the form",
    apply: "Apply",
    validation: "Validation",
    jsonParsingError: "JSON parsing error",
    noValidationIssues: "No validation issues found.",
    emptyState: "Select a resource to inspect the JSON payload.",
    issueSummary: "{errors} error{errorsSuffix}, {warnings} warning{warningsSuffix}",
    errorsSuffix: "s",
    warningsSuffix: "s",
  };
  const text = byLocale(locale, {
    de: {
      jsonMustBeObject: "JSON muss ein Objekt sein.",
      invalidJson: "Ungültiges JSON.",
      title: "Ressourcen-JSON",
      subtitle: "JSON bearbeiten und mit dem Formular synchronisieren",
      apply: "Übernehmen",
      validation: "Validierung",
      jsonParsingError: "JSON-Parsing-Fehler",
      noValidationIssues: "Keine Validierungsprobleme gefunden.",
      emptyState: "Wähle eine Ressource aus, um den JSON-Inhalt zu prüfen.",
      issueSummary: "{errors} Fehler, {warnings} Warnung{warningsSuffix}",
      errorsSuffix: "",
      warningsSuffix: "en",
    },
    en: enText,
    fr: {
      ...enText,
      title: "JSON de la ressource",
      subtitle: "Modifier le JSON et synchroniser avec le formulaire",
      apply: "Appliquer",
      validation: "Validation",
      jsonParsingError: "Erreur d'analyse JSON",
      noValidationIssues: "Aucun problème de validation trouvé.",
      emptyState: "Sélectionnez une ressource pour inspecter le JSON.",
    },
    es: {
      ...enText,
      title: "JSON del recurso",
      subtitle: "Editar JSON y sincronizar con el formulario",
      apply: "Aplicar",
      validation: "Validación",
      jsonParsingError: "Error de análisis JSON",
      noValidationIssues: "No se encontraron problemas de validación.",
      emptyState: "Selecciona un recurso para inspeccionar el JSON.",
    },
    it: {
      ...enText,
      title: "JSON della risorsa",
      subtitle: "Modifica il JSON e sincronizza con il modulo",
      apply: "Applica",
      validation: "Validazione",
      jsonParsingError: "Errore di parsing JSON",
      noValidationIssues: "Nessun problema di validazione trovato.",
      emptyState: "Seleziona una risorsa per ispezionare il JSON.",
    },
  });

  const format = (template: string, values: Record<string, string | number>) =>
    template.replace(/\{(\w+)\}/g, (_, key) => String(values[key] ?? ""));

  useEffect(() => {
    if (!resource) {
      setDraft("");
      return;
    }
    setDraft(JSON.stringify(resource.content, null, 2));
  }, [resource]);

  const parsedDraft = useMemo(() => {
    if (!resource) {
      return { value: null as Record<string, unknown> | null, error: null as string | null };
    }

    try {
      const parsed = JSON.parse(draft);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        return {
          value: null as Record<string, unknown> | null,
          error: text.jsonMustBeObject,
        };
      }
      return {
        value: parsed as Record<string, unknown>,
        error: null as string | null,
      };
    } catch (err) {
      return {
        value: null as Record<string, unknown> | null,
        error: err instanceof Error ? err.message : text.invalidJson,
      };
    }
  }, [draft, resource, text.invalidJson, text.jsonMustBeObject]);

  const existingReferences = useMemo(
    () => buildDatasetReferenceIndex(datasetResources),
    [datasetResources]
  );

  const validationIssues = useMemo(() => {
    if (!resource || !parsedDraft.value) return [];
    return validateResourceWithProfile(parsedDraft.value, fields, registry ?? undefined, {
      existingReferences,
      locale,
    });
  }, [existingReferences, fields, locale, parsedDraft.value, registry, resource]);

  const errorCount = validationIssues.filter((issue) => issue.severity === "error").length;
  const warningCount = validationIssues.filter((issue) => issue.severity === "warning").length;

  const applyDraft = () => {
    if (!resource) return;
    if (!parsedDraft.value) return;
    onUpdateResource({
      ...resource,
      content: parsedDraft.value,
      updatedAt: Date.now(),
    });
  };

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-foreground/10 px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="text-sm font-semibold text-foreground">{text.title}</div>
            <div className="text-xs text-muted-foreground">
              {text.subtitle}
            </div>
          </div>
          <Button size="sm" variant="outline" onClick={applyDraft} disabled={!resource}>
            {text.apply}
          </Button>
        </div>
      </div>
      <div className="flex-1 min-h-0">
        {resource ? (
          <ResizablePanelGroup orientation="vertical" className="h-full min-h-0">
            <ResizablePanel id="resource-json-source" defaultSize={70} minSize={30} className="min-h-0">
              <div className="flex h-full min-h-0 flex-col gap-2 p-3">
                <textarea
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  onBlur={applyDraft}
                  className={[
                    "h-full min-h-0 w-full flex-1 resize-none rounded-lg border bg-slate-950/95 p-4 text-xs text-slate-100 focus-visible:outline-none focus-visible:ring-2",
                    parsedDraft.error
                      ? "border-destructive/60 focus-visible:ring-destructive/40"
                      : "border-foreground/10 focus-visible:ring-foreground/30",
                  ].join(" ")}
                  spellCheck={false}
                />
                {parsedDraft.error ? (
                  <div className="text-xs text-destructive">{parsedDraft.error}</div>
                ) : null}
              </div>
            </ResizablePanel>
            <ResizableHandle
              withHandle
              className="h-px w-full after:left-0 after:top-1/2 after:inset-y-auto after:h-1 after:w-full after:translate-x-0 after:-translate-y-1/2 [&>div]:rotate-90"
            />
            <ResizablePanel
              id="resource-json-validation"
              defaultSize={30}
              minSize={15}
              className="min-h-0"
            >
              <div className="flex h-full min-h-0 flex-col">
                <div className="border-b border-foreground/10 px-4 py-3">
                  <div className="text-sm font-semibold text-foreground">
                    {text.validation}
                  </div>
                  {parsedDraft.error ? (
                    <div className="mt-1 text-xs text-destructive">{text.jsonParsingError}</div>
                  ) : (
                    <div className="mt-1 text-xs text-muted-foreground">
                      {format(text.issueSummary, {
                        errors: errorCount,
                        warnings: warningCount,
                        errorsSuffix:
                          locale === "en" && errorCount === 1 ? "" : text.errorsSuffix ?? "",
                        warningsSuffix:
                          locale === "en" && warningCount === 1
                            ? ""
                            : text.warningsSuffix ?? "",
                      })}
                    </div>
                  )}
                </div>
                <ScrollArea className="flex-1 min-h-0">
                  <div className="grid gap-2 p-4">
                    {parsedDraft.error ? (
                      <div className="rounded-md border border-destructive/30 bg-destructive/5 px-2 py-2 text-xs text-destructive">
                        {parsedDraft.error}
                      </div>
                    ) : validationIssues.length === 0 ? (
                      <div className="rounded-md border border-emerald-500/20 bg-emerald-500/5 px-2 py-2 text-xs text-emerald-700">
                        {text.noValidationIssues}
                      </div>
                    ) : (
                      validationIssues.map((issue, index) => (
                        <div
                          key={`${issue.code}-${issue.path}-${index}`}
                          className={[
                            "rounded-md border px-2 py-2 text-xs",
                            issue.severity === "error"
                              ? "border-destructive/30 bg-destructive/5 text-destructive"
                              : "border-amber-500/30 bg-amber-500/5 text-amber-700",
                          ].join(" ")}
                        >
                          <div className="font-semibold">{issue.path}</div>
                          <div className="mt-0.5">{issue.message}</div>
                        </div>
                      ))
                    )}
                  </div>
                </ScrollArea>
              </div>
            </ResizablePanel>
          </ResizablePanelGroup>
        ) : (
          <div className="flex h-full items-center justify-center rounded-lg border border-dashed border-foreground/15 px-3 py-6 text-center text-sm text-muted-foreground">
            {text.emptyState}
          </div>
        )}
      </div>
    </div>
  );
};
