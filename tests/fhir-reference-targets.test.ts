import { describe, expect, it } from "vitest";
import { getReferenceCreationTargets } from "@/lib/fhir-editor/reference-targets";
import { createPatientProfileContext } from "@/tests/helpers/fhir-test-fixtures";

describe("reference creation targets", () => {
  it("resolves targetProfiles to concrete resource types with profile urls", () => {
    const { tree, ctx } = createPatientProfileContext();
    const managingOrganization = tree.root.children.find(
      (child) => child.key === "managingOrganization"
    );
    expect(managingOrganization).toBeDefined();

    const targets = getReferenceCreationTargets(managingOrganization!, ctx);
    expect(targets).toEqual([
      {
        resourceType: "Organization",
        profileUrl: "http://hl7.org/fhir/StructureDefinition/Organization",
        label: "Organization",
      },
    ]);
  });

  it("falls back to all instantiable profiles for Reference(Any)", () => {
    const { tree, ctx } = createPatientProfileContext();
    const managingOrganization = tree.root.children.find(
      (child) => child.key === "managingOrganization"
    );
    // Simulate an unconstrained Reference element.
    const anyReference = {
      ...managingOrganization!,
      types: [{ code: "Reference" }],
    };

    const targets = getReferenceCreationTargets(anyReference, ctx);
    expect(targets.length).toBeGreaterThan(1);
    expect(targets.map((target) => target.resourceType)).toEqual(
      expect.arrayContaining(["Organization", "Patient", "Survey"])
    );
    for (const target of targets) {
      expect(target.profileUrl).toBeTruthy();
      expect(target.label.length).toBeGreaterThan(0);
    }
  });

  it("keeps unresolvable targetProfiles as inferred resource types", () => {
    const { tree, ctx } = createPatientProfileContext();
    const managingOrganization = tree.root.children.find(
      (child) => child.key === "managingOrganization"
    );
    const unresolvable = {
      ...managingOrganization!,
      types: [
        {
          code: "Reference",
          targetProfile: ["http://example.org/unknown/StructureDefinition/Location"],
        },
      ],
    };

    const targets = getReferenceCreationTargets(unresolvable, ctx);
    expect(targets).toEqual([{ resourceType: "Location", label: "Location" }]);
  });
});
