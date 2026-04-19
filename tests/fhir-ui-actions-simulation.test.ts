import { describe, expect, it } from "vitest";
import { validateResourceWithProfile } from "@/lib/fhir-editor/validation";
import {
  HEALTHCARE_SERVICE_EXAMPLE_PATH,
  createHealthcareServiceDirectoryFieldContext,
  loadFixtureJson,
} from "@/tests/helpers/fhir-test-fixtures";
import {
  addField,
  addFieldValue,
  addGroupChildFieldValue,
  addGroupEntry,
  removeField,
  removeFieldValueAt,
  removeGroupChildField,
  removeGroupChildFieldValueAt,
  removeGroupEntry,
  setField,
  setGroupChildField,
  updateFieldValue,
} from "@/tests/helpers/ui-action-simulator";

describe("FHIR UI action simulation", () => {
  it("simulates add/remove/re-add for required nested fields", () => {
    const { fields, registry } = createHealthcareServiceDirectoryFieldContext();
    const descriptionField = fields.find(
      (field) => field.path === "HealthcareService.notAvailable.description"
    );
    expect(descriptionField).toBeDefined();

    let resource = loadFixtureJson<Record<string, unknown>>(HEALTHCARE_SERVICE_EXAMPLE_PATH);

    resource = removeGroupChildField(
      resource,
      fields,
      "HealthcareService.notAvailable",
      "HealthcareService.notAvailable.description",
      0
    );
    let issues = validateResourceWithProfile(resource, [descriptionField!], registry);
    expect(issues.some((issue) => issue.code === "required")).toBe(true);

    resource = setGroupChildField(
      resource,
      fields,
      "HealthcareService.notAvailable",
      "HealthcareService.notAvailable.description",
      0,
      "Urlaub"
    );
    issues = validateResourceWithProfile(resource, [descriptionField!], registry);
    expect(issues.some((issue) => issue.code === "required")).toBe(false);

    resource = removeGroupEntry(resource, fields, "HealthcareService.notAvailable", 0);
    issues = validateResourceWithProfile(resource, [descriptionField!], registry);
    expect(issues.some((issue) => issue.code === "required")).toBe(false);

    resource = addGroupEntry(resource, fields, "HealthcareService.notAvailable");
    issues = validateResourceWithProfile(resource, [descriptionField!], registry);
    expect(issues.some((issue) => issue.code === "required")).toBe(true);
  });

  it("simulates repeating group actions for availableTime.daysOfWeek", () => {
    const { fields, registry } = createHealthcareServiceDirectoryFieldContext();
    const daysField = fields.find(
      (field) => field.path === "HealthcareService.availableTime.daysOfWeek"
    );
    expect(daysField).toBeDefined();

    let resource: Record<string, unknown> = { resourceType: "HealthcareService" };
    resource = addGroupEntry(resource, fields, "HealthcareService.availableTime");
    resource = addGroupChildFieldValue(
      resource,
      fields,
      "HealthcareService.availableTime",
      "HealthcareService.availableTime.daysOfWeek",
      0,
      "sat"
    );
    expect((resource.availableTime as Array<Record<string, unknown>>)[0]?.daysOfWeek).toEqual([
      "sat",
    ]);

    resource = addGroupChildFieldValue(
      resource,
      fields,
      "HealthcareService.availableTime",
      "HealthcareService.availableTime.daysOfWeek",
      0,
      "sun"
    );
    let issues = validateResourceWithProfile(resource, [daysField!], registry);
    expect(issues.some((issue) => issue.code === "cardinality-max")).toBe(true);

    resource = removeGroupChildFieldValueAt(
      resource,
      fields,
      "HealthcareService.availableTime",
      "HealthcareService.availableTime.daysOfWeek",
      0,
      0
    );
    issues = validateResourceWithProfile(resource, [daysField!], registry);
    expect(issues.some((issue) => issue.code === "cardinality-max")).toBe(false);
    expect((resource.availableTime as Array<Record<string, unknown>>)[0]?.daysOfWeek).toEqual([
      "sun",
    ]);

    resource = removeGroupChildField(
      resource,
      fields,
      "HealthcareService.availableTime",
      "HealthcareService.availableTime.daysOfWeek",
      0
    );
    expect(
      Object.prototype.hasOwnProperty.call(
        (resource.availableTime as Array<Record<string, unknown>>)[0] ?? {},
        "daysOfWeek"
      )
    ).toBe(false);

    resource = setGroupChildField(
      resource,
      fields,
      "HealthcareService.availableTime",
      "HealthcareService.availableTime.daysOfWeek",
      0,
      ["tue"]
    );
    expect((resource.availableTime as Array<Record<string, unknown>>)[0]?.daysOfWeek).toEqual([
      "tue",
    ]);
  });

  it("simulates reference and terminology editing actions with live validation changes", () => {
    const { fields, registry } = createHealthcareServiceDirectoryFieldContext();
    const endpointField = fields.find((field) => field.path === "HealthcareService.endpoint");
    const specialtyField = fields.find((field) => field.path === "HealthcareService.specialty");
    expect(endpointField).toBeDefined();
    expect(specialtyField).toBeDefined();

    let resource: Record<string, unknown> = { resourceType: "HealthcareService" };

    resource = addField(resource, fields, "HealthcareService.endpoint", registry);
    resource = updateFieldValue(resource, fields, "HealthcareService.endpoint", 0, {
      reference: "Endpoint/missing",
    });
    let issues = validateResourceWithProfile(resource, [endpointField!], registry, {
      existingReferences: new Set(["Endpoint/existing"]),
    });
    expect(issues.some((issue) => issue.code === "reference-broken")).toBe(true);

    resource = updateFieldValue(resource, fields, "HealthcareService.endpoint", 0, {
      reference: "/fhir/Endpoint/existing",
    });
    issues = validateResourceWithProfile(resource, [endpointField!], registry, {
      existingReferences: new Set(["Endpoint/existing"]),
    });
    expect(issues.some((issue) => issue.code === "reference-broken")).toBe(false);

    resource = removeFieldValueAt(resource, fields, "HealthcareService.endpoint", 0);
    expect(resource.endpoint).toEqual([]);

    resource = addField(resource, fields, "HealthcareService.specialty", registry);
    resource = updateFieldValue(resource, fields, "HealthcareService.specialty", 0, {
      coding: [{ system: "https://example.org/fhir/CodeSystem/specialty-local", code: "not-a-valid-code" }],
    });
    issues = validateResourceWithProfile(resource, [specialtyField!], registry);
    expect(issues.some((issue) => issue.code === "binding-code")).toBe(true);

    resource = updateFieldValue(resource, fields, "HealthcareService.specialty", 0, {
      coding: [{ system: "https://example.org/fhir/CodeSystem/specialty-local", code: "alpha" }],
    });
    issues = validateResourceWithProfile(resource, [specialtyField!], registry);
    expect(issues.some((issue) => issue.code === "binding-code")).toBe(false);
    expect(issues.some((issue) => issue.code === "binding-system")).toBe(false);
  });

  it("simulates root field add/remove and multi-value editing", () => {
    const { fields } = createHealthcareServiceDirectoryFieldContext();
    let resource: Record<string, unknown> = { resourceType: "HealthcareService" };

    resource = addField(resource, fields, "HealthcareService.telecom");
    resource = addFieldValue(resource, fields, "HealthcareService.telecom", {
      system: "phone",
      value: "030 1234567",
    });
    resource = addFieldValue(resource, fields, "HealthcareService.telecom", {
      system: "email",
      value: "test@example.org",
    });
    expect(Array.isArray(resource.telecom)).toBe(true);
    expect((resource.telecom as unknown[]).length).toBe(3);

    resource = setField(resource, fields, "HealthcareService.name", "Test Apotheke");
    expect(resource.name).toBe("Test Apotheke");

    resource = removeField(resource, fields, "HealthcareService.name");
    expect("name" in resource).toBe(false);
  });
});
