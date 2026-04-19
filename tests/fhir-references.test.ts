import { describe, expect, it } from "vitest";
import { collectBrokenReferences, parseLocalReference } from "@/lib/fhir-editor/references";

describe("FHIR references", () => {
  it("normalizes supported local reference variants", () => {
    expect(parseLocalReference("Endpoint/test")).toMatchObject({
      resourceType: "Endpoint",
      id: "test",
      key: "Endpoint/test",
    });
    expect(parseLocalReference("./Endpoint/test")).toMatchObject({
      key: "Endpoint/test",
    });
    expect(parseLocalReference("/fhir/Endpoint/test")).toMatchObject({
      key: "Endpoint/test",
    });
    expect(parseLocalReference("Endpoint/test/_history/2")).toMatchObject({
      key: "Endpoint/test",
    });
    expect(parseLocalReference("Endpoint/test?foo=bar#frag")).toMatchObject({
      key: "Endpoint/test",
    });
  });

  it("ignores non-local references", () => {
    expect(parseLocalReference("https://server/fhir/Endpoint/test")).toBeNull();
    expect(parseLocalReference("urn:uuid:1234")).toBeNull();
    expect(parseLocalReference("#contained")).toBeNull();
  });

  it("detects broken local references with normalized target keys", () => {
    const content = {
      endpoint: [
        { reference: "/fhir/Endpoint/existing" },
        { reference: "Endpoint/missing" },
      ],
    };
    const issues = collectBrokenReferences(content, new Set(["Endpoint/existing"]));

    expect(issues).toEqual([
      {
        reference: "Endpoint/missing",
        targetKey: "Endpoint/missing",
        jsonPath: "endpoint[1].reference",
      },
    ]);
  });
});
