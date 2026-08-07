import { describe, expect, it } from "vitest";
import { resolveRenderKind } from "@/lib/fhir-editor/schema";

describe("render kind resolution", () => {
  it("maps primitives to typed inputs", () => {
    expect(resolveRenderKind("string")).toEqual({ kind: "primitive", primitive: "string" });
    expect(resolveRenderKind("boolean")).toEqual({ kind: "primitive", primitive: "boolean" });
    expect(resolveRenderKind("positiveInt")).toEqual({ kind: "primitive", primitive: "integer" });
    expect(resolveRenderKind("canonical")).toEqual({ kind: "primitive", primitive: "uri" });
    expect(resolveRenderKind("markdown")).toEqual({ kind: "primitive", primitive: "markdown" });
  });

  it("maps Quantity and its specializations to the Quantity editor", () => {
    for (const code of ["Quantity", "Age", "Duration", "Count", "Distance", "SimpleQuantity"]) {
      expect(resolveRenderKind(code)).toEqual({ kind: "Quantity" });
    }
  });

  it("maps datatypes with dedicated editors", () => {
    expect(resolveRenderKind("Reference")).toEqual({ kind: "Reference" });
    expect(resolveRenderKind("CodeableConcept")).toEqual({ kind: "CodeableConcept" });
    expect(resolveRenderKind("Identifier")).toEqual({ kind: "Identifier" });
    expect(resolveRenderKind("ContactPoint")).toEqual({ kind: "ContactPoint" });
    expect(resolveRenderKind("Extension")).toEqual({ kind: "Extension" });
    expect(resolveRenderKind("Narrative")).toEqual({ kind: "Narrative" });
  });

  it("recurses generically for other complex types instead of falling back to JSON", () => {
    expect(resolveRenderKind("HumanName")).toEqual({ kind: "complex", typeCode: "HumanName" });
    expect(resolveRenderKind("Timing")).toEqual({ kind: "complex", typeCode: "Timing" });
    expect(resolveRenderKind("Dosage")).toEqual({ kind: "complex", typeCode: "Dosage" });
  });

  it("uses JSON only when no type information exists", () => {
    expect(resolveRenderKind(undefined)).toEqual({ kind: "json" });
    // Unknown lowercase codes degrade to a string input, not JSON.
    expect(resolveRenderKind("someFutumePrimitive")).toEqual({
      kind: "primitive",
      primitive: "string",
    });
  });
});
