"use client";

import type { PopupSearchOption } from "@/components/editor/resource-detail/PopupSearchSelect";
import { PopupSearchSelect } from "@/components/editor/resource-detail/PopupSearchSelect";
import { useResourceDetailText } from "@/components/editor/resource-detail/text";
import {
  formatOptionLabel,
  normalizeTimeWithSeconds,
} from "@/components/editor/resource-detail/utils";
import { Input } from "@/components/ui/input";
import type { FieldKind, FieldInputProps } from "@/components/editor/resource-detail/field-input/types";

export const PrimitiveFieldInput = ({
  kind,
  value,
  options,
  onChange,
}: {
  kind: FieldKind;
  value: unknown;
  options: FieldInputProps["options"];
  onChange: (value: unknown) => void;
}) => {
  const { text } = useResourceDetailText();

  if (kind === "boolean") {
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
  }

  if (kind === "number") {
    return (
      <Input
        type="number"
        value={
          typeof value === "number"
            ? String(value)
            : typeof value === "string"
              ? value
              : ""
        }
        onChange={(event) =>
          onChange(event.target.value === "" ? undefined : Number(event.target.value))
        }
      />
    );
  }

  if (kind === "date" || kind === "dateTime") {
    const inputValue = typeof value === "string" ? value : "";
    return (
      <Input
        type={kind === "date" ? "date" : "datetime-local"}
        value={inputValue}
        onChange={(event) => onChange(event.target.value || undefined)}
      />
    );
  }

  if (kind === "time") {
    const inputValue = typeof value === "string" ? value : "";
    return (
      <Input
        type="time"
        step={1}
        value={normalizeTimeWithSeconds(inputValue)}
        onChange={(event) =>
          onChange(normalizeTimeWithSeconds(event.target.value) || undefined)
        }
      />
    );
  }

  if (kind === "code") {
    const inputValue = typeof value === "string" ? value : "";
    if (options.length === 0) {
      return (
        <Input
          value={inputValue}
          onChange={(event) => onChange(event.target.value || undefined)}
        />
      );
    }

    const selectOptions: PopupSearchOption[] = options.map((option) => ({
      value: option.code,
      label: formatOptionLabel(option.system, option.code, option.display),
      searchText: `${option.display ?? ""} ${option.system ?? ""} ${option.code}`.trim(),
    }));

    return (
      <div className="grid gap-2">
        <PopupSearchSelect
          value={inputValue}
          options={selectOptions}
          placeholder={text.selectValue}
          searchPlaceholder={text.searchValues}
          onValueChange={(nextValue) => onChange(nextValue || undefined)}
        />
        <div className="grid gap-2 rounded-md border border-foreground/10 bg-muted/30 px-3 py-2">
          <div className="text-xs text-muted-foreground">{text.orEnterCustomValue}</div>
          <Input
            value={inputValue}
            placeholder={text.enterCode}
            onChange={(event) => onChange(event.target.value || undefined)}
          />
        </div>
      </div>
    );
  }

  if (
    (kind === "string" || kind === "uri" || kind === "url" || kind === "markdown") &&
    options.length > 0
  ) {
    const inputValue = typeof value === "string" ? value : "";
    const selectOptions: PopupSearchOption[] = options.map((option) => ({
      value: option.code,
      label: formatOptionLabel(option.system, option.code, option.display),
      searchText: `${option.display ?? ""} ${option.system ?? ""} ${option.code}`.trim(),
    }));

    return (
      <PopupSearchSelect
        value={inputValue}
        options={selectOptions}
        placeholder={text.selectValue}
        searchPlaceholder={text.searchValue}
        onValueChange={(nextValue) => onChange(nextValue || undefined)}
      />
    );
  }

  const inputValue = typeof value === "string" ? value : "";
  return (
    <Input
      value={inputValue}
      onChange={(event) => onChange(event.target.value || undefined)}
    />
  );
};

