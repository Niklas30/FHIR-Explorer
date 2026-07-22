import { describe, expect, it } from "vitest";
import { analyzeProject, type CanonicalResolvers } from "@/lib/projects/analysis";
import { buildProjectMermaid } from "@/lib/projects/project-mermaid";
import type { AuthoredResource } from "@/lib/projects/types";

const res = (partial: Partial<AuthoredResource> & Pick<AuthoredResource, "kind" | "resourceType" | "content">): AuthoredResource => ({
  id: partial.id ?? `${partial.resourceType}-${Math.round((partial.content.__i as number) ?? 0)}`,
  title: undefined,
  createdAt: 0,
  updatedAt: 0,
  ...partial,
});

const allResolvable: CanonicalResolvers = {
  hasStructureDefinition: () => true,
  hasValueSet: () => true,
  hasCore: true,
};

const noneResolvable: CanonicalResolvers = {
  hasStructureDefinition: () => false,
  hasValueSet: () => false,
  hasCore: false,
};

describe("analyzeProject", () => {
  it("builds derives/binds/conforms edges and used-by index", () => {
    const profile = res({
      id: "p1",
      kind: "profile",
      resourceType: "StructureDefinition",
      content: {
        resourceType: "StructureDefinition",
        url: "https://x/fhir/StructureDefinition/MyPatient",
        baseDefinition: "http://hl7.org/fhir/StructureDefinition/Patient",
        differential: {
          element: [{ path: "Patient.gender", binding: { valueSet: "https://x/fhir/ValueSet/Genders" } }],
        },
      },
    });
    const vs = res({
      id: "vs1",
      kind: "valueset",
      resourceType: "ValueSet",
      content: { resourceType: "ValueSet", url: "https://x/fhir/ValueSet/Genders" },
    });
    const example = res({
      id: "ex1",
      kind: "example",
      resourceType: "Patient",
      content: { resourceType: "Patient", meta: { profile: ["https://x/fhir/StructureDefinition/MyPatient"] } },
    });

    const analysis = analyzeProject({
      manifest: { name: "x", version: "1.0.0", canonical: "https://x/fhir" },
      resources: [profile, vs, example],
      resolvers: allResolvable,
    });

    expect(analysis.counts.profile).toBe(1);
    expect(analysis.counts.valueset).toBe(1);
    expect(analysis.counts.example).toBe(1);

    const kinds = analysis.edges.map((e) => e.kind).sort();
    expect(kinds).toContain("derives");
    expect(kinds).toContain("binds");
    expect(kinds).toContain("conforms");

    // VS is used by the profile; profile is used by the example.
    expect(analysis.usedBy.vs1).toContain("p1");
    expect(analysis.usedBy.p1).toContain("ex1");
  });

  it("flags unresolved base, binding and missing core", () => {
    const profile = res({
      id: "p1",
      kind: "profile",
      resourceType: "StructureDefinition",
      content: {
        resourceType: "StructureDefinition",
        url: "https://x/fhir/StructureDefinition/MyPatient",
        baseDefinition: "http://hl7.org/fhir/StructureDefinition/Patient",
        differential: { element: [{ path: "Patient.gender", binding: { valueSet: "https://x/ValueSet/Unknown" } }] },
      },
    });
    const analysis = analyzeProject({
      manifest: { name: "x", version: "1.0.0" },
      resources: [profile],
      resolvers: noneResolvable,
    });
    const codes = analysis.issues.map((i) => i.code);
    expect(codes).toContain("base-unresolved");
    expect(codes).toContain("binding-unresolved");
    expect(codes).toContain("missing-core");
  });

  it("flags duplicate canonical urls and canonical-base mismatch", () => {
    const a = res({
      id: "a",
      kind: "codesystem",
      resourceType: "CodeSystem",
      content: { resourceType: "CodeSystem", url: "https://other.org/CodeSystem/Dup" },
    });
    const b = res({
      id: "b",
      kind: "valueset",
      resourceType: "ValueSet",
      content: { resourceType: "ValueSet", url: "https://other.org/CodeSystem/Dup" },
    });
    const analysis = analyzeProject({
      manifest: { name: "x", version: "1.0.0", canonical: "https://x/fhir" },
      resources: [a, b],
      resolvers: allResolvable,
    });
    const codes = analysis.issues.map((i) => i.code);
    expect(codes).toContain("duplicate-canonical");
    expect(codes.filter((c) => c === "canonical-mismatch").length).toBe(2);
  });
});

describe("buildProjectMermaid", () => {
  it("returns an empty note when there are no nodes", () => {
    const diagram = buildProjectMermaid(
      { counts: { profile: 0, extension: 0, valueset: 0, codesystem: 0, example: 0 }, nodes: [], edges: [], issues: [], usedBy: {} },
      { empty: "Leer", edgeDerives: "leitet ab", edgeConforms: "konform", edgeBinds: "Binding", edgeIncludes: "include", edgeExtends: "extends" }
    );
    expect(diagram).toContain("flowchart LR");
    expect(diagram).toContain("Leer");
  });

  it("emits nodes and labeled edges", () => {
    const analysis = analyzeProject({
      manifest: { name: "x", version: "1.0.0" },
      resources: [
        res({ id: "p1", kind: "profile", resourceType: "StructureDefinition", content: { resourceType: "StructureDefinition", url: "https://x/SD/A", baseDefinition: "http://hl7.org/fhir/StructureDefinition/Patient" } }),
      ],
      resolvers: allResolvable,
    });
    const diagram = buildProjectMermaid(analysis, {
      empty: "Leer",
      edgeDerives: "leitet ab",
      edgeConforms: "konform",
      edgeBinds: "Binding",
      edgeIncludes: "include",
      edgeExtends: "extends",
    });
    expect(diagram).toContain("flowchart LR");
    expect(diagram).toContain("leitet ab");
  });
});
