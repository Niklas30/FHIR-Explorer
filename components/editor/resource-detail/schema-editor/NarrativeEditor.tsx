"use client";

import { Label } from "@/components/ui/label";
import { isRecord } from "@/lib/fhir-editor/schema";
import { PopupSearchSelect } from "@/components/editor/resource-detail/PopupSearchSelect";
import { useResourceDetailText } from "@/components/editor/resource-detail/text";

const NARRATIVE_STATUS = ["generated", "extensions", "additional", "empty"];

export const NarrativeEditor = ({
  value,
  onChange,
}: {
  value: unknown;
  onChange: (value: unknown) => void;
}) => {
  const { text } = useResourceDetailText();
  const record = isRecord(value) ? value : {};
  const status = typeof record.status === "string" ? record.status : "";
  const div = typeof record.div === "string" ? record.div : "";

  return (
    <div className="grid gap-2">
      <div className="grid gap-1">
        <Label className="text-xs text-muted-foreground">{text.narrativeStatus}</Label>
        <PopupSearchSelect
          value={status}
          options={NARRATIVE_STATUS.map((entry) => ({ value: entry, label: entry }))}
          placeholder={text.selectValue}
          onValueChange={(next) => onChange({ ...record, status: next || undefined })}
        />
      </div>
      <div className="grid gap-1">
        <Label className="text-xs text-muted-foreground">{text.narrativeDiv}</Label>
        <textarea
          value={div}
          onChange={(event) => onChange({ ...record, div: event.target.value || undefined })}
          className="min-h-[96px] w-full rounded-md border border-foreground/20 bg-background p-2 font-mono text-xs"
          spellCheck={false}
        />
      </div>
    </div>
  );
};
