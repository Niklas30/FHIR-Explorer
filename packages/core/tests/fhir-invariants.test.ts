import { describe, expect, it } from "vitest";
import { collectInvariants, evaluateInvariants } from "@/lib/fhir-editor/schema";
import {
  SURVEY_URL,
  createPatientProfileContext,
  createSchemaFixtureContext,
} from "@/tests/helpers/fhir-test-fixtures";

describe("FHIRPath invariants", () => {
  it("collects profile invariants and skips base noise (ele-1/dom-*)", () => {
    const { tree } = createPatientProfileContext();
    const invariants = collectInvariants(tree);
    const keys = invariants.map((invariant) => invariant.key);
    expect(keys).toContain("pat-prof-1");
    expect(keys.some((key) => key === "ele-1" || key.startsWith("dom-"))).toBe(false);
  });

  it("reports violated root invariants", async () => {
    const { tree } = createPatientProfileContext();
    const issues = await evaluateInvariants(
      // deceasedBoolean present but no name → pat-prof-1 must fire.
      { resourceType: "Patient", deceasedBoolean: true },
      tree
    );
    expect(
      issues.some(
        (issue) => issue.code === "invariant-pat-prof-1" && issue.severity === "error"
      )
    ).toBe(true);
  });

  it("stays silent when invariants hold", async () => {
    const { tree } = createPatientProfileContext();
    const issues = await evaluateInvariants(
      { resourceType: "Patient", deceasedBoolean: true, name: [{ family: "Muster" }] },
      tree
    );
    expect(issues.find((issue) => issue.code === "invariant-pat-prof-1")).toBeUndefined();
  });

  it("evaluates element-level invariants per instance via all()", async () => {
    const { tree } = createSchemaFixtureContext(SURVEY_URL);

    const violated = await evaluateInvariants(
      {
        resourceType: "Survey",
        item: [{ linkId: "1", text: "ok" }, { linkId: "2" }],
      },
      tree
    );
    const issue = violated.find((entry) => entry.code === "invariant-sur-1");
    expect(issue?.severity).toBe("warning");
    expect(issue?.path).toBe("item");

    const satisfied = await evaluateInvariants(
      { resourceType: "Survey", item: [{ linkId: "1", text: "ok" }] },
      tree
    );
    expect(satisfied.find((entry) => entry.code === "invariant-sur-1")).toBeUndefined();

    // Absent elements satisfy element-level invariants vacuously.
    const absent = await evaluateInvariants({ resourceType: "Survey" }, tree);
    expect(absent.find((entry) => entry.code === "invariant-sur-1")).toBeUndefined();
  });
});
