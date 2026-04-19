"use client";

import { useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useResourceDetailText } from "@/components/editor/resource-detail/text";

export type PopupSearchOption = {
  value: string;
  label: string;
  searchText?: string;
};

type PopupSearchSelectProps = {
  value: string;
  options: PopupSearchOption[];
  placeholder: string;
  onValueChange: (value: string) => void;
  searchPlaceholder?: string;
  emptyMessage?: string;
  clearLabel?: string;
};

export const PopupSearchSelect = ({
  value,
  options,
  placeholder,
  onValueChange,
  searchPlaceholder,
  emptyMessage,
  clearLabel,
}: PopupSearchSelectProps) => {
  const { text } = useResourceDetailText();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const effectiveSearchPlaceholder = searchPlaceholder ?? text.popupSearchPlaceholder;
  const effectiveEmptyMessage = emptyMessage ?? text.popupNoOptions;
  const effectiveClearLabel = clearLabel ?? text.popupClear;
  const selected = options.find((option) => option.value === value);
  const normalizedQuery = query.trim().toLowerCase();
  const filteredOptions = options.filter((option) => {
    if (!normalizedQuery) return true;
    const haystack = `${option.label} ${option.searchText ?? ""}`.toLowerCase();
    return haystack.includes(normalizedQuery);
  });

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex h-9 w-full items-center justify-between rounded-md border border-foreground/20 bg-background px-3 text-sm"
      >
        <span className={selected ? "text-foreground" : "text-muted-foreground"}>
          {selected?.label ?? placeholder}
        </span>
        <ChevronsUpDown className="size-4 text-muted-foreground" />
      </button>
      <Dialog
        open={open}
        onOpenChange={(nextOpen) => {
          setOpen(nextOpen);
          if (!nextOpen) {
            setQuery("");
          }
        }}
      >
        <DialogContent>
          <div className="grid gap-3">
            <Input
              autoFocus
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={effectiveSearchPlaceholder}
            />
            <div className="max-h-80 overflow-auto rounded-md border border-foreground/10">
              <div className="grid gap-1 p-2">
                <button
                  type="button"
                  onClick={() => {
                    onValueChange("");
                    setOpen(false);
                  }}
                  className={cn(
                    "flex items-center justify-between rounded-md px-3 py-2 text-left text-sm hover:bg-muted/40",
                    !value ? "bg-muted/50" : ""
                  )}
                >
                  <span>{effectiveClearLabel}</span>
                  {!value ? <Check className="size-4 text-muted-foreground" /> : null}
                </button>
                {filteredOptions.length === 0 ? (
                  <div className="px-3 py-2 text-sm text-muted-foreground">
                    {effectiveEmptyMessage}
                  </div>
                ) : (
                  filteredOptions.map((option, index) => (
                    <button
                      key={`${option.value}-${index}`}
                      type="button"
                      onClick={() => {
                        onValueChange(option.value);
                        setOpen(false);
                      }}
                      className={cn(
                        "flex items-center justify-between rounded-md px-3 py-2 text-left text-sm hover:bg-muted/40",
                        value === option.value ? "bg-muted/50" : ""
                      )}
                    >
                      <span>{option.label}</span>
                      {value === option.value ? (
                        <Check className="size-4 text-muted-foreground" />
                      ) : null}
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

