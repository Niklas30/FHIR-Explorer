import { describe, expect, it } from "vitest";
import type { AuthoredResource } from "@fhir-explorer/core/projects/types";
import { issueTargets } from "@/language/issue-targets";

const resource = (id: string, url: string): AuthoredResource => ({
  id,
  kind: "valueset",
  resourceType: "ValueSet",
  content: { resourceType: "ValueSet", url },
  createdAt: 0,
  updatedAt: 0,
});

describe("issueTargets", () => {
  it("reports an issue about one resource in that file, at its path", () => {
    expect(
      issueTargets(
        { severity: "error", code: "base-unresolved", resourceId: "input/profiles/a.json", path: "baseDefinition" },
        []
      )
    ).toEqual([{ resourceId: "input/profiles/a.json", path: "baseDefinition" }]);
  });

  it("reports a duplicate canonical in every file that claims it", () => {
    const resources = [
      resource("input/vocabulary/a.json", "https://x/ValueSet/dup"),
      resource("input/vocabulary/b.json", "https://x/ValueSet/dup"),
      resource("input/vocabulary/c.json", "https://x/ValueSet/other"),
    ];
    expect(
      issueTargets(
        { severity: "error", code: "duplicate-canonical", target: "https://x/ValueSet/dup", count: 2 },
        resources
      )
    ).toEqual([
      { resourceId: "input/vocabulary/a.json", path: "url" },
      { resourceId: "input/vocabulary/b.json", path: "url" },
    ]);
  });

  it("puts a project-wide issue on the manifest", () => {
    expect(issueTargets({ severity: "warning", code: "missing-core" }, [])).toEqual([{}]);
  });
});
