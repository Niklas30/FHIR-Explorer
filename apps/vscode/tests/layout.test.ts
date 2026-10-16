import { describe, expect, it } from "vitest";
import {
  directoryForKind,
  fileNameForResource,
  kindOfResource,
  serializeResource,
} from "@/workspace/layout";

describe("on-disk layout", () => {
  it("classifies by resource content, not by folder", () => {
    // A profile the user moved into the examples folder by hand is still a
    // profile — the content decides.
    expect(kindOfResource({ resourceType: "StructureDefinition" })).toBe("profile");
    expect(
      kindOfResource({ resourceType: "StructureDefinition", type: "Extension" })
    ).toBe("extension");
    expect(kindOfResource({ resourceType: "ValueSet" })).toBe("valueset");
    expect(kindOfResource({ resourceType: "CodeSystem" })).toBe("codesystem");
    expect(kindOfResource({ resourceType: "Patient" })).toBe("example");
  });

  it("treats anything unreadable as an example rather than throwing", () => {
    expect(kindOfResource(null)).toBe("example");
    expect(kindOfResource("not a resource")).toBe("example");
    expect(kindOfResource([])).toBe("example");
  });

  it("writes value sets and code systems into the shared vocabulary folder", () => {
    expect(directoryForKind("profile")).toBe("input/profiles");
    expect(directoryForKind("extension")).toBe("input/extensions");
    expect(directoryForKind("valueset")).toBe("input/vocabulary");
    expect(directoryForKind("codesystem")).toBe("input/vocabulary");
    expect(directoryForKind("example")).toBe("input/examples");
  });

  it("names files the way the IG Publisher expects", () => {
    expect(fileNameForResource("StructureDefinition", "MyPatient")).toBe(
      "StructureDefinition-MyPatient.json"
    );
    expect(fileNameForResource("ValueSet", "specialty-vs")).toBe(
      "ValueSet-specialty-vs.json"
    );
  });

  it("keeps ids that contain path or url characters out of the file name", () => {
    expect(fileNameForResource("Patient", "../../etc/passwd")).toBe(
      "Patient-etc-passwd.json"
    );
    expect(fileNameForResource("ValueSet", "http://example.org/vs")).toBe(
      "ValueSet-http-example.org-vs.json"
    );
  });

  it("falls back to the bare resource type when there is no usable id", () => {
    expect(fileNameForResource("Patient", undefined)).toBe("Patient.json");
    expect(fileNameForResource("Patient", "///")).toBe("Patient.json");
  });

  it("serializes with two spaces and a trailing newline", () => {
    expect(serializeResource({ resourceType: "Patient", id: "x" })).toBe(
      '{\n  "resourceType": "Patient",\n  "id": "x"\n}\n'
    );
  });
});
