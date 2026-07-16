import { describe, expect, it } from "vitest";
import { resolveValueSetOptions } from "@/lib/fhir-editor/registry";
import {
  getExtensionDefinitionTree,
  getExtensionUrl,
  getNodeChildren,
  getReferenceTargetTypes,
} from "@/lib/fhir-editor/schema";
import {
  getSliceDiscriminatorPattern,
  partitionItemsBySlice,
} from "@/lib/fhir-editor/schema/slicing";
import {
  BIRTH_PLACE_URL,
  SURVEY_URL,
  createHealthcareServiceDirectoryContext,
  createPatientProfileContext,
  createSchemaFixtureContext,
} from "@/tests/helpers/fhir-test-fixtures";

describe("schema tree", () => {
  it("exposes backbone element children inline", () => {
    const { tree, ctx } = createPatientProfileContext();
    const contact = tree.root.children.find((child) => child.key === "contact");
    expect(contact).toBeDefined();
    const { children, source } = getNodeChildren(contact!, "BackboneElement", ctx, tree);
    expect(source).toBe("inline");
    expect(children.map((child) => child.key)).toEqual(
      expect.arrayContaining(["relationship", "name", "period"])
    );
  });

  it("expands complex datatypes from their StructureDefinitions", () => {
    const { tree, ctx } = createPatientProfileContext();
    const name = tree.root.children.find((child) => child.key === "name");
    const { children, source } = getNodeChildren(name!, "HumanName", ctx, tree);
    expect(source).toBe("datatype");
    expect(children.map((child) => child.key)).toEqual(
      expect.arrayContaining(["use", "text", "family", "given", "period"])
    );
    // Datatype children can recurse further (HumanName.period → Period).
    const period = children.find((child) => child.key === "period");
    const periodChildren = getNodeChildren(period!, "Period", ctx, tree);
    expect(periodChildren.children.map((child) => child.key)).toEqual(
      expect.arrayContaining(["start", "end"])
    );
  });

  it("merges profile constraints over datatype children", () => {
    const { tree, ctx } = createPatientProfileContext();
    const name = tree.root.children.find((child) => child.key === "name");
    const { children } = getNodeChildren(name!, "HumanName", ctx, tree);
    const family = children.find((child) => child.key === "family");
    // PatientProfile raises Patient.name.family to min 1.
    expect(family?.min).toBe(1);
    // Metadata from the datatype definition is kept.
    expect(family?.short).toBe("Family name (often called 'Surname')");
  });

  it("marks repeating elements by structural cardinality, not profile max", () => {
    const { tree } = createHealthcareServiceDirectoryContext();
    const availableTime = tree.root.children.find((child) => child.key === "availableTime");
    const daysOfWeek = availableTime?.children.find((child) => child.key === "daysOfWeek");
    expect(daysOfWeek?.max).toBe("1");
    expect(daysOfWeek?.isArray).toBe(true);
  });

  it("models choice elements with their type variants", () => {
    const { tree } = createSchemaFixtureContext(
      "http://hl7.org/fhir/StructureDefinition/Patient"
    );
    const deceased = tree.root.children.find((child) => child.key === "deceased");
    expect(deceased?.isChoice).toBe(true);
    expect(deceased?.types.map((type) => type.code)).toEqual(["boolean", "dateTime"]);
  });

  it("narrows choice elements constrained via rename in a profile", () => {
    const { tree } = createPatientProfileContext();
    const deceased = tree.root.children.find((child) =>
      child.key.startsWith("deceased")
    );
    expect(deceased).toBeDefined();
    expect(deceased?.types.map((type) => type.code)).toEqual(["boolean"]);
  });

  it("resolves recursive structures via contentReference", () => {
    const { tree, ctx } = createSchemaFixtureContext(SURVEY_URL);
    const item = tree.root.children.find((child) => child.key === "item");
    const nested = item?.children.find((child) => child.key === "item");
    expect(nested?.contentReference).toBe("#Survey.item");
    const { children, source } = getNodeChildren(nested!, undefined, ctx, tree);
    expect(source).toBe("content-reference");
    expect(children.map((child) => child.key)).toEqual(
      expect.arrayContaining(["linkId", "text", "item"])
    );
  });

  it("resolves reference target resource types from targetProfiles", () => {
    const { tree, ctx } = createPatientProfileContext();
    const managingOrganization = tree.root.children.find(
      (child) => child.key === "managingOrganization"
    );
    const targets = getReferenceTargetTypes(managingOrganization!, ctx);
    expect(targets.has("Organization")).toBe(true);
  });

  it("attaches named slices to their base element", () => {
    const { tree } = createPatientProfileContext();
    const identifier = tree.root.children.find((child) => child.key === "identifier");
    expect(identifier?.slices.map((slice) => slice.sliceName)).toEqual(["mrn"]);
    const mrn = identifier?.slices[0];
    expect(mrn?.min).toBe(1);
    expect(mrn?.children.find((child) => child.key === "system")?.fixedValue).toBe(
      "https://example.org/mrn"
    );
  });

  it("derives slice discriminators and partitions items", () => {
    const { tree, ctx } = createPatientProfileContext();
    const identifier = tree.root.children.find((child) => child.key === "identifier");
    const mrn = identifier!.slices[0];
    expect(getSliceDiscriminatorPattern(mrn, ctx)).toEqual({
      system: "https://example.org/mrn",
    });

    const items = [
      { system: "https://example.org/mrn", value: "123" },
      { system: "https://other.example.org", value: "abc" },
    ];
    const { bySlice, rest } = partitionItemsBySlice(identifier!, items, ctx);
    expect(bySlice.get("mrn")).toEqual([{ item: items[0], index: 0 }]);
    expect(rest).toEqual([{ item: items[1], index: 1 }]);
  });

  it("resolves extension definitions from slice type profiles", () => {
    const { tree, ctx } = createPatientProfileContext();
    const extension = tree.root.children.find((child) => child.key === "extension");
    const birthPlace = extension?.slices.find((slice) => slice.sliceName === "birthPlace");
    expect(birthPlace).toBeDefined();
    expect(getExtensionUrl(birthPlace!, ctx)).toBe(BIRTH_PLACE_URL);

    const definition = getExtensionDefinitionTree(birthPlace!, ctx);
    expect(definition).toBeTruthy();
    const value = definition!.root.children.find((child) => child.key === "value");
    expect(value?.min).toBe(1);
    expect(value?.types.map((type) => type.code)).toEqual(["string"]);
  });

  it("resolves complex extensions with nested sub-extensions", () => {
    const { tree, ctx } = createPatientProfileContext();
    const extension = tree.root.children.find((child) => child.key === "extension");
    const contactPreference = extension?.slices.find(
      (slice) => slice.sliceName === "contactPreference"
    );
    const definition = getExtensionDefinitionTree(contactPreference!, ctx);
    expect(definition).toBeTruthy();

    const subExtension = definition!.root.children.find(
      (child) => child.key === "extension"
    );
    expect(subExtension?.slices.map((slice) => slice.sliceName)).toEqual([
      "channel",
      "priority",
    ]);
    // value[x] is forbidden on the complex extension root.
    const value = definition!.root.children.find((child) => child.key === "value");
    expect(value === undefined || value.max === "0").toBe(true);

    // Sub-extension slices carry their own inline url/value definitions.
    const channel = subExtension!.slices[0];
    expect(getExtensionUrl(channel, ctx)).toBe("channel");
    const channelValue = channel.children.find((child) => child.key === "value");
    expect(channelValue?.types.map((type) => type.code)).toEqual(["code"]);
  });

  it("resolves bindings through nested ValueSets and CodeSystems", () => {
    const { tree, registry } = createHealthcareServiceDirectoryContext();
    const specialty = tree.root.children.find((child) => child.key === "specialty");
    expect(specialty?.binding?.valueSet).toBeTruthy();
    const options = resolveValueSetOptions(specialty!.binding!.valueSet, registry);
    const keys = new Set(options.map((option) => `${option.system ?? ""}|${option.code}`));
    expect(keys.has("https://example.org/fhir/CodeSystem/specialty-local|alpha")).toBe(true);
    expect(keys.has("https://example.org/fhir/CodeSystem/specialty-extra|gamma")).toBe(true);
  });

  it("guards against infinite recursion on self-referencing datatypes", () => {
    const { tree, ctx } = createPatientProfileContext();
    const extension = tree.root.children.find((child) => child.key === "extension");
    // Extension.extension → Extension: expansion must terminate.
    const level1 = getNodeChildren(extension!, "Extension", ctx, tree);
    const nested = level1.children.find((child) => child.key === "extension");
    expect(nested).toBeDefined();
    const level2 = getNodeChildren(nested!, "Extension", ctx, tree);
    expect(Array.isArray(level2.children)).toBe(true);
  });
});
