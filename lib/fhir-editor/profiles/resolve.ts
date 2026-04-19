import type { FhirRegistry, StructureDefinition } from "@/lib/fhir-editor/registry";
import { getStructureDefinitionByCanonical, normalizeCanonical } from "@/lib/fhir-editor/registry";

export const resolveProfileForResource = (
  resource: Record<string, unknown>,
  registry: FhirRegistry
): StructureDefinition | null => {
  const meta = resource.meta as { profile?: string[] } | undefined;
  const metaProfile = Array.isArray(meta?.profile)
    ? meta?.profile.find((value) => typeof value === "string")
    : undefined;
  if (metaProfile) {
    const profile = getStructureDefinitionByCanonical(registry, metaProfile);
    if (profile) return profile;
  }
  const resourceType = resource.resourceType as string | undefined;
  if (!resourceType) return null;
  const base = `http://hl7.org/fhir/StructureDefinition/${resourceType}`;
  return getStructureDefinitionByCanonical(registry, base) ?? null;
};

export const resolveProfileType = (canonical: string | undefined, registry: FhirRegistry) => {
  if (!canonical) return undefined;
  const profile = getStructureDefinitionByCanonical(registry, canonical);
  if (profile?.type) return profile.type;
  const normalized = normalizeCanonical(canonical);
  const last = normalized.split("/").pop();
  return last;
};

