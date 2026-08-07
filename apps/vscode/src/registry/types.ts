/**
 * The slice of the FHIR package registry the extension talks to.
 *
 * `packages.fhir.org` answers in an npm-shaped format and — crucially —
 * carries `dependencies` on every version entry. That is what lets the whole
 * dependency tree be resolved before a single tarball is downloaded, instead
 * of the web app's "download, discover something is missing, repeat".
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
  /** Where the tarball for a specific version lives. */
  tarballUrl: (id: string, version: string) => string;
}
