import type { PackageId, PackageVersion } from "./types";

export type RegistryStrategy = {
  name: string;
  buildDownloadUrl: (id: PackageId, version: PackageVersion) => string;
};

export class FhirPackageRegistry implements RegistryStrategy {
  name: string;
  /**
   * Whether the browser may fetch this registry's archives itself.
   *
   * Only registries that answer archive requests with CORS headers qualify.
   * `packages2.fhir.org` does not: its download url redirects to a host that
   * sends none, so a `fetch` there fails while a plain link still works.
   */
  readonly fetchable: boolean;
  private baseUrl: string;

  constructor(name: string, baseUrl: string, options: { fetchable?: boolean } = {}) {
    this.name = name;
    this.baseUrl = baseUrl.replace(/\/$/, "");
    this.fetchable = options.fetchable ?? false;
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
  simplifier: new FhirPackageRegistry("Simplifier", SIMPLIFIER_REGISTRY_BASE, {
    fetchable: true,
  }),
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
  /** Whether the browser may fetch this entry's archive itself. */
  fetchable: boolean;
  fhirVersion?: string;
  description?: string;
  /** Download url the registry declared, which need not be on its own host. */
  tarball?: string;
};

export type PackageAvailability = {
  id: PackageId;
  /**
   * Every listing of every version, in chain order. A version carried by two
   * registries appears twice on purpose: the first is the one to link to, and
   * the first fetchable one is the one the browser can import by itself, and
   * those are not always the same registry.
   */
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
  registry: FhirPackageRegistry
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
        registry: registry.name,
        fetchable: registry.fetchable,
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
        return readVersions(await response.json(), registry);
      } catch {
        return null;
      }
    })
  );

  return {
    id,
    versions: responses.flatMap((response) => response?.versions ?? []),
    latest: responses.find((response) => response?.latest)?.latest,
    offline: responses.every((response) => response === null),
  };
};

/** The distinct versions on offer, in chain order. */
export const listAvailableVersions = (
  availability: PackageAvailability
): PackageVersion[] =>
  Array.from(new Set(availability.versions.map((entry) => entry.version)));

const urlOf = (
  entry: RegistryVersionInfo,
  id: PackageId,
  version: PackageVersion,
  chain: FhirPackageRegistry[]
): string => {
  const owner = chain.find((registry) => registry.name === entry.registry) ?? chain[0];
  return entry.tarball ?? owner.buildDownloadUrl(id, version);
};

export type ResolvedSource = {
  url: string;
  registry: string;
  /** False when no registry in the chain lists the version. */
  found: boolean;
};

/**
 * Where a version can be downloaded from, for the link handed to the user.
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
): Promise<ResolvedSource> => {
  const availability = await fetchPackageAvailability(id, chain, fetchImpl);
  const match = availability.versions.find((entry) => entry.version === version);

  if (!match) {
    return { url: chain[0].buildDownloadUrl(id, version), registry: chain[0].name, found: false };
  }
  return { url: urlOf(match, id, version, chain), registry: match.registry, found: true };
};

/**
 * Where a version can be fetched from by the browser itself.
 *
 * Deliberately not the same lookup as the download link: the registry that
 * comes first in the chain may serve archives without CORS headers, and then
 * only a later one can be read from script. Undefined means the user has to
 * download and upload the package by hand after all.
 */
export const resolveImportUrl = async (
  id: PackageId,
  version: PackageVersion,
  chain: FhirPackageRegistry[] = REGISTRY_CHAIN,
  fetchImpl: typeof fetch = fetch
): Promise<ResolvedSource | undefined> => {
  const availability = await fetchPackageAvailability(id, chain, fetchImpl);
  const match = availability.versions.find(
    (entry) => entry.version === version && entry.fetchable
  );
  if (!match) return undefined;
  return { url: urlOf(match, id, version, chain), registry: match.registry, found: true };
};
