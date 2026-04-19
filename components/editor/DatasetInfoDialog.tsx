import { useEffect, useMemo, useState } from "react";
import { useI18n } from "@/components/i18n/I18nProvider";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { byLocale } from "@/lib/i18n/select";
import type { DatasetRecord } from "@/lib/datasets/storage";
import { toast } from "sonner";

export type DatasetProjectSuggestion = {
  key: string;
  label: string;
};

type DatasetInfoDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dataset: DatasetRecord | null;
  projectSuggestions: DatasetProjectSuggestion[];
  onOpenDependencyTree: (projectKey: string) => void;
  onSave: (next: { id: string; name: string; projectKey: string }) => void;
};

export const DatasetInfoDialog = ({
  open,
  onOpenChange,
  dataset,
  projectSuggestions,
  onOpenDependencyTree,
  onSave,
}: DatasetInfoDialogProps) => {
  const { locale } = useI18n();
  const [datasetNameDraft, setDatasetNameDraft] = useState("");
  const [datasetProjectKeyDraft, setDatasetProjectKeyDraft] = useState("");

  const enText = {
    datasetNameRequired: "Dataset name is required.",
    projectKeyRequired: "Project key is required.",
    datasetInfoUpdated: "Dataset info updated.",
    datasetInfoTitle: "Dataset Info",
    datasetInfoDescription: "Review and edit metadata for this dataset.",
    datasetNameLabel: "Name",
    datasetNamePlaceholder: "Dataset name",
    projectKeyLabel: "Project key",
    noProjectsAvailable: "No imported projects available",
    customProjectKey: "Custom project key…",
    projectKeyPlaceholder: "package-id@version",
    projectKeyHint: "Select an imported project or enter a custom project key.",
    showDependencyTree: "Show dependency tree",
    datasetIdLabel: "Dataset ID",
    datasetIdReadonlyHint: "Dataset ID is read-only because it is used as the storage key.",
    createdPrefix: "Created:",
    cancel: "Cancel",
    save: "Save",
  };

  const text = byLocale(locale, {
    de: {
      datasetNameRequired: "Dataset-Name ist erforderlich.",
      projectKeyRequired: "Projekt-Key ist erforderlich.",
      datasetInfoUpdated: "Dataset-Info wurde aktualisiert.",
      datasetInfoTitle: "Dataset-Info",
      datasetInfoDescription: "Metadaten dieses Datasets anzeigen und bearbeiten.",
      datasetNameLabel: "Name",
      datasetNamePlaceholder: "Dataset-Name",
      projectKeyLabel: "Projekt-Key",
      noProjectsAvailable: "Keine importierten Projekte verfügbar",
      customProjectKey: "Eigener Projekt-Key…",
      projectKeyPlaceholder: "package-id@version",
      projectKeyHint: "Wähle ein importiertes Projekt oder gib einen eigenen Projekt-Key ein.",
      showDependencyTree: "Abhängigkeitsbaum anzeigen",
      datasetIdLabel: "Dataset-ID",
      datasetIdReadonlyHint: "Die Dataset-ID ist schreibgeschützt, da sie als Storage-Key verwendet wird.",
      createdPrefix: "Erstellt:",
      cancel: "Abbrechen",
      save: "Speichern",
    },
    en: enText,
    fr: {
      ...enText,
      datasetNameRequired: "Le nom du dataset est requis.",
      projectKeyRequired: "La cle de projet est requise.",
      datasetInfoUpdated: "Infos du dataset mises a jour.",
      datasetInfoTitle: "Infos du dataset",
      datasetInfoDescription: "Consultez et modifiez les metadonnees de ce dataset.",
      datasetNameLabel: "Nom",
      projectKeyLabel: "Cle projet",
      noProjectsAvailable: "Aucun projet importe disponible",
      customProjectKey: "Cle projet personnalisee…",
      projectKeyHint: "Selectionnez un projet importe ou saisissez une cle projet personnalisee.",
      showDependencyTree: "Afficher l'arbre des dependances",
      datasetIdLabel: "ID du dataset",
      datasetIdReadonlyHint: "L'ID du dataset est en lecture seule car il sert de cle de stockage.",
      createdPrefix: "Cree le :",
      cancel: "Annuler",
      save: "Enregistrer",
    },
    es: {
      ...enText,
      datasetNameRequired: "Se requiere el nombre del dataset.",
      projectKeyRequired: "Se requiere la clave de proyecto.",
      datasetInfoUpdated: "Informacion del dataset actualizada.",
      datasetInfoTitle: "Informacion del dataset",
      datasetInfoDescription: "Revisa y edita los metadatos de este dataset.",
      datasetNameLabel: "Nombre",
      projectKeyLabel: "Clave de proyecto",
      noProjectsAvailable: "No hay proyectos importados disponibles",
      customProjectKey: "Clave de proyecto personalizada…",
      projectKeyHint: "Selecciona un proyecto importado o introduce una clave personalizada.",
      showDependencyTree: "Mostrar arbol de dependencias",
      datasetIdLabel: "ID del dataset",
      datasetIdReadonlyHint: "El ID del dataset es de solo lectura porque se usa como clave de almacenamiento.",
      createdPrefix: "Creado:",
      cancel: "Cancelar",
      save: "Guardar",
    },
    it: {
      ...enText,
      datasetNameRequired: "Il nome del dataset è obbligatorio.",
      projectKeyRequired: "La chiave progetto è obbligatoria.",
      datasetInfoUpdated: "Informazioni dataset aggiornate.",
      datasetInfoTitle: "Info dataset",
      datasetInfoDescription: "Rivedi e modifica i metadati di questo dataset.",
      datasetNameLabel: "Nome",
      projectKeyLabel: "Chiave progetto",
      noProjectsAvailable: "Nessun progetto importato disponibile",
      customProjectKey: "Chiave progetto personalizzata…",
      projectKeyHint: "Seleziona un progetto importato o inserisci una chiave progetto personalizzata.",
      showDependencyTree: "Mostra albero dipendenze",
      datasetIdLabel: "ID dataset",
      datasetIdReadonlyHint: "L'ID del dataset è di sola lettura perché usato come chiave di storage.",
      createdPrefix: "Creato:",
      cancel: "Annulla",
      save: "Salva",
    },
  });

  const hasSuggestedProject = useMemo(() => {
    return projectSuggestions.some((project) => project.key === datasetProjectKeyDraft);
  }, [projectSuggestions, datasetProjectKeyDraft]);

  useEffect(() => {
    if (!open || !dataset) return;
    setDatasetNameDraft(dataset.name);
    setDatasetProjectKeyDraft(dataset.projectKey);
  }, [open, dataset]);

  const handleOpenDependencyTree = () => {
    const key = datasetProjectKeyDraft.trim();
    if (!key) {
      toast.error(text.projectKeyRequired);
      return;
    }
    onOpenDependencyTree(key);
  };

  const handleSave = () => {
    if (!dataset) return;
    const nextName = datasetNameDraft.trim();
    const nextProjectKey = datasetProjectKeyDraft.trim();
    if (!nextName) {
      toast.error(text.datasetNameRequired);
      return;
    }
    if (!nextProjectKey) {
      toast.error(text.projectKeyRequired);
      return;
    }
    onSave({ id: dataset.id, name: nextName, projectKey: nextProjectKey });
    onOpenChange(false);
    toast.success(text.datasetInfoUpdated);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{text.datasetInfoTitle}</DialogTitle>
          <DialogDescription>{text.datasetInfoDescription}</DialogDescription>
        </DialogHeader>
        {dataset ? (
          <>
            <div className="grid gap-3">
              <div className="grid gap-2">
                <Label htmlFor="dataset-info-name">{text.datasetNameLabel}</Label>
                <Input
                  id="dataset-info-name"
                  value={datasetNameDraft}
                  onChange={(event) => setDatasetNameDraft(event.target.value)}
                  placeholder={text.datasetNamePlaceholder}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="dataset-info-project">{text.projectKeyLabel}</Label>
                <select
                  id="dataset-info-project"
                  className="h-9 rounded-md border border-foreground/20 bg-background px-3 text-sm"
                  value={hasSuggestedProject ? datasetProjectKeyDraft : "__custom_project_key__"}
                  onChange={(event) => {
                    const value = event.target.value;
                    if (value === "__custom_project_key__") {
                      if (hasSuggestedProject) {
                        setDatasetProjectKeyDraft("");
                      }
                      return;
                    }
                    setDatasetProjectKeyDraft(value);
                  }}
                >
                  {projectSuggestions.length === 0 ? (
                    <option value="__custom_project_key__">{text.noProjectsAvailable}</option>
                  ) : null}
                  {projectSuggestions.map((project) => (
                    <option key={project.key} value={project.key}>
                      {project.label}
                    </option>
                  ))}
                  <option value="__custom_project_key__">{text.customProjectKey}</option>
                </select>
                {!hasSuggestedProject ? (
                  <Input
                    value={datasetProjectKeyDraft}
                    onChange={(event) => setDatasetProjectKeyDraft(event.target.value)}
                    placeholder={text.projectKeyPlaceholder}
                  />
                ) : null}
                <p className="text-xs text-muted-foreground">{text.projectKeyHint}</p>
                <div>
                  <Button type="button" size="sm" variant="outline" onClick={handleOpenDependencyTree}>
                    {text.showDependencyTree}
                  </Button>
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="dataset-info-id">{text.datasetIdLabel}</Label>
                <Input id="dataset-info-id" value={dataset.id} readOnly />
                <p className="text-xs text-muted-foreground">{text.datasetIdReadonlyHint}</p>
              </div>
              <div className="text-xs text-muted-foreground">
                {text.createdPrefix} {new Date(dataset.createdAt).toLocaleString()}
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                {text.cancel}
              </Button>
              <Button onClick={handleSave}>{text.save}</Button>
            </DialogFooter>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
};

