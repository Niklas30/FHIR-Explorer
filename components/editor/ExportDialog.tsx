"use client";

import { useI18n } from "@/components/i18n/I18nProvider";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { byLocale } from "@/lib/i18n/select";

export type ExportScope = "dataset" | "project";
export type ExportFormat = "json" | "zip";
export type ExportDatasetMode = "package" | "resources" | "searchset";
export type ExportDatasetOption = { value: string; label: string; secondary?: string };

type ScopeOption = {
  value: ExportScope;
  label: string;
  disabled?: boolean;
  helper?: string;
};

type ExportDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  scope?: ExportScope;
  scopeOptions?: ScopeOption[];
  onScopeChange?: (scope: ExportScope) => void;
  exportFormat: ExportFormat;
  onExportFormatChange: (format: ExportFormat) => void;
  datasetMode?: ExportDatasetMode;
  onDatasetModeChange?: (mode: ExportDatasetMode) => void;
  datasetOptions?: ExportDatasetOption[];
  selectedDataset?: string | null;
  onDatasetChange?: (datasetId: string) => void;
  includeDatasets?: boolean;
  onIncludeDatasetsChange?: (value: boolean) => void;
  confirmLabel: string;
  onConfirm: () => void;
  confirmDisabled?: boolean;
};

export const ExportDialog = ({
  open,
  onOpenChange,
  title,
  description,
  scope,
  scopeOptions,
  onScopeChange,
  exportFormat,
  onExportFormatChange,
  datasetMode,
  onDatasetModeChange,
  datasetOptions,
  selectedDataset,
  onDatasetChange,
  includeDatasets,
  onIncludeDatasetsChange,
  confirmLabel,
  onConfirm,
  confirmDisabled,
}: ExportDialogProps) => {
  const { locale } = useI18n();
  const activeScope = scopeOptions ? scope ?? scopeOptions[0]?.value : scope;
  const showDatasetMode = activeScope === "dataset" && datasetMode && onDatasetModeChange;
  const showIncludeDatasets = activeScope === "project" && typeof includeDatasets === "boolean";
  const showDatasetSelect =
    activeScope === "dataset" && datasetOptions && onDatasetChange !== undefined;
  const text = byLocale(locale, {
    de: {
      exportScope: "Export-Umfang",
      exportFormat: "Export-Format",
      singleJson: "Einzelne JSON",
      zipArchive: "ZIP-Archiv",
      formatHint:
        "JSON exportiert alles in einer Datei. ZIP teilt Daten in Dateien mit Manifest auf.",
      dataset: "Dataset",
      noDatasetsAvailable: "Keine Datasets verfügbar.",
      datasetPayload: "Dataset-Inhalt",
      datasetPackage: "Dataset-Paket",
      resourcesList: "Ressourcenliste",
      fhirSearchset: "FHIR Searchset",
      payloadHint:
        "Ressourcenliste exportiert rohe Ressourcen-JSON. Searchset exportiert ein FHIR Bundle mit Typ",
      includeDatasets: "Datasets einschließen",
      cancel: "Abbrechen",
    },
    en: {
      exportScope: "Export scope",
      exportFormat: "Export format",
      singleJson: "Single JSON",
      zipArchive: "ZIP archive",
      formatHint: "JSON exports everything in one file. ZIP splits data into files with a manifest.",
      dataset: "Dataset",
      noDatasetsAvailable: "No datasets available.",
      datasetPayload: "Dataset payload",
      datasetPackage: "Dataset package",
      resourcesList: "Resources list",
      fhirSearchset: "FHIR searchset",
      payloadHint:
        "Resources list exports raw resource JSON. Searchset exports a FHIR Bundle with type",
      includeDatasets: "Include datasets",
      cancel: "Cancel",
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description ? <DialogDescription>{description}</DialogDescription> : null}
        </DialogHeader>
        <div className="grid gap-4">
          {scopeOptions && onScopeChange ? (
            <div className="grid gap-2">
              <Label>{text.exportScope}</Label>
              <div className="flex flex-wrap items-center gap-2">
                {scopeOptions.map((option) => (
                  <Button
                    key={option.value}
                    type="button"
                    size="sm"
                    variant={activeScope === option.value ? "secondary" : "outline"}
                    onClick={() => onScopeChange(option.value)}
                    disabled={option.disabled}
                  >
                    {option.label}
                  </Button>
                ))}
              </div>
              {scopeOptions.map((option) =>
                option.helper && activeScope === option.value ? (
                  <p key={option.value} className="text-xs text-muted-foreground">
                    {option.helper}
                  </p>
                ) : null
              )}
            </div>
          ) : null}

          <div className="grid gap-2">
            <Label>{text.exportFormat}</Label>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                size="sm"
                variant={exportFormat === "json" ? "secondary" : "outline"}
                onClick={() => onExportFormatChange("json")}
              >
                {text.singleJson}
              </Button>
              <Button
                type="button"
                size="sm"
                variant={exportFormat === "zip" ? "secondary" : "outline"}
                onClick={() => onExportFormatChange("zip")}
              >
                {text.zipArchive}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              {text.formatHint}
            </p>
          </div>

          {showDatasetSelect ? (
            <div className="grid gap-2">
              <Label>{text.dataset}</Label>
              {datasetOptions.length > 0 ? (
                <select
                  value={selectedDataset ?? datasetOptions[0]?.value}
                  onChange={(event) => onDatasetChange(event.target.value)}
                  className="h-9 rounded-md border border-foreground/20 bg-background px-3 text-sm"
                >
                  {datasetOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.secondary ? `${option.label} · ${option.secondary}` : option.label}
                    </option>
                  ))}
                </select>
              ) : (
                <p className="text-xs text-muted-foreground">{text.noDatasetsAvailable}</p>
              )}
            </div>
          ) : null}

          {showDatasetMode ? (
            <div className="grid gap-2">
              <Label>{text.datasetPayload}</Label>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant={datasetMode === "package" ? "secondary" : "outline"}
                  onClick={() => onDatasetModeChange?.("package")}
                >
                  {text.datasetPackage}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={datasetMode === "resources" ? "secondary" : "outline"}
                  onClick={() => onDatasetModeChange?.("resources")}
                >
                  {text.resourcesList}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={datasetMode === "searchset" ? "secondary" : "outline"}
                  onClick={() => onDatasetModeChange?.("searchset")}
                >
                  {text.fhirSearchset}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                {text.payloadHint} <span className="font-semibold">searchset</span>.
              </p>
            </div>
          ) : null}

          {showIncludeDatasets ? (
            <div className="flex items-center gap-2">
              <input
                id="export-include-datasets"
                type="checkbox"
                checked={includeDatasets}
                onChange={(event) => onIncludeDatasetsChange?.(event.target.checked)}
                className="h-4 w-4 rounded border border-foreground/30"
              />
              <Label htmlFor="export-include-datasets">{text.includeDatasets}</Label>
            </div>
          ) : null}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {text.cancel}
          </Button>
          <Button onClick={onConfirm} disabled={confirmDisabled}>
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
