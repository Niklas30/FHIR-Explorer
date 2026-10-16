import { describe, expect, it } from "vitest";
import { planInstall } from "@fhir-explorer/core/fhir-importer/install-plan";
import type { PackageRegistryApi, RegistryPackage } from "@fhir-explorer/core/fhir-importer/registry-api";

/**
 * A registry built from a literal, shaped like the real one: every version
 * carries its own dependencies, which is what makes resolve-before-download
 * possible in the first place.
 */
const stubRegistry = (
  catalogue: Record<string, Record<string, Record<string, string> | undefined>>,
  latestOf: Record<string, string> = {}
): PackageRegistryApi & { calls: string[] } => {
  const calls: string[] = [];
  return {
    calls,
    search: async () => [],
    tarballUrl: (id, version) => `https://example.org/${id}/${version}`,
    dependencies: async (id, version) => catalogue[id]?.[version] ?? {},
    metadata: async (id): Promise<RegistryPackage | undefined> => {
      calls.push(id);
      const versions = catalogue[id];
      if (!versions) return undefined;
      return {
        name: id,
        latest: latestOf[id],
        versions: Object.entries(versions).map(([version, dependencies]) => ({
          version,
          dependencies,
        })),
      };
    },
  };
};

const byId = (plan: { packages: { id: string; version: string }[] }) =>
  Object.fromEntries(plan.packages.map((entry) => [entry.id, entry.version]));

describe("planInstall", () => {
  it("pulls in transitive dependencies the user never named", async () => {
    const registry = stubRegistry({
      "de.basisprofil.r4": {
        "1.6.0": { "hl7.fhir.r4.core": "4.0.1", "hl7.fhir.uv.extensions.r4": "5.2.0" },
      },
      "hl7.fhir.r4.core": { "4.0.1": undefined },
      "hl7.fhir.uv.extensions.r4": { "5.2.0": { "hl7.fhir.r4.core": "4.0.1" } },
    });

    const plan = await planInstall(
      [{ id: "de.basisprofil.r4", version: "1.6.0" }],
      registry
    );

    expect(byId(plan)).toEqual({
      "de.basisprofil.r4": "1.6.0",
      "hl7.fhir.r4.core": "4.0.1",
      "hl7.fhir.uv.extensions.r4": "5.2.0",
    });
    expect(plan.conflicts).toEqual([]);
    expect(plan.unresolved).toEqual([]);
  });

  it("marks what the user asked for directly", async () => {
    const registry = stubRegistry({
      a: { "1.0.0": { b: "1.0.0" } },
      b: { "1.0.0": undefined },
    });
    const plan = await planInstall([{ id: "a", version: "1.0.0" }], registry);

    expect(plan.packages.find((entry) => entry.id === "a")?.direct).toBe(true);
    expect(plan.packages.find((entry) => entry.id === "b")?.direct).toBe(false);
    expect(plan.packages.find((entry) => entry.id === "b")?.requestedBy).toEqual([
      "a@1.0.0",
    ]);
  });

  it("reports a version conflict and settles on the newer one", async () => {
    const registry = stubRegistry({
      root: { "1.0.0": { a: "1.0.0", b: "1.0.0" } },
      a: { "1.0.0": { shared: "1.0.0" } },
      b: { "1.0.0": { shared: "2.0.0" } },
      shared: { "1.0.0": undefined, "2.0.0": undefined },
    });

    const plan = await planInstall([{ id: "root", version: "1.0.0" }], registry);

    expect(byId(plan).shared).toBe("2.0.0");
    expect(plan.conflicts).toHaveLength(1);
    expect(plan.conflicts[0].id).toBe("shared");
    expect(plan.conflicts[0].chosen).toBe("2.0.0");
    expect(plan.conflicts[0].requested.map((entry) => entry.version)).toEqual([
      "2.0.0",
      "1.0.0",
    ]);
  });

  it("lets the caller override the resolution", async () => {
    const registry = stubRegistry({
      root: { "1.0.0": { a: "1.0.0", b: "1.0.0" } },
      a: { "1.0.0": { shared: "1.0.0" } },
      b: { "1.0.0": { shared: "2.0.0" } },
      shared: { "1.0.0": undefined, "2.0.0": undefined },
    });

    const plan = await planInstall([{ id: "root", version: "1.0.0" }], registry, {
      overrides: { shared: "1.0.0" },
    });

    expect(byId(plan).shared).toBe("1.0.0");
  });

  it("terminates on a dependency cycle", async () => {
    const registry = stubRegistry({
      a: { "1.0.0": { b: "1.0.0" } },
      b: { "1.0.0": { a: "1.0.0" } },
    });

    const plan = await planInstall([{ id: "a", version: "1.0.0" }], registry);
    expect(byId(plan)).toEqual({ a: "1.0.0", b: "1.0.0" });
  });

  it("reports an unknown package instead of failing the whole plan", async () => {
    const registry = stubRegistry({
      a: { "1.0.0": { missing: "1.0.0" } },
    });

    const plan = await planInstall([{ id: "a", version: "1.0.0" }], registry);

    expect(byId(plan).a).toBe("1.0.0");
    expect(plan.unresolved).toEqual([
      { id: "missing", range: "1.0.0", requestedBy: ["a@1.0.0"], reason: "unknown-package" },
    ]);
  });

  it("resolves a range against what the registry actually lists", async () => {
    const registry = stubRegistry(
      {
        a: { "1.0.0": { core: "latest" } },
        core: { "4.0.1": undefined, "5.0.0": undefined },
      },
      { core: "5.0.0" }
    );

    const plan = await planInstall([{ id: "a", version: "1.0.0" }], registry);
    expect(byId(plan).core).toBe("5.0.0");
  });

  it("flags what is already on disk so it is not downloaded again", async () => {
    const registry = stubRegistry({
      a: { "1.0.0": { b: "1.0.0" } },
      b: { "1.0.0": undefined },
    });

    const plan = await planInstall([{ id: "a", version: "1.0.0" }], registry, {
      isSatisfied: (id) => id === "b",
    });

    expect(plan.packages.find((entry) => entry.id === "b")?.satisfied).toBe(true);
    expect(plan.packages.find((entry) => entry.id === "a")?.satisfied).toBe(false);
  });

  it("asks the registry about each package once", async () => {
    const registry = stubRegistry({
      root: { "1.0.0": { a: "1.0.0", b: "1.0.0" } },
      a: { "1.0.0": { core: "1.0.0" } },
      b: { "1.0.0": { core: "1.0.0" } },
      core: { "1.0.0": undefined },
    });

    await planInstall([{ id: "root", version: "1.0.0" }], registry);
    expect(registry.calls.filter((id) => id === "core")).toHaveLength(1);
  });
});
