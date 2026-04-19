import { describe, expect, it } from "vitest";
import { resolveDependencies } from "@/lib/fhir-importer/resolver";
import type { ImportState, PackageRecord } from "@/lib/fhir-importer/types";
import { buildPackageKey } from "@/lib/fhir-importer/utils";

const createPackage = (
  id: string,
  version: string,
  dependencies: Record<string, string> = {}
): PackageRecord => ({
  key: buildPackageKey(id, version),
  id,
  version,
  manifest: {
    name: id,
    version,
    dependencies,
  },
  addedAt: 0,
  resourceCount: 0,
});

const createState = (currentTarget?: ImportState["currentTarget"], versionSelections: Record<string, string> = {}) =>
  ({
    currentTarget,
    versionSelections,
  }) satisfies ImportState;

describe("resolveDependencies", () => {
  it("returns no requirements when no target is active", () => {
    const packages = [createPackage("example.target", "1.0.0", { "example.dep": "1.0.0" })];

    const result = resolveDependencies(packages, createState());

    expect(result).toEqual({
      missing: [],
      resolved: [],
      conflicts: [],
    });
  });

  it("scopes exact-version requirements to the active target graph", () => {
    const packages = [
      createPackage("example.target", "1.0.0", { "example.dep": "1.0.0" }),
      createPackage("example.target", "1.0.1", { "example.dep": "1.0.1" }),
      createPackage("example.dep", "1.0.0"),
      createPackage("example.dep", "1.0.1"),
    ];

    const result = resolveDependencies(packages, createState({ id: "example.target", version: "1.0.1" }));

    expect(result.conflicts).toHaveLength(0);
    expect(result.missing).toHaveLength(0);
    expect(result.resolved).toHaveLength(1);
    expect(result.resolved[0]).toMatchObject({
      id: "example.dep",
      exactVersion: "1.0.1",
      status: "resolved",
    });
  });

  it("still reports exact-version conflicts inside one active target graph", () => {
    const packages = [
      createPackage("example.target", "1.0.0", {
        "example.dep.a": "1.0.0",
        "example.dep.b": "1.0.0",
      }),
      createPackage("example.dep.a", "1.0.0", { "example.shared": "1.0.0" }),
      createPackage("example.dep.b", "1.0.0", { "example.shared": "2.0.0" }),
    ];

    const result = resolveDependencies(packages, createState({ id: "example.target", version: "1.0.0" }));

    expect(result.conflicts).toHaveLength(1);
    expect(result.conflicts[0]).toMatchObject({
      id: "example.shared",
      conflictReason: "Multiple exact versions required.",
      status: "conflict",
    });
  });

  it("treats multi-version range dependencies as selectable instead of conflicting", () => {
    const packages = [
      createPackage("example.target", "1.0.0", { "example.range.dep": "^1.0.0" }),
      createPackage("example.range.dep", "1.0.0"),
      createPackage("example.range.dep", "1.1.0"),
    ];

    const withoutSelection = resolveDependencies(packages, createState({ id: "example.target", version: "1.0.0" }));
    expect(withoutSelection.conflicts).toHaveLength(0);
    expect(withoutSelection.missing).toHaveLength(1);
    expect(withoutSelection.missing[0]).toMatchObject({
      id: "example.range.dep",
      status: "missing",
    });

    const withSelection = resolveDependencies(
      packages,
      createState({ id: "example.target", version: "1.0.0" }, { "example.range.dep": "1.1.0" })
    );
    expect(withSelection.conflicts).toHaveLength(0);
    expect(withSelection.missing).toHaveLength(0);
    expect(withSelection.resolved[0]).toMatchObject({
      id: "example.range.dep",
      chosenVersion: "1.1.0",
      status: "resolved",
    });
  });
});
