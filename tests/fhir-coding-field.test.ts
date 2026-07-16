import { describe, expect, it } from "vitest";
import {
  readCoding,
  writeCoding,
} from "@/components/editor/resource-detail/field-input/utils";

describe("coding field read/write", () => {
  it("edits Coding elements flat, never wrapped in a coding array", () => {
    // Endpoint.connectionType (R4) is a plain Coding — writing must keep
    // system/code on the value itself.
    const next = writeCoding("Coding", {}, { system: "https://example.org/cs", code: "kim" });
    expect(next).toEqual({ system: "https://example.org/cs", code: "kim" });
    expect("coding" in next).toBe(false);
  });

  it("preserves sibling properties like extensions on Coding elements", () => {
    const value = {
      extension: [{ url: "https://example.org/ext", valueBoolean: true }],
      system: "https://example.org/cs",
      code: "old",
    };
    const next = writeCoding("Coding", value, {
      system: "https://example.org/cs",
      code: "new",
    });
    expect(next.extension).toEqual(value.extension);
    expect(next.code).toBe("new");
  });

  it("self-heals Coding values corrupted into CodeableConcept shape", () => {
    // Earlier editor versions wrote { coding: [...] } into Coding elements.
    const corrupted = { coding: [{ system: "https://example.org/cs", code: "kim" }] };
    // Reading still surfaces the nested coding so nothing looks empty…
    expect(readCoding("Coding", corrupted)).toEqual({
      system: "https://example.org/cs",
      code: "kim",
    });
    // …and the next write drops the stray wrapper.
    const next = writeCoding("Coding", corrupted, {
      system: "https://example.org/cs",
      code: "kim",
      display: "KIM",
    });
    expect(next).toEqual({
      system: "https://example.org/cs",
      code: "kim",
      display: "KIM",
    });
  });

  it("edits CodeableConcept elements via coding[0] and keeps text", () => {
    const value = { text: "free text", coding: [{ code: "a" }] };
    expect(readCoding("CodeableConcept", value)).toEqual({ code: "a" });
    const next = writeCoding("CodeableConcept", value, { code: "b" });
    expect(next).toEqual({ text: "free text", coding: [{ code: "b" }] });
  });

  it("reads empty codings from non-object values", () => {
    expect(readCoding("Coding", undefined)).toEqual({});
    expect(readCoding("CodeableConcept", "nope")).toEqual({});
    expect(readCoding("CodeableConcept", {})).toEqual({});
  });
});
