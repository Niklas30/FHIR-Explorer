import { describe, expect, it } from "vitest";
import { buildDependencyGraph } from "@/lib/fhir-importer/dependency-graph";
import type { PackageRecord } from "@/lib/fhir-importer/types";
import {
  resolveDependencyPackageKeys,
  resolveProjectPackageKeys,
  toPayloads,
} from "@/lib/projects/registry-resolution";
import type { AuthoredProjectRecord, AuthoredResource } from "@/lib/projects/types";

const pkg = (
  id: string,
  version: string,
  dependencies?: Record<string, string>
): PackageRecord => ({
  key: `${id}@${version}`,
  id,
  version,
  manifest: { name: id, version, dependencies },
  addedAt: 0,
  resourceCount: 0,
});

const graph = buildDependencyGraph([
  pkg("hl7.fhir.r4.core", "4.0.1"),
  pkg("de.basisprofil.r4", "1.5.4", { "hl7.fhir.r4.core": "4.0.1" }),
]);

describe("resolveDependencyPackageKeys", () => {
  it("expands a dependency to its transitive closure", () => {
    const keys = resolveDependencyPackageKeys({ "de.basisprofil.r4": "1.5.4" }, graph);
    expect(keys).toContain("de.basisprofil.r4@1.5.4");
    expect(keys).toContain("hl7.fhir.r4.core@4.0.1");
  });

  it("matches a dependency by id when the exact version is not imported", () => {
    const keys = resolveDependencyPackageKeys({ "de.basisprofil.r4": "1.0.0" }, graph);
    expect(keys).toContain("de.basisprofil.r4@1.5.4");
  });

  it("ignores dependencies that are not imported", () => {
    expect(resolveDependencyPackageKeys({ "not.imported": "1.0.0" }, graph)).toEqual([]);
  });
});

describe("resolveProjectPackageKeys", () => {
  const authored: AuthoredProjectRecord = {
    key: "my.project@0.1.0",
    id: "my.project",
    version: "0.1.0",
    manifest: { name: "my.project", version: "0.1.0", dependencies: { "de.basisprofil.r4": "1.5.4" } },
    createdAt: 0,
    updatedAt: 0,
  };

  it("uses the dependency closure for authored projects (not the project key itself)", () => {
    const keys = resolveProjectPackageKeys({ authored, projectKey: authored.key, graph });
    expect(keys).toContain("de.basisprofil.r4@1.5.4");
    expect(keys).toContain("hl7.fhir.r4.core@4.0.1");
    expect(keys).not.toContain("my.project@0.1.0");
  });

  it("uses the package + its closure for imported projects", () => {
    const keys = resolveProjectPackageKeys({
      authored: null,
      projectKey: "de.basisprofil.r4@1.5.4",
      graph,
    });
    expect(keys).toContain("de.basisprofil.r4@1.5.4");
    expect(keys).toContain("hl7.fhir.r4.core@4.0.1");
  });
});

describe("toPayloads", () => {
  it("maps authored resources to registry payloads scoped to the project key", () => {
    const resource: AuthoredResource = {
      id: "r1",
      kind: "valueset",
      resourceType: "ValueSet",
      content: { resourceType: "ValueSet", id: "vs1", url: "https://x/ValueSet/A", name: "A" },
      createdAt: 0,
      updatedAt: 0,
    };
    const [payload] = toPayloads("my.project@0.1.0", [resource]);
    expect(payload).toMatchObject({
      packageKey: "my.project@0.1.0",
      resourceType: "ValueSet",
      id: "vs1",
      url: "https://x/ValueSet/A",
    });
  });
});
