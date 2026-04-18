"use client";

import { useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const defaultAccept = ".tgz,application/gzip,application/x-gzip";

type FileDropzoneProps = {
  label?: string;
  helperText?: string;
  disabled?: boolean;
  onFiles: (files: File[]) => void;
};

export const FileDropzone = ({
  label = "Upload .tgz",
  helperText,
  disabled,
  onFiles,
}: FileDropzoneProps) => {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleFiles = (files?: File[] | FileList | null) => {
    if (!files) return;
    const list = Array.isArray(files) ? files : Array.from(files);
    if (list.length === 0) return;
    onFiles(list);
  };

  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-xl border border-dashed px-4 py-4 transition",
        isDragging ? "border-primary bg-primary/5" : "border-border",
        disabled ? "opacity-60" : "hover:border-primary"
      )}
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
          Choose File
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept={defaultAccept}
          className="hidden"
          multiple
          onChange={(event) => handleFiles(event.target.files)}
        />
        <span className="text-xs text-muted-foreground">
          Drag & drop .tgz files here
        </span>
      </div>
    </div>
  );
};
