import { describe, expect, it } from "vitest";
import type { ResourcePayload } from "@fhir-explorer/core/fhir-importer/types";
import { planClone } from "@/project/clone-plan";

const payload = (content: unknown, key = String(Math.random())): ResourcePayload =>
  ({ key, packageKey: "src@1.0.0", resourceType: "x", content }) as ResourcePayload;

describe("planClone", () => {
  it("files each resource by what it is, not by where it came from", () => {
    const plan = planClone([
      payload({ resourceType: "StructureDefinition", id: "MyPatient" }),
      payload({ resourceType: "StructureDefinition", id: "MyExt", type: "Extension" }),
      payload({ resourceType: "ValueSet", id: "specialty" }),
      payload({ resourceType: "CodeSystem", id: "origin" }),
      payload({ resourceType: "Patient", id: "example" }),
    ]);

    expect(plan.files.map((file) => file.path)).toEqual([
      "input/profiles/StructureDefinition-MyPatient.json",
      "input/extensions/StructureDefinition-MyExt.json",
      "input/vocabulary/ValueSet-specialty.json",
      "input/vocabulary/CodeSystem-origin.json",
      "input/examples/Patient-example.json",
    ]);
    expect(plan.skipped).toBe(0);
  });

  it("copies content verbatim, canonical included", () => {
    // The web app's duplicate does the same: rewriting urls on a fork would
    // break every reference between the copied resources.
    const content = {
      resourceType: "StructureDefinition",
      id: "MyPatient",
      url: "https://gematik.de/fhir/StructureDefinition/MyPatient",
      baseDefinition: "http://hl7.org/fhir/StructureDefinition/Patient",
    };
    const [file] = planClone([payload(content)]).files;
    expect(file.content).toEqual(content);
  });

  it("keeps both resources when two derive the same file name", () => {
    // Same id under the same type in one package is unusual but real, and
    // overwriting would drop a resource with nothing to show for it.
    const plan = planClone([
      payload({ resourceType: "ValueSet", id: "dup" }, "a"),
      payload({ resourceType: "ValueSet", id: "dup" }, "b"),
      payload({ resourceType: "ValueSet", id: "dup" }, "c"),
    ]);

    expect(plan.files.map((file) => file.path)).toEqual([
      "input/vocabulary/ValueSet-dup.json",
      "input/vocabulary/ValueSet-dup-2.json",
      "input/vocabulary/ValueSet-dup-3.json",
    ]);
  });

  it("skips payloads that are not resources instead of failing the clone", () => {
    const plan = planClone([
      payload({ resourceType: "Patient", id: "ok" }),
      payload({ notAResource: true }),
      payload(null),
      payload([1, 2, 3]),
    ]);

    expect(plan.files).toHaveLength(1);
    expect(plan.skipped).toBe(3);
  });

  it("still files a resource that has no id", () => {
    const plan = planClone([payload({ resourceType: "Observation" })]);
    expect(plan.files[0].path).toBe("input/examples/Observation.json");
  });
});
