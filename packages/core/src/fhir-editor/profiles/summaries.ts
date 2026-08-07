import type { FhirRegistry } from "@/lib/fhir-editor/registry";
import type { ProfileSummary } from "@/lib/fhir-editor/profiles/types";

export const getProfileSummaries = (registry: FhirRegistry): ProfileSummary[] => {
  return registry.structureDefinitions
    .filter(
      (definition) =>
        definition.kind === "resource" &&
        definition.abstract !== true &&
        typeof definition.url === "string" &&
        Boolean(definition.type)
    )
    .map((definition) => ({
      url: definition.url as string,
      name: definition.name ?? definition.id ?? definition.url ?? "Profile",
      title: definition.title,
      description: definition.description as string | undefined,
      type: definition.type,
      version: definition.version as string | undefined,
    }))
    .sort((a, b) => (a.title ?? a.name).localeCompare(b.title ?? b.name));
};

