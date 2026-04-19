"use client";

import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { OverviewText } from "@/components/overview/types";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  text: OverviewText;
  onDeleteAllData: () => void;
};

export const SettingsDialog = ({ open, onOpenChange, text, onDeleteAllData }: Props) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{text.settingsTitle}</DialogTitle>
          <DialogDescription>{text.settingsDescription}</DialogDescription>
        </DialogHeader>
        <div className="rounded-lg border border-foreground/10 bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
          {text.settingsDeleteInfo}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
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

