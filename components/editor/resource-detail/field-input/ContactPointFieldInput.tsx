"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { CodingSelectOption } from "@/components/editor/resource-detail/field-input/types";
import { isRecord } from "@/components/editor/resource-detail/field-input/utils";
import { PopupSearchSelect } from "@/components/editor/resource-detail/PopupSearchSelect";
import { useResourceDetailText } from "@/components/editor/resource-detail/text";

/** Core FHIR contact-point-system codes, used when no binding is resolvable. */
const FALLBACK_SYSTEMS = ["phone", "fax", "email", "pager", "url", "sms", "other"];

const FALLBACK_USES = ["home", "work", "temp", "old", "mobile"];

/** Maps ContactPoint.system to the matching HTML input type. */
const INPUT_TYPE_BY_SYSTEM: Record<string, string> = {
  phone: "tel",
  fax: "tel",
  sms: "tel",
  pager: "tel",
  email: "email",
  url: "url",
};

type ContactPointFieldInputProps = {
  value: unknown;
  /** System options from the profile binding; falls back to core codes. */
  options: CodingSelectOption[];
  onChange: (value: unknown) => void;
};

/**
 * Structured editor for ContactPoint: the value input adapts to the chosen
 * system (tel for phone/fax/sms, email, url) so browsers assist with
 * format-appropriate keyboards and validation.
 */
export const ContactPointFieldInput = ({
  value,
  options,
  onChange,
}: ContactPointFieldInputProps) => {
  const { text } = useResourceDetailText();
  const record = isRecord(value) ? value : {};
  const system = typeof record.system === "string" ? record.system : "";
  const pointValue = typeof record.value === "string" ? record.value : "";
  const use = typeof record.use === "string" ? record.use : "";

  const systemCodes =
    options.length > 0 ? options.map((option) => option.code) : FALLBACK_SYSTEMS;

  return (
    <div className="grid gap-2">
      <div className="grid gap-1">
        <Label className="text-xs text-muted-foreground">{text.contactPointSystem}</Label>
        <PopupSearchSelect
          value={system}
          options={systemCodes.map((code) => ({ value: code, label: code }))}
          placeholder={text.selectSystem}
          searchPlaceholder={text.searchSystems}
          onValueChange={(nextSystem) =>
            onChange({ ...record, system: nextSystem || undefined })
          }
        />
      </div>
      <div className="grid gap-1">
        <Label className="text-xs text-muted-foreground">{text.contactPointValue}</Label>
        <Input
          type={INPUT_TYPE_BY_SYSTEM[system] ?? "text"}
          value={pointValue}
          onChange={(event) =>
            onChange({ ...record, value: event.target.value || undefined })
          }
        />
      </div>
      <div className="grid gap-1">
        <Label className="text-xs text-muted-foreground">{text.useOptional}</Label>
        <PopupSearchSelect
          value={use}
          options={FALLBACK_USES.map((code) => ({ value: code, label: code }))}
          placeholder={text.selectValue}
          searchPlaceholder={text.searchUseValues}
          onValueChange={(nextUse) => onChange({ ...record, use: nextUse || undefined })}
        />
      </div>
    </div>
  );
};
