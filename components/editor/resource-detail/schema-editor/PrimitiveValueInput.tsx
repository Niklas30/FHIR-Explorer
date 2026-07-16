"use client";

import type { CodingOption } from "@/lib/fhir-editor/registry";
import type { PrimitiveKind } from "@/lib/fhir-editor/schema";
import { Input } from "@/components/ui/input";
import {
  PopupSearchSelect,
  type PopupSearchOption,
} from "@/components/editor/resource-detail/PopupSearchSelect";
import { useResourceDetailText } from "@/components/editor/resource-detail/text";
import {
  formatOptionLabel,
  normalizeTimeWithSeconds,
} from "@/components/editor/resource-detail/utils";

type PrimitiveValueInputProps = {
  primitive: PrimitiveKind;
  value: unknown;
  options: CodingOption[];
  onChange: (value: unknown) => void;
};

const toSelectOptions = (options: CodingOption[]): PopupSearchOption[] =>
  options.map((option) => ({
    value: option.code,
    label: formatOptionLabel(option.system, option.code, option.display),
    searchText: `${option.display ?? ""} ${option.system ?? ""} ${option.code}`.trim(),
  }));

export const PrimitiveValueInput = ({
  primitive,
  value,
  options,
  onChange,
}: PrimitiveValueInputProps) => {
  const { text } = useResourceDetailText();
  const stringValue = typeof value === "string" ? value : "";

  switch (primitive) {
    case "boolean":
      return (
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            className="h-4 w-4 rounded border border-foreground/20"
            checked={Boolean(value)}
            onChange={(event) => onChange(event.target.checked)}
          />
          <span>{text.enabled}</span>
        </label>
      );

    case "integer":
    case "decimal":
      return (
        <Input
          type="number"
          step={primitive === "decimal" ? "any" : 1}
          value={
            typeof value === "number" ? String(value) : typeof value === "string" ? value : ""
          }
          onChange={(event) =>
            onChange(event.target.value === "" ? undefined : Number(event.target.value))
          }
        />
      );

    case "date":
      return (
        <Input
          type="date"
          value={stringValue}
          onChange={(event) => onChange(event.target.value || undefined)}
        />
      );

    case "dateTime":
      return (
        <Input
          type="datetime-local"
          value={stringValue}
          onChange={(event) => onChange(event.target.value || undefined)}
        />
      );

    case "time":
      return (
        <Input
          type="time"
          step={1}
          value={normalizeTimeWithSeconds(stringValue)}
          onChange={(event) =>
            onChange(normalizeTimeWithSeconds(event.target.value) || undefined)
          }
        />
      );

    case "markdown":
    case "xhtml":
    case "base64Binary":
      return (
        <textarea
          value={stringValue}
          onChange={(event) => onChange(event.target.value || undefined)}
          className="min-h-[96px] w-full rounded-md border border-foreground/20 bg-background p-2 text-sm"
          spellCheck={primitive === "markdown"}
        />
      );

    case "code":
      if (options.length > 0) {
        return (
          <div className="grid gap-2">
            <PopupSearchSelect
              value={stringValue}
              options={toSelectOptions(options)}
              placeholder={text.selectValue}
              searchPlaceholder={text.searchValues}
              onValueChange={(nextValue) => onChange(nextValue || undefined)}
            />
            <Input
              value={stringValue}
              placeholder={text.enterCode}
              onChange={(event) => onChange(event.target.value || undefined)}
            />
          </div>
        );
      }
      return (
        <Input
          value={stringValue}
          onChange={(event) => onChange(event.target.value || undefined)}
        />
      );

    default: {
      if (options.length > 0) {
        return (
          <PopupSearchSelect
            value={stringValue}
            options={toSelectOptions(options)}
            placeholder={text.selectValue}
            searchPlaceholder={text.searchValue}
            onValueChange={(nextValue) => onChange(nextValue || undefined)}
          />
        );
      }
      return (
        <Input
          value={stringValue}
          onChange={(event) => onChange(event.target.value || undefined)}
        />
      );
    }
  }
};
