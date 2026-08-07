import { describe, expect, it } from "vitest";
import {
  applyChanges,
  collectChanges,
  narrowReplacement,
} from "@/editor/json-diff";

const FORMATTING = { tabSize: 2, insertSpaces: true, eol: "\n" };

const PATIENT = `{
  "resourceType": "Patient",
  "id": "example",
  "name": [
    {
      "family": "Lovelace",
      "given": ["Ada"]
    }
  ],
  "gender": "female"
}
`;

const parse = (text: string) => JSON.parse(text) as Record<string, unknown>;

describe("collectChanges", () => {
  it("reports nothing when the value is unchanged", () => {
    expect(collectChanges(parse(PATIENT), parse(PATIENT))).toEqual([]);
  });

  it("reports only the property that changed", () => {
    const next = { ...parse(PATIENT), gender: "male" };
    expect(collectChanges(parse(PATIENT), next)).toEqual([
      { path: ["gender"], value: "male" },
    ]);
  });

  it("removes a property by reporting undefined", () => {
    const next = { ...parse(PATIENT) };
    delete next.gender;
    expect(collectChanges(parse(PATIENT), next)).toEqual([
      { path: ["gender"], value: undefined },
    ]);
  });

  it("descends into nested objects instead of replacing them", () => {
    const previous = { meta: { versionId: "1", lastUpdated: "now" } };
    const next = { meta: { versionId: "2", lastUpdated: "now" } };
    expect(collectChanges(previous, next)).toEqual([
      { path: ["meta", "versionId"], value: "2" },
    ]);
  });

  it("replaces an array as a whole", () => {
    const previous = { given: ["Ada"] };
    const next = { given: ["Ada", "Byron"] };
    expect(collectChanges(previous, next)).toEqual([
      { path: ["given"], value: ["Ada", "Byron"] },
    ]);
  });
});

describe("applyChanges", () => {
  it("changes the edited field and nothing else", () => {
    const next = applyChanges(
      PATIENT,
      collectChanges(parse(PATIENT), { ...parse(PATIENT), gender: "male" }),
      FORMATTING
    );

    expect(parse(next).gender).toBe("male");
    // Every other line survives byte for byte — that is the whole point.
    expect(next.split("\n").filter((line) => !line.includes("gender"))).toEqual(
      PATIENT.split("\n").filter((line) => !line.includes("gender"))
    );
  });

  it("applies several changes in one pass", () => {
    const target = { ...parse(PATIENT), gender: "male", active: true };
    const next = applyChanges(PATIENT, collectChanges(parse(PATIENT), target), FORMATTING);
    expect(parse(next)).toEqual(target);
  });

  it("keeps the document parseable when a property is removed", () => {
    const target = { ...parse(PATIENT) };
    delete target.gender;
    const next = applyChanges(PATIENT, collectChanges(parse(PATIENT), target), FORMATTING);
    expect(parse(next)).toEqual(target);
    expect(next).not.toContain("gender");
  });

  it("preserves unusual but valid formatting the user chose", () => {
    const compact = `{"resourceType":"Patient","id":"x"}`;
    const next = applyChanges(
      compact,
      collectChanges(parse(compact), { resourceType: "Patient", id: "y" }),
      FORMATTING
    );
    expect(parse(next)).toEqual({ resourceType: "Patient", id: "y" });
  });
});

describe("narrowReplacement", () => {
  it("returns null for identical text", () => {
    expect(narrowReplacement(PATIENT, PATIENT)).toBeNull();
  });

  it("spans only the differing bytes", () => {
    const next = PATIENT.replace('"female"', '"male"');
    const replacement = narrowReplacement(PATIENT, next);
    expect(replacement).not.toBeNull();
    // "female" and "male" share the trailing "male", so the edit is a pure
    // deletion of the two leading characters — narrower than replacing the
    // whole string literal.
    expect(PATIENT.slice(replacement!.start, replacement!.end)).toBe("fe");
    expect(replacement!.text).toBe("");
  });

  it("round-trips: applying the replacement reproduces the target", () => {
    const target = applyChanges(
      PATIENT,
      collectChanges(parse(PATIENT), { ...parse(PATIENT), active: true }),
      FORMATTING
    );
    const replacement = narrowReplacement(PATIENT, target);
    expect(replacement).not.toBeNull();
    const rebuilt =
      PATIENT.slice(0, replacement!.start) +
      replacement!.text +
      PATIENT.slice(replacement!.end);
    expect(rebuilt).toBe(target);
  });

  it("handles a pure insertion at the end", () => {
    const replacement = narrowReplacement("abc", "abcd");
    expect(replacement).toEqual({ start: 3, end: 3, text: "d" });
  });

  it("handles a pure deletion", () => {
    const replacement = narrowReplacement("abcd", "abc");
    expect(replacement).toEqual({ start: 3, end: 4, text: "" });
  });
});
