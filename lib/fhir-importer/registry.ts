import type { PackageId, PackageVersion } from "./types";

export type RegistryStrategy = {
  name: string;
  buildDownloadUrl: (id: PackageId, version: PackageVersion) => string;
};

export class FhirPackageRegistry implements RegistryStrategy {
  name: string;
  private baseUrl: string;

  constructor(name: string, baseUrl: string) {
    this.name = name;
    this.baseUrl = baseUrl.replace(/\/$/, "");
  }

  buildDownloadUrl(id: PackageId, version: PackageVersion) {
    return `${this.baseUrl}/${encodeURIComponent(id)}/${encodeURIComponent(version)}`;
  }

  buildMetadataUrl(id: PackageId) {
    return `${this.baseUrl}/${encodeURIComponent(id)}`;
  }
}

// Default is HL7 terminology server per acceptance criteria.
export const DEFAULT_REGISTRY_BASE = "https://r4.terminology.hl7.org";
export const PACKAGES2_REGISTRY_BASE = "https://packages2.fhir.org/packages";
export const SIMPLIFIER_REGISTRY_BASE = "https://packages.simplifier.net";

export const registryStrategies = {
  hl7: new FhirPackageRegistry("HL7 Terminology", DEFAULT_REGISTRY_BASE),
  packages2: new FhirPackageRegistry("FHIR Packages2", PACKAGES2_REGISTRY_BASE),
  simplifier: new FhirPackageRegistry("Simplifier", SIMPLIFIER_REGISTRY_BASE),
};

export const defaultRegistry = registryStrategies.packages2;

/**
 * Where a package version is looked for, in order.
 *
 * No single registry has every version. `packages2.fhir.org` mirrors only a
 * slice of what publishers released: a package pinning an older dependency —
 * as the gematik ISiP packages pin `de.basisprofil.r4` 1.3.2 — gets a 404
 * there, so the download link handed to the user led nowhere. Simplifier
 * keeps the full history, so it is asked whenever the first registry comes up
 * short.
 */
export const REGISTRY_CHAIN: FhirPackageRegistry[] = [
  registryStrategies.packages2,
  registryStrategies.simplifier,
];

export type RegistryVersionInfo = {
  version: PackageVersion;
  /** Registry the version was found in — the one whose download url works. */
  registry: string;
  fhirVersion?: string;
  description?: string;
  /** Download url the registry declared, which need not be on its own host. */
  tarball?: string;
};

export type PackageAvailability = {
  id: PackageId;
  /** Every version any registry in the chain lists, newest-declared first. */
  versions: RegistryVersionInfo[];
  /** Version behind the `latest` tag, when a registry publishes one. */
  latest?: PackageVersion;
  /** True when no registry could be reached, as opposed to none having it. */
  offline: boolean;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value && typeof value === "object" && !Array.isArray(value));

const asString = (value: unknown): string | undefined =>
  typeof value === "string" && value.trim() ? value.trim() : undefined;

const readVersions = (
  raw: unknown,
  registryName: string
): { versions: RegistryVersionInfo[]; latest?: string } => {
  if (!isRecord(raw)) return { versions: [] };
  const versions = isRecord(raw.versions) ? raw.versions : {};
  const distTags = isRecord(raw["dist-tags"]) ? raw["dist-tags"] : undefined;

  return {
    latest: asString(distTags?.latest),
    versions: Object.entries(versions).map(([version, entry]) => {
      const record = isRecord(entry) ? entry : {};
      const dist = isRecord(record.dist) ? record.dist : undefined;
      return {
        version,
        registry: registryName,
        fhirVersion: asString(record.fhirVersion),
        description: asString(record.description),
        tarball: asString(dist?.tarball) ?? asString(record.url),
      };
    }),
  };
};

/**
 * Ask every registry in the chain what versions of `id` it has.
 *
 * Both registries answer with CORS headers, so this runs in the browser
 * without a proxy. A registry that fails is skipped rather than failing the
 * lookup — one of them being down should not hide the other's answer.
 */
export const fetchPackageAvailability = async (
  id: PackageId,
  chain: FhirPackageRegistry[] = REGISTRY_CHAIN,
  fetchImpl: typeof fetch = fetch
): Promise<PackageAvailability> => {
  const responses = await Promise.all(
    chain.map(async (registry) => {
      try {
        const response = await fetchImpl(registry.buildMetadataUrl(id));
        if (!response.ok) return null;
        return readVersions(await response.json(), registry.name);
      } catch {
        return null;
      }
    })
  );

  const seen = new Map<string, RegistryVersionInfo>();
  for (const response of responses) {
    if (!response) continue;
    for (const entry of response.versions) {
      // The first registry that lists a version owns it: its download url is
      // the one the rest of the chain would only duplicate.
      if (!seen.has(entry.version)) seen.set(entry.version, entry);
    }
  }

  return {
    id,
    versions: [...seen.values()],
    latest: responses.find((response) => response?.latest)?.latest,
    offline: responses.every((response) => response === null),
  };
};

/**
 * The url a specific version can actually be downloaded from.
 *
 * Falls back to the first registry's url when nothing could be looked up, so
 * a link is always offered — a stale link the user can retry is more use than
 * no link at all.
 */
export const resolveDownloadUrl = async (
  id: PackageId,
  version: PackageVersion,
  chain: FhirPackageRegistry[] = REGISTRY_CHAIN,
  fetchImpl: typeof fetch = fetch
): Promise<{ url: string; registry: string; found: boolean }> => {
  const availability = await fetchPackageAvailability(id, chain, fetchImpl);
  const match = availability.versions.find((entry) => entry.version === version);

  if (!match) {
    return {
      url: chain[0].buildDownloadUrl(id, version),
      registry: chain[0].name,
      found: false,
    };
  }

  const owner = chain.find((registry) => registry.name === match.registry) ?? chain[0];
  return {
    url: match.tarball ?? owner.buildDownloadUrl(id, version),
    registry: match.registry,
    found: true,
  };
};
