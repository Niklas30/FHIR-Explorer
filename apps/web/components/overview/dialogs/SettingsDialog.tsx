"use client";

import { useEffect, useState } from "react";
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
import type { OverviewText } from "@/components/overview/types";
import {
  getTerminologyServerUrl,
  setTerminologyServerUrl,
} from "@/lib/fhir-editor/terminology";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  text: OverviewText;
  onDeleteAllData: () => void;
};

export const SettingsDialog = ({ open, onOpenChange, text, onDeleteAllData }: Props) => {
  const [terminologyUrl, setTerminologyUrl] = useState("");

  useEffect(() => {
    if (open) {
      setTerminologyUrl(getTerminologyServerUrl() ?? "");
    }
  }, [open]);

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      // Persist on close — the dialog has no separate save action.
      setTerminologyServerUrl(terminologyUrl);
    }
    onOpenChange(nextOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{text.settingsTitle}</DialogTitle>
          <DialogDescription>{text.settingsDescription}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-2">
          <Label className="text-sm font-medium">{text.terminologyServerLabel}</Label>
          <Input
            type="url"
            value={terminologyUrl}
            placeholder="https://tx.fhir.org/r4"
            onChange={(event) => setTerminologyUrl(event.target.value)}
          />
          <p className="text-xs text-muted-foreground">{text.terminologyServerHint}</p>
        </div>
        <div className="rounded-lg border border-foreground/10 bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
          {text.settingsDeleteInfo}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            {text.close}
          </Button>
          <Button variant="destructive" onClick={onDeleteAllData}>
            {text.deleteAllLocalData}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
