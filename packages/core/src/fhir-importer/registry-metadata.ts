import type { RegistryPackage, RegistryVersion } from "./registry-api";

/**
 * Reading the metadata an npm-shaped FHIR package registry answers at `/{id}`.
 *
 * Shared by the dependency resolver and the browser importer, so both read
 * the same fields the same way: registries differ in what they fill in, and
 * a field one of them omits must come out as undefined, not as a guess.
 */

export const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value && typeof value === "object" && !Array.isArray(value));

export const asString = (value: unknown): string | undefined =>
  typeof value === "string" && value.trim() ? value.trim() : undefined;

export const asDependencies = (value: unknown): Record<string, string> | undefined => {
  if (!isRecord(value)) return undefined;
  const entries = Object.entries(value).filter(
    (entry): entry is [string, string] => typeof entry[1] === "string"
  );
  return entries.length > 0 ? Object.fromEntries(entries) : undefined;
};

export const parseRegistryVersion = (version: string, raw: unknown): RegistryVersion => {
  const record = isRecord(raw) ? raw : {};
  const dist = isRecord(record.dist) ? record.dist : undefined;
  return {
    version,
    fhirVersion: asString(record.fhirVersion),
    description: asString(record.description),
    date: asString(record.date),
    dependencies: asDependencies(record.dependencies),
    tarball: asString(dist?.tarball) ?? asString(record.url),
  };
};

export const parseRegistryPackage = (id: string, raw: unknown): RegistryPackage | undefined => {
  if (!isRecord(raw)) return undefined;
  const versions = isRecord(raw.versions) ? raw.versions : {};
  const distTags = isRecord(raw["dist-tags"]) ? raw["dist-tags"] : undefined;

  return {
    name: asString(raw.name) ?? id,
    description: asString(raw.description),
    latest: asString(distTags?.latest),
    versions: Object.entries(versions).map(([version, entry]) =>
      parseRegistryVersion(version, entry)
    ),
  };
};
