import { describe, expect, it } from "vitest";
import { buildProjectKey, createProjectRecord } from "@/lib/projects/storage";
import {
  buildConformanceSkeleton,
  classifyResourceKind,
  cloneAuthoredResources,
  importedResourceToAuthored,
} from "@/lib/projects/content";
import type { AuthoredResource } from "@/lib/projects/types";

describe("projects storage helpers", () => {
  it("builds an id@version key", () => {
    expect(buildProjectKey("my.project", "1.0.0")).toBe("my.project@1.0.0");
  });

  it("creates a project record from a manifest", () => {
    const record = createProjectRecord(
      { name: "my.project", version: "0.2.0", title: "My Project" },
      1_000
    );
    expect(record).toMatchObject({
      key: "my.project@0.2.0",
      id: "my.project",
      version: "0.2.0",
      createdAt: 1_000,
      updatedAt: 1_000,
    });
    expect(record.manifest.title).toBe("My Project");
  });
});

describe("conformance skeleton builder", () => {
  it("builds a ValueSet with a canonical url derived from the base", () => {
    const { resourceType, content } = buildConformanceSkeleton({
      kind: "valueset",
      name: "MyValueSet",
      canonicalBase: "https://example.org/fhir/",
    });
    expect(resourceType).toBe("ValueSet");
    expect(content).toMatchObject({
      resourceType: "ValueSet",
      url: "https://example.org/fhir/ValueSet/MyValueSet",
      name: "MyValueSet",
      status: "draft",
    });
  });

  it("builds a CodeSystem with content=complete", () => {
    const { content } = buildConformanceSkeleton({
      kind: "codesystem",
      name: "MyCodes",
    });
    expect(content).toMatchObject({ resourceType: "CodeSystem", content: "complete" });
  });

  it("builds an Extension StructureDefinition", () => {
    const { content } = buildConformanceSkeleton({ kind: "extension", name: "MyExt" });
    expect(content).toMatchObject({
      resourceType: "StructureDefinition",
      type: "Extension",
      baseDefinition: "http://hl7.org/fhir/StructureDefinition/Extension",
      derivation: "constraint",
    });
  });

  it("builds a profile StructureDefinition", () => {
    const { content } = buildConformanceSkeleton({ kind: "profile", name: "MyProfile" });
    expect(content).toMatchObject({
      resourceType: "StructureDefinition",
      kind: "resource",
      derivation: "constraint",
    });
  });

  it("builds an example instance carrying its profile", () => {
    const { resourceType, content } = buildConformanceSkeleton({
      kind: "example",
      name: "example-1",
      exampleResourceType: "Patient",
      exampleProfile: "https://example.org/fhir/StructureDefinition/MyPatient",
    });
    expect(resourceType).toBe("Patient");
    expect(content).toMatchObject({
      resourceType: "Patient",
      meta: { profile: ["https://example.org/fhir/StructureDefinition/MyPatient"] },
    });
  });
});

describe("imported resource classification & duplication", () => {
  it("classifies conformance resources by type", () => {
    expect(classifyResourceKind({ resourceType: "ValueSet" })).toBe("valueset");
    expect(classifyResourceKind({ resourceType: "CodeSystem" })).toBe("codesystem");
    expect(
      classifyResourceKind({ resourceType: "StructureDefinition", type: "Extension" })
    ).toBe("extension");
    expect(
      classifyResourceKind({ resourceType: "StructureDefinition", type: "Patient" })
    ).toBe("profile");
    expect(classifyResourceKind({ resourceType: "Patient" })).toBe("example");
  });

  it("maps an imported resource into an authored entry", () => {
    const authored = importedResourceToAuthored(
      {
        resourceType: "StructureDefinition",
        id: "MyPatient",
        type: "Patient",
        name: "MyPatient",
        meta: { profile: ["http://x/SD/Base"] },
      },
      42,
      0
    );
    expect(authored).toMatchObject({
      id: "StructureDefinition-MyPatient",
      kind: "profile",
      resourceType: "StructureDefinition",
      profile: "http://x/SD/Base",
      title: "MyPatient",
      createdAt: 42,
    });
  });

  it("clones authored resources with fresh ids and deep-copied content", () => {
    const source: AuthoredResource[] = [
      {
        id: "orig-1",
        kind: "valueset",
        resourceType: "ValueSet",
        content: { resourceType: "ValueSet", name: "A" },
        createdAt: 1,
        updatedAt: 1,
        lastSelectedAt: 5,
      },
    ];
    const cloned = cloneAuthoredResources(source, 100);
    expect(cloned).toHaveLength(1);
    expect(cloned[0].id).not.toBe("orig-1");
    expect(cloned[0].createdAt).toBe(100);
    expect(cloned[0].lastSelectedAt).toBeUndefined();
    expect(cloned[0].content).not.toBe(source[0].content);
    expect(cloned[0].content).toEqual({ resourceType: "ValueSet", name: "A" });
  });
});
