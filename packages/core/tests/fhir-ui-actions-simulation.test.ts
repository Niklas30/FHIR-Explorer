import { describe, expect, it } from "vitest";
import { createDefaultValue, validateResource } from "@/lib/fhir-editor/schema";
import { getSliceDiscriminatorPattern } from "@/lib/fhir-editor/schema/slicing";
import {
  HEALTHCARE_SERVICE_EXAMPLE_PATH,
  createHealthcareServiceDirectoryContext,
  createPatientProfileContext,
  loadFixtureJson,
} from "@/tests/helpers/fhir-test-fixtures";
import {
  addElement,
  addItem,
  duplicateItem,
  findChildNode,
  getRootChildren,
  moveItem,
  removeElement,
  removeItemAt,
  setElement,
  updateItem,
  withItem,
} from "@/tests/helpers/ui-action-simulator";

describe("FHIR UI action simulation", () => {
  it("simulates add/remove/re-add for required nested fields", () => {
    const { tree, ctx } = createHealthcareServiceDirectoryContext();
    let resource = loadFixtureJson<Record<string, unknown>>(HEALTHCARE_SERVICE_EXAMPLE_PATH);

    resource = withItem(resource, "notAvailable", 0, (item) =>
      setElement(item, "description", undefined)
    );
    let issues = validateResource(resource, tree, ctx);
    expect(issues.some((issue) => issue.code === "required")).toBe(true);

    resource = withItem(resource, "notAvailable", 0, (item) =>
      setElement(item, "description", "Urlaub")
    );
    issues = validateResource(resource, tree, ctx);
    expect(issues.some((issue) => issue.code === "required")).toBe(false);

    resource = removeItemAt(resource, "notAvailable", 0);
    issues = validateResource(resource, tree, ctx);
    expect(issues.some((issue) => issue.code === "required")).toBe(false);

    resource = addItem(resource, "notAvailable", {});
    issues = validateResource(resource, tree, ctx);
    expect(issues.some((issue) => issue.code === "required")).toBe(true);
  });

  it("simulates repeating group actions for availableTime.daysOfWeek", () => {
    const { tree, ctx } = createHealthcareServiceDirectoryContext();
    let resource: Record<string, unknown> = { resourceType: "HealthcareService" };

    resource = addItem(resource, "availableTime", {});
    resource = withItem(resource, "availableTime", 0, (item) =>
      addItem(item, "daysOfWeek", "sat")
    );
    expect((resource.availableTime as Array<Record<string, unknown>>)[0]?.daysOfWeek).toEqual([
      "sat",
    ]);

    resource = withItem(resource, "availableTime", 0, (item) =>
      addItem(item, "daysOfWeek", "sun")
    );
    let issues = validateResource(resource, tree, ctx);
    expect(issues.some((issue) => issue.code === "cardinality-max")).toBe(true);

    resource = withItem(resource, "availableTime", 0, (item) =>
      removeItemAt(item, "daysOfWeek", 0)
    );
    issues = validateResource(resource, tree, ctx);
    expect(issues.some((issue) => issue.code === "cardinality-max")).toBe(false);
    expect((resource.availableTime as Array<Record<string, unknown>>)[0]?.daysOfWeek).toEqual([
      "sun",
    ]);

    resource = withItem(resource, "availableTime", 0, (item) =>
      setElement(item, "daysOfWeek", undefined)
    );
    expect(
      Object.prototype.hasOwnProperty.call(
        (resource.availableTime as Array<Record<string, unknown>>)[0] ?? {},
        "daysOfWeek"
      )
    ).toBe(false);
  });

  it("simulates reference and terminology editing with live validation changes", () => {
    const { tree, ctx } = createHealthcareServiceDirectoryContext();
    let resource: Record<string, unknown> = { resourceType: "HealthcareService" };

    resource = addItem(resource, "endpoint", { reference: "Endpoint/missing" });
    let issues = validateResource(resource, tree, ctx, {
      existingReferences: new Set(["Endpoint/existing"]),
    });
    expect(issues.some((issue) => issue.code === "reference-broken")).toBe(true);

    resource = updateItem(resource, "endpoint", 0, {
      reference: "/fhir/Endpoint/existing",
    });
    issues = validateResource(resource, tree, ctx, {
      existingReferences: new Set(["Endpoint/existing"]),
    });
    expect(issues.some((issue) => issue.code === "reference-broken")).toBe(false);

    resource = addItem(resource, "specialty", {
      coding: [
        {
          system: "https://example.org/fhir/CodeSystem/specialty-local",
          code: "not-a-valid-code",
        },
      ],
    });
    issues = validateResource(resource, tree, ctx);
    expect(issues.some((issue) => issue.code === "binding-code")).toBe(true);

    resource = updateItem(resource, "specialty", 0, {
      coding: [
        { system: "https://example.org/fhir/CodeSystem/specialty-local", code: "alpha" },
      ],
    });
    issues = validateResource(resource, tree, ctx);
    expect(issues.some((issue) => issue.code === "binding-code")).toBe(false);
  });

  it("simulates root field add/remove with schema defaults", () => {
    const { tree, ctx } = createHealthcareServiceDirectoryContext();
    const rootChildren = getRootChildren(tree, ctx);
    let resource: Record<string, unknown> = { resourceType: "HealthcareService" };

    const nameNode = findChildNode(rootChildren, "name");
    resource = addElement(resource, nameNode);
    expect("name" in resource).toBe(true);

    resource = setElement(resource, "name", "Test Apotheke");
    expect(resource.name).toBe("Test Apotheke");

    resource = removeElement(resource, nameNode);
    expect("name" in resource).toBe(false);

    const telecomNode = findChildNode(rootChildren, "telecom");
    resource = addElement(resource, telecomNode);
    expect(Array.isArray(resource.telecom)).toBe(true);
    resource = addItem(resource, "telecom", { system: "phone", value: "030 1234567" });
    resource = addItem(resource, "telecom", { system: "email", value: "test@example.org" });
    expect((resource.telecom as unknown[]).length).toBe(3);
  });

  it("simulates list reordering and duplication", () => {
    let resource: Record<string, unknown> = {
      resourceType: "Patient",
      name: [{ family: "A" }, { family: "B" }],
    };
    resource = moveItem(resource, "name", 1, -1);
    expect((resource.name as Array<{ family: string }>).map((entry) => entry.family)).toEqual([
      "B",
      "A",
    ]);
    resource = duplicateItem(resource, "name", 0);
    expect((resource.name as Array<{ family: string }>).map((entry) => entry.family)).toEqual([
      "B",
      "B",
      "A",
    ]);
  });

  it("simulates choice type selection like the editor does", () => {
    const { tree, ctx } = createPatientProfileContext();
    const rootChildren = getRootChildren(tree, ctx);
    const deceased = rootChildren.find((child) => child.key.startsWith("deceased"));
    expect(deceased).toBeDefined();

    let resource: Record<string, unknown> = {
      resourceType: "Patient",
      name: [{ family: "Muster" }],
      identifier: [{ system: "https://example.org/mrn", value: "1" }],
    };
    resource = setElement(
      resource,
      "deceasedBoolean",
      createDefaultValue(deceased!, "boolean")
    );
    expect(resource.deceasedBoolean).toBe(false);
    const issues = validateResource(resource, tree, ctx);
    expect(issues.filter((issue) => issue.severity === "error")).toEqual([]);
  });

  it("simulates adding slice entries pre-filled with the discriminator", () => {
    const { tree, ctx } = createPatientProfileContext();
    const rootChildren = getRootChildren(tree, ctx);
    const identifier = rootChildren.find((child) => child.key === "identifier");
    const mrn = identifier!.slices[0];

    const pattern = getSliceDiscriminatorPattern(mrn, ctx);
    let resource: Record<string, unknown> = {
      resourceType: "Patient",
      name: [{ family: "Muster" }],
    };
    let issues = validateResource(resource, tree, ctx);
    // The mrn slice is required (min 1) → base identifier element is required.
    expect(issues.some((issue) => issue.code === "required")).toBe(true);

    resource = addItem(resource, "identifier", { ...pattern, value: "0815" });
    issues = validateResource(resource, tree, ctx);
    expect(issues.filter((issue) => issue.severity === "error")).toEqual([]);
    expect(resource.identifier).toEqual([
      { system: "https://example.org/mrn", value: "0815" },
    ]);
  });
});
