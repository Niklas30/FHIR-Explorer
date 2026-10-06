import { describe, expect, it } from "vitest";
import { ChainedRegistry } from "@fhir-explorer/core/fhir-importer/chained-registry";
import type { PackageRegistryApi, RegistryPackage } from "@fhir-explorer/core/fhir-importer/registry-api";

/**
 * The two registries the chain exists for, in miniature: one that publishes
 * dependencies but mirrors only recent versions, and one that has the whole
 * history but leaves dependencies to the archive.
 */
const stub = (
  host: string,
  catalogue: Record<string, RegistryPackage | undefined>,
  dependencies: Record<string, Record<string, string>> = {}
): PackageRegistryApi => ({
  search: async () => [],
  metadata: async (id) => catalogue[id],
  dependencies: async (id, version) => dependencies[`${id}@${version}`] ?? {},
  tarballUrl: (id, version) => `https://${host}/${id}/${version}`,
});

const pkg = (name: string, versions: RegistryPackage["versions"], latest?: string) => ({
  name,
  latest,
  versions,
});

describe("ChainedRegistry", () => {
  it("merges the version lists, so a version only the second registry has resolves", async () => {
    const chain = new ChainedRegistry([
      stub("mirror", {
        "de.basisprofil.r4": pkg("de.basisprofil.r4", [{ version: "1.5.0" }], "1.5.0"),
      }),
      stub("full", {
        "de.basisprofil.r4": pkg(
          "de.basisprofil.r4",
          [{ version: "1.5.0" }, { version: "1.3.2" }],
          "1.5.0"
        ),
      }),
    ]);

    const metadata = await chain.metadata("de.basisprofil.r4");

    expect(metadata?.versions.map((entry) => entry.version)).toEqual(["1.5.0", "1.3.2"]);
  });

  it("keeps the first registry's entry but takes what it is missing from the rest", async () => {
    const chain = new ChainedRegistry([
      stub("mirror", {
        "kbv.basis": pkg("kbv.basis", [{ version: "1.3.0", tarball: "https://mirror/a.tgz" }]),
      }),
      stub("full", {
        "kbv.basis": pkg("kbv.basis", [
          {
            version: "1.3.0",
            tarball: "https://full/a.tgz",
            fhirVersion: "R4",
            dependencies: { "hl7.fhir.r4.core": "4.0.1" },
          },
        ]),
      }),
    ]);

    const version = (await chain.metadata("kbv.basis"))?.versions[0];

    expect(version?.tarball).toBe("https://mirror/a.tgz");
    expect(version?.fhirVersion).toBe("R4");
    expect(version?.dependencies).toEqual({ "hl7.fhir.r4.core": "4.0.1" });
  });

  it("asks the registry that actually has the version what it depends on", async () => {
    const chain = new ChainedRegistry([
      stub("mirror", { "kbv.basis": pkg("kbv.basis", [{ version: "1.5.0" }]) }),
      stub(
        "full",
        { "kbv.basis": pkg("kbv.basis", [{ version: "1.3.0" }]) },
        { "kbv.basis@1.3.0": { "de.basisprofil.r4": "1.3.2" } }
      ),
    ]);

    expect(await chain.dependencies("kbv.basis", "1.3.0")).toEqual({
      "de.basisprofil.r4": "1.3.2",
    });
    expect(await chain.dependencies("kbv.basis", "1.5.0")).toEqual({});
  });

  it("takes the newest of the registries' disagreeing latest tags", async () => {
    const chain = new ChainedRegistry([
      stub("stale", { a: pkg("a", [{ version: "1.0.0" }], "1.0.0") }),
      stub("fresh", { a: pkg("a", [{ version: "2.0.0" }], "2.0.0") }),
    ]);

    expect((await chain.metadata("a"))?.latest).toBe("2.0.0");
  });

  it("reports a package no registry knows as missing", async () => {
    const chain = new ChainedRegistry([stub("mirror", {}), stub("full", {})]);

    expect(await chain.metadata("nope")).toBeUndefined();
  });

  it("does not turn every registry being unreachable into a missing package", async () => {
    const unreachable: PackageRegistryApi = {
      search: async () => [],
      metadata: async () => {
        throw new Error("network down");
      },
      dependencies: async () => ({}),
      tarballUrl: (id, version) => `https://down/${id}/${version}`,
    };
    const chain = new ChainedRegistry([unreachable, unreachable]);

    await expect(chain.metadata("kbv.basis")).rejects.toThrow("network down");
  });

  it("still answers from the registries that are up", async () => {
    const unreachable: PackageRegistryApi = {
      search: async () => [],
      metadata: async () => {
        throw new Error("network down");
      },
      dependencies: async () => ({}),
      tarballUrl: (id, version) => `https://down/${id}/${version}`,
    };
    const chain = new ChainedRegistry([
      unreachable,
      stub("full", { "kbv.basis": pkg("kbv.basis", [{ version: "1.3.0" }]) }),
    ]);

    expect((await chain.metadata("kbv.basis"))?.versions).toHaveLength(1);
  });
});
