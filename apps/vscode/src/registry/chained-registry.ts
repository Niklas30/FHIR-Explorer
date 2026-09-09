import { compareVersions } from "@/registry/version";
import type {
  PackageRegistryApi,
  RegistryPackage,
  RegistrySearchHit,
  RegistryVersion,
} from "@/registry/types";

/**
 * Several registries behind one `PackageRegistryApi`.
 *
 * No single registry has everything. `packages2.fhir.org` publishes each
 * version's `dependencies`, which is what makes resolve-before-download
 * possible, but it mirrors only a slice of the versions a publisher ever
 * released — enough that a package pinning an older dependency, as the
 * gematik ISiP packages do, cannot be resolved from it alone. Simplifier has
 * those versions but omits `dependencies`.
 *
 * So the version lists are merged rather than one registry being picked: a
 * version is taken from the first registry that lists it, and the ones behind
 * it fill in only what that entry is missing.
 */

const mergeVersion = (
  preferred: RegistryVersion,
  fallback: RegistryVersion
): RegistryVersion => ({
  ...preferred,
  fhirVersion: preferred.fhirVersion ?? fallback.fhirVersion,
  description: preferred.description ?? fallback.description,
  date: preferred.date ?? fallback.date,
  // A later registry that publishes dependencies saves the earlier one's
  // entry a tarball download, so take them wherever they turn up.
  dependencies: preferred.dependencies ?? fallback.dependencies,
  tarball: preferred.tarball ?? fallback.tarball,
});

export class ChainedRegistry implements PackageRegistryApi {
  constructor(private readonly registries: PackageRegistryApi[]) {}

  /**
   * Every catalogue's hits, first registry's wording winning on duplicates.
   *
   * One catalogue being down must not empty the list, so failures are dropped
   * rather than propagated — the same bargain `RegistryClient.search` makes.
   */
  async search(query: string): Promise<RegistrySearchHit[]> {
    const results = await Promise.allSettled(
      this.registries.map((registry) => registry.search(query))
    );

    const hits = new Map<string, RegistrySearchHit>();
    for (const result of results) {
      if (result.status !== "fulfilled") continue;
      for (const hit of result.value) {
        if (!hits.has(hit.name)) hits.set(hit.name, hit);
      }
    }
    return [...hits.values()].sort((a, b) => a.name.localeCompare(b.name));
  }

  async metadata(id: string): Promise<RegistryPackage | undefined> {
    const found = await this.lookup(id);
    if (found.length === 0) return undefined;

    const versions = new Map<string, RegistryVersion>();
    for (const { metadata } of found) {
      for (const version of metadata.versions) {
        const existing = versions.get(version.version);
        versions.set(
          version.version,
          existing ? mergeVersion(existing, version) : version
        );
      }
    }

    return {
      name: found[0].metadata.name,
      description: found.find((entry) => entry.metadata.description)?.metadata.description,
      // Registries disagree about `latest` when one of them lags behind the
      // publisher. The newest wins, which is what "latest" is asked for.
      latest: found
        .map((entry) => entry.metadata.latest)
        .filter((value): value is string => Boolean(value))
        .sort((a, b) => compareVersions(b, a))[0],
      versions: [...versions.values()].sort((a, b) =>
        compareVersions(b.version, a.version)
      ),
    };
  }

  /**
   * Asked of the first registry that lists this version, because that is the
   * one whose tarball url the fallback would download.
   */
  async dependencies(id: string, version: string): Promise<Record<string, string>> {
    const owner = await this.ownerOf(id, version);
    return owner ? await owner.dependencies(id, version) : {};
  }

  /**
   * Synchronous by contract, so this cannot consult the registries. The
   * planner carries the tarball url the metadata declared and only falls back
   * to this when a registry published none; the first registry is then the
   * best guess available.
   */
  tarballUrl(id: string, version: string): string {
    return this.registries[0].tarballUrl(id, version);
  }

  /** Metadata from every registry that knows the package, in configured order. */
  private async lookup(
    id: string
  ): Promise<{ registry: PackageRegistryApi; metadata: RegistryPackage }[]> {
    const results = await Promise.allSettled(
      this.registries.map((registry) => registry.metadata(id))
    );

    const found: { registry: PackageRegistryApi; metadata: RegistryPackage }[] = [];
    let failures = 0;
    for (const [index, result] of results.entries()) {
      if (result.status === "rejected") {
        failures += 1;
        continue;
      }
      if (result.value) {
        found.push({ registry: this.registries[index], metadata: result.value });
      }
    }

    // A registry answering "no such package" is an answer; every registry
    // failing to answer is not, and must not be reported as a missing package.
    if (found.length === 0 && failures === this.registries.length) {
      const rejected = results.find(
        (result): result is PromiseRejectedResult => result.status === "rejected"
      );
      throw rejected?.reason ?? new Error(`No registry could be reached for ${id}.`);
    }
    return found;
  }

  private async ownerOf(
    id: string,
    version: string
  ): Promise<PackageRegistryApi | undefined> {
    const found = await this.lookup(id);
    return found.find((entry) =>
      entry.metadata.versions.some((candidate) => candidate.version === version)
    )?.registry;
  }
}
