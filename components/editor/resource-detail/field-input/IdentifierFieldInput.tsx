"use client";

import { PopupSearchSelect, type PopupSearchOption } from "@/components/editor/resource-detail/PopupSearchSelect";
import { useResourceDetailText } from "@/components/editor/resource-detail/text";
import { formatOptionLabel } from "@/components/editor/resource-detail/utils";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { IDENTIFIER_USE_OPTIONS, isRecord } from "@/components/editor/resource-detail/field-input/utils";

export const IdentifierFieldInput = ({
  value,
  identifierSystems,
  identifierTypeOptions,
  onChange,
}: {
  value: unknown;
  identifierSystems: Array<{ system: string; label: string }>;
  identifierTypeOptions: Array<{ system?: string; code: string; display?: string }>;
  onChange: (value: unknown) => void;
}) => {
  const { text } = useResourceDetailText();
  const record = isRecord(value) ? value : {};
  const useValue = typeof record.use === "string" ? record.use : "";
  const systemValue = typeof record.system === "string" ? record.system : "";
  const identifierValue = typeof record.value === "string" ? record.value : "";
  const typeValue = isRecord(record.type) ? record.type : {};
  const coding = Array.isArray(typeValue.coding) ? typeValue.coding : [];
  const firstCoding =
    coding.length > 0 && isRecord(coding[0]) ? (coding[0] as Record<string, unknown>) : {};
  const typeText = typeof typeValue.text === "string" ? typeValue.text : "";
  const typeSystem = typeof firstCoding.system === "string" ? firstCoding.system : "";
  const typeCode = typeof firstCoding.code === "string" ? firstCoding.code : "";
  const typeDisplay = typeof firstCoding.display === "string" ? firstCoding.display : "";

  const systemOptions = identifierSystems.map((entry) => ({
    value: entry.system,
    label: entry.label,
    searchText: `${entry.label} ${entry.system}`,
  }));
  const useOptions = IDENTIFIER_USE_OPTIONS.map((entry) => ({ value: entry, label: entry }));
  const typeOptions: PopupSearchOption[] = identifierTypeOptions.map((option) => ({
    value: `${option.system ?? ""}|${option.code}`,
    label: formatOptionLabel(option.system, option.code, option.display),
    searchText: `${option.display ?? ""} ${option.system ?? ""} ${option.code}`.trim(),
  }));

  const handleChange = (next: Record<string, unknown>) => onChange(next);

  return (
    <div className="grid gap-3">
      <div className="grid gap-2">
        <Label className="text-xs text-muted-foreground">{text.useOptional}</Label>
        <PopupSearchSelect
          value={useValue}
          options={useOptions}
          placeholder={text.selectValue}
          searchPlaceholder={text.searchUseValues}
          onValueChange={(nextUse) => handleChange({ ...record, use: nextUse || undefined })}
        />
      </div>
      <div className="grid gap-2">
        <Label className="text-xs text-muted-foreground">{text.systemUri}</Label>
        <PopupSearchSelect
          value={systemValue}
          options={systemOptions}
          placeholder={text.selectSystem}
          searchPlaceholder={text.searchSystems}
          onValueChange={(nextSystem) =>
            handleChange({ ...record, system: nextSystem || undefined })
          }
        />
      </div>
      <div className="grid gap-2">
        <Label className="text-xs text-muted-foreground">{text.identifierValue}</Label>
        <Input
          value={identifierValue}
          onChange={(event) =>
            handleChange({ ...record, value: event.target.value || undefined })
          }
        />
      </div>
      {typeOptions.length > 0 ? (
        <div className="grid gap-2">
          <Label className="text-xs text-muted-foreground">{text.selectIdentifierType}</Label>
          <PopupSearchSelect
            value={typeSystem || typeCode ? `${typeSystem}|${typeCode}` : ""}
            options={typeOptions}
            placeholder={text.selectIdentifierType}
            searchPlaceholder={text.searchIdentifierTypes}
            onValueChange={(nextValue) => {
              if (!nextValue) {
                handleChange({ ...record, type: undefined });
                return;
              }
              const [system, code] = nextValue.split("|");
              const match = identifierTypeOptions.find(
                (option) => (option.system ?? "") === system && option.code === code
              );
              const nextCoding = {
                system: system || undefined,
                code: code || undefined,
                display: match?.display,
              };
              const nextType = {
                ...(typeText ? { text: typeText } : {}),
                coding: [nextCoding],
              };
              handleChange({ ...record, type: nextType });
            }}
          />
        </div>
      ) : null}
      <div className="grid gap-2 rounded-md border border-foreground/10 bg-muted/30 px-3 py-3">
        <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Type
        </div>
        <div className="grid gap-2">
          <Input
            value={typeText}
            placeholder={text.typeTextOptional}
            onChange={(event) => {
              const nextType = {
                ...(typeValue ?? {}),
                text: event.target.value || undefined,
                coding: Object.keys(firstCoding).length ? [firstCoding] : undefined,
              };
              handleChange({ ...record, type: nextType });
            }}
          />
          <div className="grid gap-2 md:grid-cols-3">
            <Input
              value={typeSystem}
              placeholder={text.typeSystemOptional}
              onChange={(event) => {
                const nextCoding = { ...firstCoding, system: event.target.value || undefined };
                const nextType = { ...typeValue, coding: [nextCoding] };
                handleChange({ ...record, type: nextType });
              }}
            />
            <Input
              value={typeCode}
              placeholder={text.typeCodeOptional}
              onChange={(event) => {
                const nextCoding = { ...firstCoding, code: event.target.value || undefined };
                const nextType = { ...typeValue, coding: [nextCoding] };
                handleChange({ ...record, type: nextType });
              }}
            />
            <Input
              value={typeDisplay}
              placeholder={text.typeDisplayOptional}
              onChange={(event) => {
                const nextCoding = { ...firstCoding, display: event.target.value || undefined };
                const nextType = { ...typeValue, coding: [nextCoding] };
                handleChange({ ...record, type: nextType });
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

