import { getStructureDefinitionByCanonical } from "@/lib/fhir-editor/registry";
import { getProfileSummaries } from "@/lib/fhir-editor/profiles";
import type { SchemaContext, SchemaNode } from "@/lib/fhir-editor/schema";

/** A resource type/profile a new reference target can be created as. */
export type ReferenceCreationTarget = {
  resourceType: string;
  /** Canonical of the profile the new resource should conform to. */
  profileUrl?: string;
  label: string;
};

const dedupeTargets = (targets: ReferenceCreationTarget[]) => {
  const seen = new Set<string>();
  return targets.filter((target) => {
    const key = target.profileUrl ?? target.resourceType;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

/**
 * Resolves the concrete resource types/profiles a Reference element may
 * point to, for creating a missing target in place. Elements without
 * targetProfiles (Reference(Any)) fall back to all instantiable profiles
 * known to the registry.
 */
export const getReferenceCreationTargets = (
  node: SchemaNode,
  ctx: SchemaContext
): ReferenceCreationTarget[] => {
  const targets: ReferenceCreationTarget[] = [];
  let hasAnyTarget = false;

  for (const type of node.types) {
    if (type.code !== "Reference") continue;
    for (const canonical of type.targetProfile ?? []) {
      if (!canonical) continue;
      hasAnyTarget = true;
      const definition = getStructureDefinitionByCanonical(ctx.registry, canonical);
      if (definition?.type && definition.type !== "Resource") {
        targets.push({
          resourceType: definition.type,
          profileUrl: definition.url,
          label: definition.title ?? definition.name ?? definition.type,
        });
        continue;
      }
      const inferred = canonical.split("|")[0].split("/").pop();
      if (inferred && inferred !== "Resource") {
        targets.push({ resourceType: inferred, label: inferred });
      }
    }
  }

  if (!hasAnyTarget || targets.length === 0) {
    // Reference(Any): offer every instantiable profile from the registry.
    return getProfileSummaries(ctx.registry).map((summary) => ({
      resourceType: summary.type as string,
      profileUrl: summary.url,
      label: summary.title ?? summary.name,
    }));
  }

  return dedupeTargets(targets);
};
