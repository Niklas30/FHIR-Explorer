import { describe, expect, it } from "vitest";
import { validateResourceWithProfile } from "@/lib/fhir-editor/validation";
import { createHealthcareServiceDirectoryFieldContext } from "@/tests/helpers/fhir-test-fixtures";

describe("FHIR validation", () => {
  it("reports cardinality-array when a repeating field is serialized as single value", () => {
    const { fields, registry } = createHealthcareServiceDirectoryFieldContext();
    const daysOfWeek = fields.find(
      (field) => field.path === "HealthcareService.availableTime.daysOfWeek"
    );
    expect(daysOfWeek).toBeDefined();

    const issues = validateResourceWithProfile(
      {
        resourceType: "HealthcareService",
        availableTime: [{ daysOfWeek: "sat" }],
      },
      [daysOfWeek!],
      registry
    );

    expect(issues.some((issue) => issue.code === "cardinality-array")).toBe(true);
  });

  it("validates required field inherited from base profile", () => {
    const { fields, registry } = createHealthcareServiceDirectoryFieldContext();
    const notAvailableDescription = fields.find(
      (field) => field.path === "HealthcareService.notAvailable.description"
    );
    expect(notAvailableDescription).toBeDefined();

    const issues = validateResourceWithProfile(
      {
        resourceType: "HealthcareService",
        notAvailable: [{}],
      },
      [notAvailableDescription!],
      registry
    );

    expect(
      issues.some(
        (issue) =>
          issue.code === "required" &&
          issue.path === "HealthcareService.notAvailable[0].description"
      )
    ).toBe(true);
  });

  it("includes broken reference checks in validation output", () => {
    const { registry } = createHealthcareServiceDirectoryFieldContext();
    const missingTarget = validateResourceWithProfile(
      {
        resourceType: "HealthcareService",
        endpoint: [{ reference: "Endpoint/missing" }],
      },
      [],
      registry,
      { existingReferences: new Set(["Endpoint/existing"]) }
    );
    expect(missingTarget.some((issue) => issue.code === "reference-broken")).toBe(true);

    const resolvedTarget = validateResourceWithProfile(
      {
        resourceType: "HealthcareService",
        endpoint: [{ reference: "/fhir/Endpoint/existing" }],
      },
      [],
      registry,
      { existingReferences: new Set(["Endpoint/existing"]) }
    );
    expect(resolvedTarget.some((issue) => issue.code === "reference-broken")).toBe(false);
  });
});
