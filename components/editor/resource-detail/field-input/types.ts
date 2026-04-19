import type { DatasetResource } from "@/lib/datasets/content";

export type FieldKind =
  | "string"
  | "markdown"
  | "boolean"
  | "number"
  | "date"
  | "dateTime"
  | "time"
  | "code"
  | "uri"
  | "url"
  | "Identifier"
  | "Coding"
  | "CodeableConcept"
  | "Reference"
  | "unknown";

export type FieldInputProps = {
  kind: FieldKind;
  value: unknown;
  options: Array<{ system?: string; code: string; display?: string }>;
  referenceOptions: DatasetResource[];
  identifierSystems?: Array<{ system: string; label: string }>;
  identifierTypeOptions?: Array<{ system?: string; code: string; display?: string }>;
  onChange: (value: unknown) => void;
  onRemove?: () => void;
  brokenReference?: string | null;
  allDatasetResources?: DatasetResource[];
  onOpenResource?: (resourceId: string) => void;
};

