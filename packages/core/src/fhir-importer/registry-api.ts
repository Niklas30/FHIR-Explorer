/**
 * The slice of an npm-shaped FHIR package registry that dependency
 * resolution needs.
 *
 * The npm-shaped registries answer at `/{id}` with a version map. The ones
 * that carry `dependencies` on every version entry — `packages2.fhir.org` —
 * let the whole tree be resolved before a single tarball is downloaded.
 * Registries that omit them, such as `packages.simplifier.net`, are still
 * usable: `dependencies()` falls back to the manifest inside the tarball.
 */

export type RegistryVersion = {
  version: string;
  fhirVersion?: string;
  description?: string;
  date?: string;
  /** Direct dependencies as `id -> version`. Absent means none declared. */
  dependencies?: Record<string, string>;
  tarball?: string;
};

export type RegistryPackage = {
  name: string;
  description?: string;
  /** Version behind the `latest` tag, when the registry publishes one. */
  latest?: string;
  versions: RegistryVersion[];
};

export type RegistrySearchHit = {
  name: string;
  description?: string;
  fhirVersion?: string;
};

export interface PackageRegistryApi {
  /**
   * Free-text search. Registries that do not implement a catalogue return an
   * empty list rather than throwing — the caller falls back to typing an id.
   */
  search: (query: string) => Promise<RegistrySearchHit[]>;
  /** Metadata for one package, or undefined when the registry does not know it. */
  metadata: (id: string) => Promise<RegistryPackage | undefined>;
  /**
   * Direct dependencies of one version, as `id -> version`.
   *
   * Separate from `metadata` because not every registry publishes them: the
   * answer may cost a tarball download, so it is asked for only about the
   * versions the planner actually settled on. Empty means none declared.
   */
  dependencies: (id: string, version: string) => Promise<Record<string, string>>;
  /** Where the tarball for a specific version lives. */
  tarballUrl: (id: string, version: string) => string;
}
