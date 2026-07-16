"use client";

import { useMemo } from "react";
import { PopupSearchSelect, type PopupSearchOption } from "@/components/editor/resource-detail/PopupSearchSelect";
import { useResourceDetailText } from "@/components/editor/resource-detail/text";
import { formatOptionLabel } from "@/components/editor/resource-detail/utils";
import { Input } from "@/components/ui/input";
import type { CodingSelectOption } from "@/components/editor/resource-detail/field-input/types";
import { isRecord, readCoding, writeCoding } from "@/components/editor/resource-detail/field-input/utils";

export const CodingFieldInput = ({
  kind,
  value,
  options,
  onChange,
}: {
  kind: "Coding" | "CodeableConcept";
  value: unknown;
  options: CodingSelectOption[];
  onChange: (value: unknown) => void;
}) => {
  const { text } = useResourceDetailText();
  const record = isRecord(value) ? value : {};
  const coding = readCoding(kind, record);
  const systemValue = typeof coding.system === "string" ? coding.system : "";
  const codeValue = typeof coding.code === "string" ? coding.code : "";
  const displayValue = typeof coding.display === "string" ? coding.display : "";
  const textValue = typeof record.text === "string" ? record.text : "";

  const systemOptions: PopupSearchOption[] = useMemo(() => {
    const unique = new Set<string>();
    for (const option of options) {
      if (option.system) unique.add(option.system);
    }
    return Array.from(unique).sort().map((system) => ({ value: system, label: system }));
  }, [options]);

  const codeOptions: PopupSearchOption[] = useMemo(
    () =>
      options
        .filter((option) => !systemValue || option.system === systemValue)
        .map((option) => ({
          value: option.code,
          label: formatOptionLabel(option.system, option.code, option.display),
          searchText: `${option.display ?? ""} ${option.system ?? ""} ${option.code}`.trim(),
        })),
    [options, systemValue]
  );

  const applyCoding = (nextCoding: Record<string, unknown>) => {
    onChange(writeCoding(kind, record, nextCoding));
  };

  return (
    <div className="grid gap-3">
      {systemOptions.length > 0 ? (
        <PopupSearchSelect
          value={systemValue}
          options={systemOptions}
          placeholder={text.selectSystem}
          searchPlaceholder={text.searchSystems}
          onValueChange={(nextSystem) =>
            applyCoding({ ...coding, system: nextSystem || undefined, code: undefined })
          }
        />
      ) : (
        <Input
          value={systemValue}
          placeholder={text.systemUrl}
          onChange={(event) => applyCoding({ ...coding, system: event.target.value || undefined })}
        />
      )}

      {codeOptions.length > 0 ? (
        <PopupSearchSelect
          value={codeValue}
          options={codeOptions}
          placeholder={text.selectValue}
          searchPlaceholder={text.searchValues}
          onValueChange={(nextCode) => applyCoding({ ...coding, code: nextCode || undefined })}
        />
      ) : (
        <Input
          value={codeValue}
          placeholder={text.code}
          onChange={(event) => applyCoding({ ...coding, code: event.target.value || undefined })}
        />
      )}

      <Input
        value={displayValue}
        placeholder={text.displayOptional}
        onChange={(event) => applyCoding({ ...coding, display: event.target.value || undefined })}
      />
      {kind === "CodeableConcept" ? (
        <Input
          value={textValue}
          placeholder={text.textOptional}
          onChange={(event) => onChange({ ...record, text: event.target.value || undefined })}
        />
      ) : null}
    </div>
  );
};

