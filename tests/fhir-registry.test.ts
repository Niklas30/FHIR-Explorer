import { describe, expect, it } from "vitest";
import {
  getStructureDefinitionByCanonical,
  resolveValueSetOptions,
} from "@/lib/fhir-editor/registry";
import {
  DIRECTORY_PROFILE_URL,
  createFixtureRegistry,
} from "@/tests/helpers/fhir-test-fixtures";

describe("FHIR registry resolution", () => {
  it("resolves structure definitions by canonical URL variants", () => {
    const registry = createFixtureRegistry();

    expect(getStructureDefinitionByCanonical(registry, DIRECTORY_PROFILE_URL)).toBeDefined();
    expect(
      getStructureDefinitionByCanonical(
        registry,
        "http://example.org/fhir/StructureDefinition/HealthcareServiceDirectory"
      )
    ).toBeDefined();
    expect(
      getStructureDefinitionByCanonical(
        registry,
        "https://example.org/fhir/StructureDefinition/HealthcareServiceDirectory/"
      )
    ).toBeDefined();
  });

  it("resolves value set options including nested value sets", () => {
    const registry = createFixtureRegistry();
    const options = resolveValueSetOptions("https://example.org/fhir/ValueSet/specialty", registry);
    const keys = new Set(options.map((entry) => `${entry.system ?? ""}|${entry.code}`));

    expect(keys.has("https://example.org/fhir/CodeSystem/specialty-local|alpha")).toBe(true);
    expect(keys.has("https://example.org/fhir/CodeSystem/specialty-local|beta")).toBe(true);
    expect(keys.has("https://example.org/fhir/CodeSystem/specialty-extra|gamma")).toBe(true);
  });
});
