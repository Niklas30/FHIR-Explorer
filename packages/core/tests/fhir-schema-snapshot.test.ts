import { describe, expect, it } from "vitest";
import { getStructureDefinitionByCanonical } from "@/lib/fhir-editor/registry";
import {
  createSchemaContext,
  matchChoiceRename,
  resolveSnapshotElements,
} from "@/lib/fhir-editor/schema";
import {
  BIRTH_PLACE_URL,
  DIRECTORY_PROFILE_URL,
  PATIENT_PROFILE_URL,
  createFixtureRegistry,
} from "@/tests/helpers/fhir-test-fixtures";

const buildContext = () => {
  const registry = createFixtureRegistry();
  return { registry, ctx: createSchemaContext(registry) };
};

describe("snapshot generation", () => {
  it("keeps shipped snapshots untouched", () => {
    const { registry, ctx } = buildContext();
    const base = getStructureDefinitionByCanonical(
      registry,
      "http://hl7.org/fhir/StructureDefinition/Patient"
    );
    const elements = resolveSnapshotElements(base!, ctx);
    expect(elements).toBe(base!.snapshot!.element);
  });

  it("generates a snapshot for a differential-only profile", () => {
    const { registry, ctx } = buildContext();
    const profile = getStructureDefinitionByCanonical(registry, PATIENT_PROFILE_URL);
    const elements = resolveSnapshotElements(profile!, ctx);
    const ids = elements.map((element) => element.id);

    // All base elements survive, including ones not mentioned in the diff.
    expect(ids).toContain("Patient.active");
    expect(ids).toContain("Patient.contact.relationship");
    expect(ids).toContain("Patient.managingOrganization");

    // Diff constraints are merged onto base elements.
    const name = elements.find((element) => element.id === "Patient.name");
    expect(name?.min).toBe(1);
    expect(name?.mustSupport).toBe(true);
    // Structural cardinality is preserved for JSON-shape decisions.
    expect(name?.base?.max).toBe("*");
    // Base metadata (types, short) is inherited.
    expect(name?.type?.[0]?.code).toBe("HumanName");
    expect(name?.short).toBe("A name associated with the patient");
  });

  it("inserts slices after the sliced base element", () => {
    const { registry, ctx } = buildContext();
    const profile = getStructureDefinitionByCanonical(registry, PATIENT_PROFILE_URL);
    const elements = resolveSnapshotElements(profile!, ctx);
    const ids = elements.map((element) => element.id);

    const baseIndex = ids.indexOf("Patient.identifier");
    const sliceIndex = ids.indexOf("Patient.identifier:mrn");
    const sliceChildIndex = ids.indexOf("Patient.identifier:mrn.system");
    expect(baseIndex).toBeGreaterThan(-1);
    expect(sliceIndex).toBe(baseIndex + 1);
    expect(sliceChildIndex).toBe(sliceIndex + 1);

    const slice = elements[sliceIndex];
    expect(slice.sliceName).toBe("mrn");
    expect(slice.min).toBe(1);
    expect(slice.max).toBe("1");
    // Slices inherit the type from the sliced element.
    expect(slice.type?.[0]?.code).toBe("Identifier");
  });

  it("applies choice-rename constraints (deceasedBoolean onto deceased[x])", () => {
    const { registry, ctx } = buildContext();
    const profile = getStructureDefinitionByCanonical(registry, PATIENT_PROFILE_URL);
    const elements = resolveSnapshotElements(profile!, ctx);

    const deceased = elements.find((element) =>
      element.path?.startsWith("Patient.deceased")
    );
    expect(deceased).toBeDefined();
    expect(deceased?.type?.map((type) => type.code)).toEqual(["boolean"]);
    // The renamed path replaces the choice path.
    expect(deceased?.path).toBe("Patient.deceasedBoolean");
  });

  it("generates snapshots for extension definitions based on Extension", () => {
    const { registry, ctx } = buildContext();
    const extension = getStructureDefinitionByCanonical(registry, BIRTH_PLACE_URL);
    const elements = resolveSnapshotElements(extension!, ctx);
    const byId = new Map(elements.map((element) => [element.id, element]));

    const url = byId.get("Extension.url") as { fixedUri?: string } | undefined;
    expect(url?.fixedUri).toBe(BIRTH_PLACE_URL);

    const value = byId.get("Extension.value[x]");
    expect(value?.min).toBe(1);
    expect(value?.type?.map((type) => type.code)).toEqual(["string"]);

    // Untouched base elements (nested extension) remain present.
    expect(byId.has("Extension.extension")).toBe(true);
  });

  it("resolves profiles on profiles transitively", () => {
    const { registry, ctx } = buildContext();
    const profile = getStructureDefinitionByCanonical(registry, DIRECTORY_PROFILE_URL);
    const elements = resolveSnapshotElements(profile!, ctx);
    const byId = new Map(elements.map((element) => [element.id, element]));

    // From the local base (snapshot).
    expect(byId.has("HealthcareService.notAvailable.description")).toBe(true);
    // Constrained by the profile differential.
    const daysOfWeek = byId.get("HealthcareService.availableTime.daysOfWeek");
    expect(daysOfWeek?.max).toBe("1");
    expect(daysOfWeek?.base?.max).toBe("*");
  });
});

describe("matchChoiceRename", () => {
  it("matches renamed choice properties", () => {
    expect(matchChoiceRename("deceasedBoolean", "deceased[x]")).toBe("Boolean");
    expect(matchChoiceRename("valueCodeableConcept", "value[x]")).toBe("CodeableConcept");
    expect(matchChoiceRename("deceased", "deceased[x]")).toBeUndefined();
    expect(matchChoiceRename("deceasedboolean", "deceased[x]")).toBeUndefined();
    expect(matchChoiceRename("somethingElse", "deceased[x]")).toBeUndefined();
  });
});
