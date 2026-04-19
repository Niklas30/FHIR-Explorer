"use client";

import { useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const defaultAccept = ".tgz,application/gzip,application/x-gzip";
const defaultHint = "Drag & drop here, or click to choose a file.";

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
  label = "Upload file",
  helperText,
  disabled,
  onFiles,
  accept = defaultAccept,
  hint = defaultHint,
  multiple = true,
  chooseButtonLabel = "Choose File",
  enableClipboard = false,
  clipboardButtonLabel = "Paste from Clipboard",
  clipboardHint = "Tip: focus this box and press Ctrl/Cmd+V",
  clipboardFilename = "clipboard-import.json",
}: FileDropzoneProps) => {
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
      setClipboardStatus("Clipboard access is not supported in this browser.");
      return;
    }
    try {
      const text = await navigator.clipboard.readText();
      if (!text.trim()) {
        setClipboardStatus("Clipboard is empty.");
        return;
      }
      handleFiles([toClipboardFile(text, clipboardFilename)]);
      setClipboardStatus("Imported JSON text from clipboard.");
    } catch (error) {
      console.error(error);
      setClipboardStatus("Clipboard access was blocked.");
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
          setClipboardStatus(`Imported ${pastedFiles.length} file(s) from clipboard.`);
          return;
        }

        const text = event.clipboardData.getData("text/plain");
        if (!text.trim()) {
          setClipboardStatus("Clipboard is empty.");
          return;
        }
        handleFiles([toClipboardFile(text, clipboardFilename)]);
        setClipboardStatus("Imported JSON text from clipboard.");
      }}
    >
      <div className="flex flex-col gap-1">
        <p className="text-sm font-medium text-foreground">{label}</p>
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
          {chooseButtonLabel}
        </Button>
        {enableClipboard ? (
          <Button
            type="button"
            variant="outline"
            disabled={disabled}
            onClick={() => void handlePasteFromClipboard()}
          >
            {clipboardButtonLabel}
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
        <span className="text-xs text-muted-foreground">{hint}</span>
      </div>
      {enableClipboard ? (
        <p className="text-xs text-muted-foreground">
          {clipboardStatus ?? clipboardHint}
        </p>
      ) : null}
    </div>
  );
};
