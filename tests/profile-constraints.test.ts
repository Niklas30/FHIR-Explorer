import { describe, expect, it } from "vitest";
import {
  countConstraints,
  formatCardinality,
  hasConstraint,
  readConstraint,
  writeConstraint,
} from "@/lib/projects/profile-constraints";

describe("formatCardinality", () => {
  it("formats min..max with defaults", () => {
    expect(formatCardinality(0, "1")).toBe("0..1");
    expect(formatCardinality(1, "*")).toBe("1..*");
    expect(formatCardinality(undefined, undefined)).toBe("0..*");
  });
});

describe("writeConstraint / readConstraint", () => {
  it("upserts a cardinality constraint into the differential", () => {
    const content: Record<string, unknown> = {
      resourceType: "StructureDefinition",
      url: "https://x/SD/A",
    };
    const next = writeConstraint(content, "Patient.gender", { min: 1, max: "1" });
    expect(readConstraint(next, "Patient.gender")).toMatchObject({ min: 1, max: "1" });
    expect(countConstraints(next)).toBe(1);
    expect(hasConstraint(next, "Patient.gender")).toBe(true);
    // original untouched (immutable)
    expect(content.differential).toBeUndefined();
  });

  it("merges patches onto an existing element", () => {
    let content: Record<string, unknown> = { resourceType: "StructureDefinition" };
    content = writeConstraint(content, "Patient.gender", { min: 1 });
    content = writeConstraint(content, "Patient.gender", { mustSupport: true });
    content = writeConstraint(content, "Patient.gender", {
      binding: { strength: "required", valueSet: "https://x/VS/G" },
    });
    expect(readConstraint(content, "Patient.gender")).toMatchObject({
      min: 1,
      mustSupport: true,
      binding: { strength: "required", valueSet: "https://x/VS/G" },
    });
  });

  it("removes the element when the last constraint is cleared", () => {
    let content: Record<string, unknown> = { resourceType: "StructureDefinition" };
    content = writeConstraint(content, "Patient.gender", { min: 1, mustSupport: true });
    content = writeConstraint(content, "Patient.gender", { min: null, mustSupport: false });
    expect(hasConstraint(content, "Patient.gender")).toBe(false);
    expect(content.differential).toBeUndefined();
  });

  it("preserves other author-set keys on the element", () => {
    const content: Record<string, unknown> = {
      resourceType: "StructureDefinition",
      differential: { element: [{ id: "Patient.name", path: "Patient.name", short: "kept", min: 1 }] },
    };
    const next = writeConstraint(content, "Patient.name", { min: null });
    // min cleared but the element stays because `short` remains.
    expect(hasConstraint(next, "Patient.name")).toBe(true);
    expect(readConstraint(next, "Patient.name")).toMatchObject({ short: "kept" });
    expect(readConstraint(next, "Patient.name").min).toBeUndefined();
  });
});
