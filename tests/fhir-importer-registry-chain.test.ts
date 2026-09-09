import { describe, expect, it, vi } from "vitest";
import {
  FhirPackageRegistry,
  fetchPackageAvailability,
  listAvailableVersions,
  listSourcesFor,
  resolveDownloadUrl,
  resolveImportUrl,
} from "@/lib/fhir-importer/registry";

/**
 * The two registries the chain exists for, in miniature: a mirror carrying
 * only recent versions, and the publisher's own registry with the history.
 */
const mirror = new FhirPackageRegistry("Mirror", "https://mirror.example/packages");
// Only the second one answers archive requests with CORS headers, so only it
// can be read by the browser — exactly the split the real chain has.
const full = new FhirPackageRegistry("Full", "https://full.example", { fetchable: true });
const chain = [mirror, full];

const stubFetch = (bodies: Record<string, unknown>) =>
  vi.fn(async (url: string | URL | Request) => {
    const body = bodies[String(url)];
    if (!body) return new Response("not found", { status: 404 });
    return new Response(JSON.stringify(body), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }) as unknown as typeof fetch;

const metadata = (versions: Record<string, unknown>, latest?: string) => ({
  name: "de.basisprofil.r4",
  ...(latest ? { "dist-tags": { latest } } : {}),
  versions,
});

describe("registry chain", () => {
  it("lists versions from every registry, not just the first", async () => {
    const availability = await fetchPackageAvailability(
      "de.basisprofil.r4",
      chain,
      stubFetch({
        "https://mirror.example/packages/de.basisprofil.r4": metadata({ "1.5.0": {} }, "1.5.0"),
        "https://full.example/de.basisprofil.r4": metadata({ "1.5.0": {}, "1.3.2": {} }),
      })
    );

    expect(listAvailableVersions(availability).sort()).toEqual(["1.3.2", "1.5.0"]);
    expect(availability.offline).toBe(false);
  });

  it("links a version the mirror lacks to the registry that has it", async () => {
    const link = await resolveDownloadUrl(
      "de.basisprofil.r4",
      "1.3.2",
      chain,
      stubFetch({
        "https://mirror.example/packages/de.basisprofil.r4": metadata({ "1.5.0": {} }),
        "https://full.example/de.basisprofil.r4": metadata({
          "1.3.2": { dist: { tarball: "https://full.example/de.basisprofil.r4/1.3.2" } },
        }),
      })
    );

    expect(link).toEqual({
      url: "https://full.example/de.basisprofil.r4/1.3.2",
      registry: "Full",
      found: true,
    });
  });

  it("keeps the first registry's version when both carry it", async () => {
    const link = await resolveDownloadUrl(
      "de.basisprofil.r4",
      "1.5.0",
      chain,
      stubFetch({
        "https://mirror.example/packages/de.basisprofil.r4": metadata({ "1.5.0": {} }),
        "https://full.example/de.basisprofil.r4": metadata({ "1.5.0": {} }),
      })
    );

    expect(link.registry).toBe("Mirror");
    expect(link.url).toBe("https://mirror.example/packages/de.basisprofil.r4/1.5.0");
  });

  it("still offers a link, marked unfound, when no registry lists the version", async () => {
    const link = await resolveDownloadUrl(
      "de.basisprofil.r4",
      "9.9.9",
      chain,
      stubFetch({
        "https://mirror.example/packages/de.basisprofil.r4": metadata({ "1.5.0": {} }),
        "https://full.example/de.basisprofil.r4": metadata({ "1.5.0": {} }),
      })
    );

    expect(link.found).toBe(false);
    expect(link.url).toBe("https://mirror.example/packages/de.basisprofil.r4/9.9.9");
  });

  it("answers from the registries that are up when one is unreachable", async () => {
    const failing = vi.fn(async (url: string | URL | Request) => {
      if (String(url).startsWith("https://mirror.example")) throw new Error("network down");
      return new Response(JSON.stringify(metadata({ "1.3.2": {} })), { status: 200 });
    }) as unknown as typeof fetch;

    const availability = await fetchPackageAvailability("de.basisprofil.r4", chain, failing);

    expect(listAvailableVersions(availability)).toEqual(["1.3.2"]);
    expect(availability.offline).toBe(false);
  });

  it("imports from a registry the browser may read, not the first one", async () => {
    const bodies = {
      "https://mirror.example/packages/de.basisprofil.r4": metadata({ "1.5.0": {} }),
      "https://full.example/de.basisprofil.r4": metadata({ "1.5.0": {} }),
    };

    // Both carry it, so the link points at the mirror — but the mirror serves
    // archives without CORS headers, so the import has to come from the other.
    const link = await resolveDownloadUrl("de.basisprofil.r4", "1.5.0", chain, stubFetch(bodies));
    const source = await resolveImportUrl("de.basisprofil.r4", "1.5.0", chain, stubFetch(bodies));

    expect(link.registry).toBe("Mirror");
    expect(source?.registry).toBe("Full");
    expect(source?.url).toBe("https://full.example/de.basisprofil.r4/1.5.0");
  });

  it("offers no direct import when no registry that has it may be read", async () => {
    const source = await resolveImportUrl(
      "de.basisprofil.r4",
      "1.5.0",
      [mirror],
      stubFetch({ "https://mirror.example/packages/de.basisprofil.r4": metadata({ "1.5.0": {} }) })
    );

    expect(source).toBeUndefined();
  });

  it("lists every registry that carries a version, in chain order", async () => {
    const sources = await listSourcesFor(
      "de.basisprofil.r4",
      "1.5.0",
      chain,
      stubFetch({
        "https://mirror.example/packages/de.basisprofil.r4": metadata({ "1.5.0": {} }),
        "https://full.example/de.basisprofil.r4": metadata({ "1.5.0": {}, "1.3.2": {} }),
      })
    );

    expect(sources).toEqual([
      {
        registry: "Mirror",
        url: "https://mirror.example/packages/de.basisprofil.r4/1.5.0",
        fetchable: false,
      },
      {
        registry: "Full",
        url: "https://full.example/de.basisprofil.r4/1.5.0",
        fetchable: true,
      },
    ]);
  });

  it("lists nothing for a version no registry carries", async () => {
    const sources = await listSourcesFor(
      "de.basisprofil.r4",
      "9.9.9",
      chain,
      stubFetch({
        "https://mirror.example/packages/de.basisprofil.r4": metadata({ "1.5.0": {} }),
        "https://full.example/de.basisprofil.r4": metadata({ "1.5.0": {} }),
      })
    );

    expect(sources).toEqual([]);
  });

  it("says so when no registry could be reached at all", async () => {
    const offline = vi.fn(async () => {
      throw new Error("network down");
    }) as unknown as typeof fetch;

    const availability = await fetchPackageAvailability("de.basisprofil.r4", chain, offline);

    expect(availability.versions).toEqual([]);
    expect(availability.offline).toBe(true);
  });
});
