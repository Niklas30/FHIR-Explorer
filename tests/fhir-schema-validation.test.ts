import { describe, expect, it } from "vitest";
import { validateResource } from "@/lib/fhir-editor/schema";
import {
  createHealthcareServiceDirectoryContext,
  createPatientProfileContext,
} from "@/tests/helpers/fhir-test-fixtures";

describe("schema validation", () => {
  it("reports cardinality-array when a repeating field is serialized as single value", () => {
    const { tree, ctx } = createHealthcareServiceDirectoryContext();
    const issues = validateResource(
      {
        resourceType: "HealthcareService",
        availableTime: [{ daysOfWeek: "sat" }],
      },
      tree,
      ctx
    );
    expect(
      issues.some(
        (issue) =>
          issue.code === "cardinality-array" &&
          issue.path === "availableTime[0].daysOfWeek"
      )
    ).toBe(true);
  });

  it("reports cardinality-max when a profile-constrained list overflows", () => {
    const { tree, ctx } = createHealthcareServiceDirectoryContext();
    const issues = validateResource(
      {
        resourceType: "HealthcareService",
        availableTime: [{ daysOfWeek: ["sat", "sun"] }],
      },
      tree,
      ctx
    );
    expect(issues.some((issue) => issue.code === "cardinality-max")).toBe(true);
  });

  it("validates required fields inherited from the base profile", () => {
    const { tree, ctx } = createHealthcareServiceDirectoryContext();
    const issues = validateResource(
      {
        resourceType: "HealthcareService",
        notAvailable: [{}],
      },
      tree,
      ctx
    );
    expect(
      issues.some(
        (issue) =>
          issue.code === "required" && issue.path === "notAvailable[0].description"
      )
    ).toBe(true);
  });

  it("validates required constraints merged into datatype children", () => {
    const { tree, ctx } = createPatientProfileContext();
    const issues = validateResource(
      {
        resourceType: "Patient",
        name: [{ given: ["Anna"] }],
      },
      tree,
      ctx
    );
    // PatientProfile requires Patient.name.family.
    expect(
      issues.some(
        (issue) => issue.code === "required" && issue.path === "name[0].family"
      )
    ).toBe(true);
  });

  it("flags conflicting choice variants", () => {
    const { tree, ctx } = createPatientProfileContext();
    const issues = validateResource(
      {
        resourceType: "Patient",
        name: [{ family: "Muster" }],
        deceasedBoolean: true,
        deceasedDateTime: "2024-01-01",
      },
      tree,
      ctx
    );
    // The profile narrowed deceased[x] to boolean, so the dateTime variant is
    // at least unknown; on the unconstrained base it is a choice conflict.
    expect(
      issues.some(
        (issue) => issue.code === "choice-conflict" || issue.code === "unknown-element"
      )
    ).toBe(true);
  });

  it("validates fixed values from slices", () => {
    const { tree, ctx } = createPatientProfileContext();
    const issues = validateResource(
      {
        resourceType: "Patient",
        name: [{ family: "Muster" }],
        identifier: [{ system: "https://example.org/mrn", value: "123" }],
      },
      tree,
      ctx
    );
    expect(issues.filter((issue) => issue.severity === "error")).toEqual([]);
  });

  it("validates binding codes on CodeableConcepts", () => {
    const { tree, ctx } = createHealthcareServiceDirectoryContext();
    const invalid = validateResource(
      {
        resourceType: "HealthcareService",
        specialty: [
          {
            coding: [
              {
                system: "https://example.org/fhir/CodeSystem/specialty-local",
                code: "not-a-valid-code",
              },
            ],
          },
        ],
      },
      tree,
      ctx
    );
    expect(invalid.some((issue) => issue.code === "binding-code")).toBe(true);

    const valid = validateResource(
      {
        resourceType: "HealthcareService",
        specialty: [
          {
            coding: [
              {
                system: "https://example.org/fhir/CodeSystem/specialty-local",
                code: "alpha",
              },
            ],
          },
        ],
      },
      tree,
      ctx
    );
    expect(valid.some((issue) => issue.code === "binding-code")).toBe(false);
    expect(valid.some((issue) => issue.code === "binding-system")).toBe(false);
  });

  it("validates primitive codes against bound value sets", () => {
    const { tree, ctx } = createHealthcareServiceDirectoryContext();
    const issues = validateResource(
      {
        resourceType: "HealthcareService",
        availableTime: [{ daysOfWeek: ["definitely-not-a-day"] }],
      },
      tree,
      ctx
    );
    expect(issues.some((issue) => issue.code === "binding-primitive")).toBe(true);
  });

  it("reports unknown elements as warnings", () => {
    const { tree, ctx } = createHealthcareServiceDirectoryContext();
    const issues = validateResource(
      {
        resourceType: "HealthcareService",
        totallyMadeUp: true,
      },
      tree,
      ctx
    );
    const unknown = issues.find((issue) => issue.code === "unknown-element");
    expect(unknown?.severity).toBe("warning");
    expect(unknown?.path).toBe("totallyMadeUp");
  });

  it("includes broken reference checks in validation output", () => {
    const { tree, ctx } = createHealthcareServiceDirectoryContext();
    const missingTarget = validateResource(
      {
        resourceType: "HealthcareService",
        endpoint: [{ reference: "Endpoint/missing" }],
      },
      tree,
      ctx,
      { existingReferences: new Set(["Endpoint/existing"]) }
    );
    expect(missingTarget.some((issue) => issue.code === "reference-broken")).toBe(true);

    const resolvedTarget = validateResource(
      {
        resourceType: "HealthcareService",
        endpoint: [{ reference: "/fhir/Endpoint/existing" }],
      },
      tree,
      ctx,
      { existingReferences: new Set(["Endpoint/existing"]) }
    );
    expect(resolvedTarget.some((issue) => issue.code === "reference-broken")).toBe(false);
  });

  it("validates primitive formats", () => {
    const { tree, ctx } = createPatientProfileContext();
    const issues = validateResource(
      {
        resourceType: "Patient",
        name: [{ family: "Muster", period: { start: "not-a-date" } }],
      },
      tree,
      ctx
    );
    expect(
      issues.some(
        (issue) =>
          issue.code === "invalid-datetime" && issue.path === "name[0].period.start"
      )
    ).toBe(true);
  });
});
