"use client";

import { useRef, useState } from "react";
import { useI18n } from "@/components/i18n/I18nProvider";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { byLocale } from "@/lib/i18n/select";
import { logger } from "@/lib/logger";

const defaultAccept = ".tar,.tgz,application/x-tar,application/tar,application/gzip,application/x-gzip";

type FileDropzoneProps = {
  label?: string;
  helperText?: string;
  disabled?: boolean;
  onFiles: (files: File[]) => void;
  accept?: string;
  hint?: string;
  multiple?: boolean;
  chooseButtonLabel?: string;
  enableClipboard?: boolean;
  clipboardButtonLabel?: string;
  clipboardHint?: string;
  clipboardFilename?: string;
};

const toClipboardFile = (content: string, filename: string) =>
  new File([content], filename, { type: "application/json" });

export const FileDropzone = ({
  label,
  helperText,
  disabled,
  onFiles,
  accept = defaultAccept,
  hint,
  multiple = true,
  chooseButtonLabel,
  enableClipboard = false,
  clipboardButtonLabel,
  clipboardHint,
  clipboardFilename = "clipboard-import.json",
}: FileDropzoneProps) => {
  const { locale } = useI18n();
  const i18n = byLocale(locale, {
    de: {
      label: "Datei hochladen",
      hint: "Dateien hier hineinziehen",
      chooseFile: "Datei auswählen",
      pasteFromClipboard: "Aus Zwischenablage einfügen",
      clipboardTip: "Tipp: Feld fokussieren und Strg/Cmd+V drücken",
      clipboardNotSupported:
        "Zwischenablage-Zugriff wird in diesem Browser nicht unterstützt.",
      clipboardEmpty: "Zwischenablage ist leer.",
      clipboardImportedJson: "JSON-Text aus der Zwischenablage importiert.",
      clipboardBlocked: "Zwischenablage-Zugriff wurde blockiert.",
      clipboardImportedFiles: "Datei(en) aus der Zwischenablage importiert.",
    },
    en: {
      label: "Upload file",
      hint: "Drag & drop files here",
      chooseFile: "Choose File",
      pasteFromClipboard: "Paste from Clipboard",
      clipboardTip: "Tip: focus this box and press Ctrl/Cmd+V",
      clipboardNotSupported: "Clipboard access is not supported in this browser.",
      clipboardEmpty: "Clipboard is empty.",
      clipboardImportedJson: "Imported JSON text from clipboard.",
      clipboardBlocked: "Clipboard access was blocked.",
      clipboardImportedFiles: "Imported file(s) from clipboard.",
    },
    fr: {
      label: "Televerser un fichier",
      hint: "Glisser-deposer les fichiers ici",
      chooseFile: "Choisir un fichier",
      pasteFromClipboard: "Coller depuis le presse-papiers",
      clipboardTip: "Astuce: focusez cette zone puis appuyez sur Ctrl/Cmd+V",
      clipboardNotSupported:
        "L'acces au presse-papiers n'est pas pris en charge par ce navigateur.",
      clipboardEmpty: "Le presse-papiers est vide.",
      clipboardImportedJson: "Texte JSON importe depuis le presse-papiers.",
      clipboardBlocked: "L'acces au presse-papiers a ete bloque.",
      clipboardImportedFiles: "Fichier(s) importes depuis le presse-papiers.",
    },
    es: {
      label: "Subir archivo",
      hint: "Arrastra y suelta archivos aqui",
      chooseFile: "Elegir archivo",
      pasteFromClipboard: "Pegar desde el portapapeles",
      clipboardTip: "Consejo: enfoca esta zona y pulsa Ctrl/Cmd+V",
      clipboardNotSupported:
        "El acceso al portapapeles no esta disponible en este navegador.",
      clipboardEmpty: "El portapapeles esta vacio.",
      clipboardImportedJson: "Texto JSON importado desde el portapapeles.",
      clipboardBlocked: "El acceso al portapapeles fue bloqueado.",
      clipboardImportedFiles: "Archivo(s) importado(s) desde el portapapeles.",
    },
    it: {
      label: "Carica file",
      hint: "Trascina qui i file",
      chooseFile: "Scegli file",
      pasteFromClipboard: "Incolla dagli appunti",
      clipboardTip: "Suggerimento: focalizza questa area e premi Ctrl/Cmd+V",
      clipboardNotSupported:
        "L'accesso agli appunti non e supportato da questo browser.",
      clipboardEmpty: "Gli appunti sono vuoti.",
      clipboardImportedJson: "Testo JSON importato dagli appunti.",
      clipboardBlocked: "L'accesso agli appunti e stato bloccato.",
      clipboardImportedFiles: "File importati dagli appunti.",
    },
  });

  const inputRef = useRef<HTMLInputElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [clipboardStatus, setClipboardStatus] = useState<string | null>(null);

  const handleFiles = (files?: File[] | FileList | null) => {
    if (!files) return;
    const list = Array.isArray(files) ? files : Array.from(files);
    if (list.length === 0) return;
    onFiles(multiple ? list : [list[0]]);
  };

  const handlePasteFromClipboard = async () => {
    if (disabled || !enableClipboard) return;
    if (typeof navigator === "undefined" || !navigator.clipboard?.readText) {
      setClipboardStatus(i18n.clipboardNotSupported);
      return;
    }
    try {
      const clipboardText = await navigator.clipboard.readText();
      if (!clipboardText.trim()) {
        setClipboardStatus(i18n.clipboardEmpty);
        return;
      }
      handleFiles([toClipboardFile(clipboardText, clipboardFilename)]);
      setClipboardStatus(i18n.clipboardImportedJson);
    } catch (error) {
      logger.warn("Clipboard access failed", { error });
      setClipboardStatus(i18n.clipboardBlocked);
    }
  };

  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-xl border border-dashed px-4 py-4 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        isDragging ? "border-primary bg-primary/5" : "border-border",
        disabled ? "opacity-60" : "hover:border-primary"
      )}
      tabIndex={disabled ? -1 : 0}
      onKeyDown={(event) => {
        if (disabled) return;
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          inputRef.current?.click();
        }
      }}
      onDragOver={(event) => {
        if (disabled) return;
        event.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={(event) => {
        if (disabled) return;
        event.preventDefault();
        setIsDragging(false);
        handleFiles(event.dataTransfer.files);
      }}
      onPaste={(event) => {
        if (disabled || !enableClipboard) return;
        event.preventDefault();
        const pastedFiles = Array.from(event.clipboardData.files ?? []);
        if (pastedFiles.length > 0) {
          handleFiles(pastedFiles);
          setClipboardStatus(
            `${pastedFiles.length} ${i18n.clipboardImportedFiles}`
          );
          return;
        }

        const clipboardText = event.clipboardData.getData("text/plain");
        if (!clipboardText.trim()) {
          setClipboardStatus(i18n.clipboardEmpty);
          return;
        }
        handleFiles([toClipboardFile(clipboardText, clipboardFilename)]);
        setClipboardStatus(i18n.clipboardImportedJson);
      }}
    >
      <div className="flex flex-col gap-1">
        <p className="text-sm font-medium text-foreground">{label ?? i18n.label}</p>
        {helperText ? (
          <p className="text-xs text-muted-foreground">{helperText}</p>
        ) : null}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="button"
          variant="secondary"
          disabled={disabled}
          onClick={() => inputRef.current?.click()}
        >
          {chooseButtonLabel ?? i18n.chooseFile}
        </Button>
        {enableClipboard ? (
          <Button
            type="button"
            variant="outline"
            disabled={disabled}
            onClick={() => void handlePasteFromClipboard()}
          >
            {clipboardButtonLabel ?? i18n.pasteFromClipboard}
          </Button>
        ) : null}
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          className="hidden"
          multiple={multiple}
          onChange={(event) => handleFiles(event.target.files)}
        />
        <span className="text-xs text-muted-foreground">{hint ?? i18n.hint}</span>
      </div>
      {enableClipboard ? (
        <p className="text-xs text-muted-foreground">
          {clipboardStatus ?? clipboardHint ?? i18n.clipboardTip}
        </p>
      ) : null}
    </div>
  );
};
