import type { AuthoredResourceKind } from "@fhir-explorer/core/projects/types";

/**
 * On-disk layout of a project.
 *
 * We follow the IG Publisher convention rather than inventing one, so the same
 * folder works with the publisher, Sushi output, Firely tooling and whatever
 * else the user already runs on it.
 */
export const RESOURCE_DIRECTORIES = [
  "input/profiles",
  "input/extensions",
  "input/vocabulary",
  "input/examples",
] as const;

/** Where a newly created resource of the given kind is written. */
export const directoryForKind = (kind: AuthoredResourceKind): string => {
  switch (kind) {
    case "profile":
      return "input/profiles";
    case "extension":
      return "input/extensions";
    case "valueset":
    case "codesystem":
      return "input/vocabulary";
    case "example":
      return "input/examples";
  }
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value && typeof value === "object" && !Array.isArray(value));

/**
 * Classify a resource by its content, not by the folder it sits in — folders
 * drift, and a file the user moved by hand should still be understood.
 */
export const kindOfResource = (content: unknown): AuthoredResourceKind => {
  if (!isRecord(content)) return "example";
  switch (content.resourceType) {
    case "StructureDefinition":
      return content.type === "Extension" ? "extension" : "profile";
    case "ValueSet":
      return "valueset";
    case "CodeSystem":
      return "codesystem";
    default:
      return "example";
  }
};

/**
 * Reduce an id to something a file name can carry.
 *
 * Ids come out of resource content, so they are untrusted input: separators
 * are replaced rather than kept, and leading dots are dropped so a value like
 * `../../etc/passwd` cannot turn into a path at all.
 */
const slugify = (value: string): string =>
  value
    .replace(/[^A-Za-z0-9._-]+/g, "-")
    .replace(/\.{2,}/g, ".")
    .slice(0, 120)
    .replace(/^[.\-]+|[.\-]+$/g, "");

/**
 * `StructureDefinition-MyPatient.json`, the name the IG Publisher expects.
 * Falls back to the resource type alone when the resource has no id yet.
 */
export const fileNameForResource = (
  resourceType: string,
  id: string | undefined
): string => {
  const slug = slugify(id ?? "");
  return slug ? `${resourceType}-${slug}.json` : `${resourceType}.json`;
};

/** Two spaces, trailing newline — matches what the publisher and Sushi emit. */
export const serializeResource = (content: Record<string, unknown>): string =>
  `${JSON.stringify(content, null, 2)}\n`;
