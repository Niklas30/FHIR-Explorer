import { extractArchiveEntries } from "@fhir-explorer/core/fhir-importer/parser";
import { HttpError, type HttpClient } from "@fhir-explorer/core/ports";
import type {
  PackageRegistryApi,
  RegistryPackage,
  RegistrySearchHit,
  RegistryVersion,
} from "@/registry/types";

/**
 * Client for an npm-shaped FHIR package registry.
 *
 * Metadata is cached for the session: resolving a dependency tree asks for the
 * same core packages over and over, and every one of those is a round trip.
 */

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value && typeof value === "object" && !Array.isArray(value));

const asString = (value: unknown): string | undefined =>
  typeof value === "string" && value.trim() ? value.trim() : undefined;

const asDependencies = (value: unknown): Record<string, string> | undefined => {
  if (!isRecord(value)) return undefined;
  const entries = Object.entries(value).filter(
    (entry): entry is [string, string] => typeof entry[1] === "string"
  );
  return entries.length > 0 ? Object.fromEntries(entries) : undefined;
};

const toVersion = (version: string, raw: unknown): RegistryVersion => {
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

const toPackage = (id: string, raw: unknown): RegistryPackage | undefined => {
  if (!isRecord(raw)) return undefined;
  const versions = isRecord(raw.versions) ? raw.versions : {};
  const distTags = isRecord(raw["dist-tags"]) ? raw["dist-tags"] : undefined;

  return {
    name: asString(raw.name) ?? id,
    description: asString(raw.description),
    latest: asString(distTags?.latest),
    versions: Object.entries(versions).map(([version, entry]) =>
      toVersion(version, entry)
    ),
  };
};

/**
 * Read `dependencies` out of the manifest inside a package archive.
 *
 * The registries that do not publish dependencies in their metadata still
 * ship them in `package/package.json`, so the archive is the source of last
 * resort. Only the manifest is wanted here, but the archive is a tar: it has
 * to be unpacked to reach it.
 */
const dependenciesFromArchive = async (buffer: ArrayBuffer): Promise<Record<string, string>> => {
  const entries = await extractArchiveEntries(buffer);
  const manifest = entries
    .filter((entry) => entry.path.split("/").pop() === "package.json")
    // The shallowest manifest is the package's own, not one of a nested file.
    .sort((a, b) => a.path.split("/").length - b.path.split("/").length)[0];
  if (!manifest) return {};

  const parsed: unknown = JSON.parse(new TextDecoder().decode(manifest.data));
  if (!isRecord(parsed)) return {};
  return asDependencies(parsed.dependencies) ?? {};
};

/**
 * One registry, whose metadata and catalogue may live on different hosts:
 * `packages2.fhir.org` serves metadata but has no catalogue, while
 * `packages.fhir.org` answers `/catalog?op=find`. Search is therefore
 * optional — a registry without a catalogue simply returns no hits.
 *
 * Several of these are combined by {@link ChainedRegistry}; nothing here
 * knows about the others.
 */
export class RegistryClient implements PackageRegistryApi {
  private readonly cache = new Map<string, Promise<RegistryPackage | undefined>>();
  private readonly dependencyCache = new Map<string, Promise<Record<string, string>>>();
  private readonly baseUrl: string;
  private readonly searchUrl: string | undefined;

  constructor(
    private readonly http: HttpClient,
    baseUrl: string,
    searchUrl?: string
  ) {
    this.baseUrl = baseUrl.replace(/\/+$/, "");
    this.searchUrl = searchUrl?.trim() ? searchUrl.replace(/\/+$/, "") : undefined;
  }

  async search(query: string): Promise<RegistrySearchHit[]> {
    const trimmed = query.trim();
    if (trimmed.length < 2 || !this.searchUrl) return [];

    try {
      const body = await this.http.getJson<unknown>(
        `${this.searchUrl}/catalog?op=find&name=${encodeURIComponent(trimmed)}`
      );
      if (!Array.isArray(body)) return [];
      return body
        .filter(isRecord)
        .map((entry) => ({
          name: asString(entry.Name) ?? asString(entry.name) ?? "",
          description: asString(entry.Description) ?? asString(entry.description),
          fhirVersion: asString(entry.FhirVersion) ?? asString(entry.fhirVersion),
        }))
        .filter((hit) => hit.name.length > 0);
    } catch {
      // Not every registry has a catalogue. Returning nothing lets the caller
      // fall back to entering an id by hand instead of failing the command.
      return [];
    }
  }

  metadata(id: string): Promise<RegistryPackage | undefined> {
    const cached = this.cache.get(id);
    if (cached) return cached;

    const request = (async () => {
      try {
        const body = await this.http.getJson<unknown>(
          `${this.baseUrl}/${encodeURIComponent(id)}`
        );
        return toPackage(id, body);
      } catch (error) {
        // Only a 404 means the package does not exist. Swallowing a dropped
        // connection here would tell the user their dependency is unknown,
        // which sends them looking for the wrong problem.
        if (error instanceof HttpError && error.status === 404) return undefined;
        this.cache.delete(id); // transient — do not poison the cache
        throw error;
      }
    })();

    this.cache.set(id, request);
    return request;
  }

  /**
   * What `id@version` depends on.
   *
   * Metadata first; when this registry does not publish dependencies, the
   * archive is fetched and its manifest read. That download is not kept —
   * the installer fetches the archive again when the user confirms the plan —
   * because holding every core package in memory for the length of a session
   * costs far more than re-downloading the handful of packages that need this.
   */
  dependencies(id: string, version: string): Promise<Record<string, string>> {
    const key = `${id}@${version}`;
    const cached = this.dependencyCache.get(key);
    if (cached) return cached;

    const request = (async () => {
      const metadata = await this.metadata(id);
      const entry = metadata?.versions.find((candidate) => candidate.version === version);
      if (!entry) return {};
      if (entry.dependencies) return entry.dependencies;

      try {
        const buffer = await this.http.getArrayBuffer(
          entry.tarball ?? this.tarballUrl(id, version)
        );
        return await dependenciesFromArchive(buffer);
      } catch {
        // An unreachable archive must not look like "depends on nothing", but
        // there is nothing better to report from here: the planner sees an
        // empty set and the install fails loudly on the download instead.
        this.dependencyCache.delete(key);
        return {};
      }
    })();

    this.dependencyCache.set(key, request);
    return request;
  }

  tarballUrl(id: string, version: string): string {
    return `${this.baseUrl}/${encodeURIComponent(id)}/${encodeURIComponent(version)}`;
  }
}
