import { describe, expect, it } from "vitest";
import { isRepeatingField, resolveValueSetChoices } from "@/lib/fhir-editor/fields";
import { createHealthcareServiceDirectoryFieldContext } from "@/tests/helpers/fhir-test-fixtures";

describe("FHIR profiles and fields", () => {
  it("keeps base cardinality for JSON shape on constrained fields", () => {
    const { fields } = createHealthcareServiceDirectoryFieldContext();
    const daysOfWeek = fields.find(
      (field) => field.path === "HealthcareService.availableTime.daysOfWeek"
    );

    expect(daysOfWeek).toBeDefined();
    expect(daysOfWeek?.max).toBe("1");
    expect(daysOfWeek?.baseMax).toBe("*");
    expect(isRepeatingField(daysOfWeek!)).toBe(true);
  });

  it("resolves binding options across nested value sets and code systems", () => {
    const { fields, registry } = createHealthcareServiceDirectoryFieldContext();
    const specialty = fields.find((field) => field.path === "HealthcareService.specialty");

    expect(specialty).toBeDefined();
    const options = resolveValueSetChoices(specialty!, registry);
    const keys = new Set(options.map((entry) => `${entry.system ?? ""}|${entry.code}`));

    expect(keys.has("https://example.org/fhir/CodeSystem/specialty-local|alpha")).toBe(true);
    expect(keys.has("https://example.org/fhir/CodeSystem/specialty-extra|gamma")).toBe(true);
  });
});
