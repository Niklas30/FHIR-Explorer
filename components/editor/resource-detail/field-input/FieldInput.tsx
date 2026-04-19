"use client";

import { useState } from "react";
import { useResourceDetailText } from "@/components/editor/resource-detail/text";
import { UnknownValueEditor } from "@/components/editor/resource-detail/UnknownValueEditor";
import { isReferenceValue } from "@/components/editor/resource-detail/utils";
import { CodingFieldInput } from "@/components/editor/resource-detail/field-input/CodingFieldInput";
import { IdentifierFieldInput } from "@/components/editor/resource-detail/field-input/IdentifierFieldInput";
import { PrimitiveFieldInput } from "@/components/editor/resource-detail/field-input/PrimitiveFieldInput";
import { ReferenceFieldInput } from "@/components/editor/resource-detail/field-input/ReferenceFieldInput";
import type { FieldInputProps } from "@/components/editor/resource-detail/field-input/types";

export const FieldInput = ({
  kind,
  value,
  options,
  referenceOptions,
  identifierSystems,
  identifierTypeOptions,
  onChange,
  onRemove,
  brokenReference,
  allDatasetResources = [],
  onOpenResource,
}: FieldInputProps) => {
  const { text } = useResourceDetailText();
  const [includeReferenceDisplay, setIncludeReferenceDisplay] = useState(false);

  const supportsRemove =
    typeof onRemove === "function" &&
    kind !== "Identifier" &&
    kind !== "Coding" &&
    kind !== "CodeableConcept";

  return (
    <div className="grid gap-2">
      {kind === "Identifier" ? (
        <IdentifierFieldInput
          value={value}
          identifierSystems={identifierSystems ?? []}
          identifierTypeOptions={identifierTypeOptions ?? []}
          onChange={onChange}
        />
      ) : kind === "Reference" || isReferenceValue(value) ? (
        <ReferenceFieldInput
          value={value}
          referenceOptions={referenceOptions}
          allDatasetResources={allDatasetResources}
          onOpenResource={onOpenResource}
          includeReferenceDisplay={includeReferenceDisplay}
          setIncludeReferenceDisplay={setIncludeReferenceDisplay}
          onChange={onChange}
          brokenReference={brokenReference}
        />
      ) : kind === "Coding" || kind === "CodeableConcept" ? (
        <CodingFieldInput kind={kind} value={value} options={options} onChange={onChange} />
      ) : kind === "unknown" ? (
        <UnknownValueEditor value={value} onChange={onChange} />
      ) : (
        <PrimitiveFieldInput kind={kind} value={value} options={options} onChange={onChange} />
      )}
      {supportsRemove ? (
        <button
          type="button"
          onClick={onRemove}
          className="text-xs text-destructive hover:text-destructive/80"
        >
          {text.removeValue}
        </button>
      ) : null}
    </div>
  );
};

