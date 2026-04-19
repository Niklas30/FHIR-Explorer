import type { ElementDefinition, ElementDefinitionType } from "@/lib/fhir-editor/registry";
import type { CodingOption } from "@/lib/fhir-editor/registry";

export type ProfileSummary = {
  url: string;
  name: string;
  title?: string;
  description?: string;
  type?: string;
  version?: string;
};

export type FieldDefinition = {
  id: string;
  path: string;
  segments: string[];
  label: string;
  min?: number;
  max?: string;
  baseMax?: string;
  type?: ElementDefinitionType[];
  binding?: ElementDefinition["binding"];
  identifierSystems?: Array<{ system: string; label: string; profile?: string; sliceName?: string }>;
  identifierTypeOptions?: CodingOption[];
  choiceOptions?: CodingOption[];
  mustSupport?: boolean;
  short?: string;
  definition?: string;
};

