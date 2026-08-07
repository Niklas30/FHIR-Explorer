"use client";

import { useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { CodingSelectOption } from "@/components/editor/resource-detail/field-input/types";
import { isRecord } from "@/components/editor/resource-detail/field-input/utils";
import {
  PopupSearchSelect,
  type PopupSearchOption,
} from "@/components/editor/resource-detail/PopupSearchSelect";
import { useResourceDetailText } from "@/components/editor/resource-detail/text";
import { COMMON_UCUM_UNITS, UCUM_SYSTEM } from "@/lib/fhir-editor/ucum-units";

type QuantityFieldInputProps = {
  value: unknown;
  /** Unit options from a profile binding; falls back to common UCUM units. */
  options: CodingSelectOption[];
  onChange: (value: unknown) => void;
};

/**
 * Structured editor for Quantity and its specializations (Age, Duration,
 * Count, Distance, …): numeric value plus a unit picker that fills
 * system/code/unit consistently.
 */
export const QuantityFieldInput = ({ value, options, onChange }: QuantityFieldInputProps) => {
  const { text } = useResourceDetailText();
  const record = isRecord(value) ? value : {};
  const numericValue =
    typeof record.value === "number" ? String(record.value) : "";
  const unitCode = typeof record.code === "string" ? record.code : "";
  const unitText = typeof record.unit === "string" ? record.unit : "";

  const unitOptions: PopupSearchOption[] = useMemo(() => {
    const source =
      options.length > 0
        ? options.map((option) => ({
            code: option.code,
            display: option.display ?? option.code,
            system: option.system,
          }))
        : COMMON_UCUM_UNITS.map((unit) => ({
            code: unit.code,
            display: unit.display,
            system: UCUM_SYSTEM,
          }));
    return source.map((unit) => ({
      value: `${unit.system ?? ""}|${unit.code}`,
      label: `${unit.display} (${unit.code})`,
      searchText: `${unit.display} ${unit.code}`,
    }));
  }, [options]);

  const selectedUnitKey = unitCode
    ? `${typeof record.system === "string" ? record.system : ""}|${unitCode}`
    : "";

  const applyUnit = (unitKey: string) => {
    if (!unitKey) {
      onChange({ ...record, system: undefined, code: undefined, unit: undefined });
      return;
    }
    const [system, code] = unitKey.split("|");
    const known =
      options.find((option) => (option.system ?? "") === system && option.code === code) ??
      COMMON_UCUM_UNITS.filter(() => system === UCUM_SYSTEM).find(
        (unit) => unit.code === code
      );
    onChange({
      ...record,
      system: system || undefined,
      code: code || undefined,
      unit: known?.display ?? code ?? undefined,
    });
  };

  return (
    <div className="grid gap-2">
      <div className="grid gap-1">
        <Label className="text-xs text-muted-foreground">{text.quantityValue}</Label>
        <Input
          type="number"
          step="any"
          value={numericValue}
          onChange={(event) =>
            onChange({
              ...record,
              value: event.target.value === "" ? undefined : Number(event.target.value),
            })
          }
        />
      </div>
      <div className="grid gap-1">
        <Label className="text-xs text-muted-foreground">{text.quantityUnit}</Label>
        <PopupSearchSelect
          value={selectedUnitKey}
          options={unitOptions}
          placeholder={text.selectUnit}
          searchPlaceholder={text.searchUnits}
          onValueChange={applyUnit}
        />
        <Input
          value={unitText}
          placeholder={text.customUnitPlaceholder}
          onChange={(event) =>
            onChange({ ...record, unit: event.target.value || undefined })
          }
        />
      </div>
    </div>
  );
};
