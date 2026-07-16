import { describe, expect, it } from "vitest";
import {
  createPrimitiveExtensionNode,
  getPrimitiveCompanionKey,
  isEmptyCompanion,
  validateResource,
} from "@/lib/fhir-editor/schema";
import { createPatientProfileContext } from "@/tests/helpers/fhir-test-fixtures";

describe("primitive extensions", () => {
  it("derives companion keys and a synthetic extension node", () => {
    const { tree } = createPatientProfileContext();
    const active = tree.root.children.find((child) => child.key === "active");
    expect(active).toBeDefined();

    expect(getPrimitiveCompanionKey("active")).toBe("_active");
    const extensionNode = createPrimitiveExtensionNode(active!);
    expect(extensionNode.key).toBe("extension");
    expect(extensionNode.isArray).toBe(true);
    expect(extensionNode.types[0]?.code).toBe("Extension");
  });

  it("detects empty companions so they get removed from the JSON", () => {
    expect(isEmptyCompanion(undefined)).toBe(true);
    expect(isEmptyCompanion({})).toBe(true);
    expect(isEmptyCompanion({ extension: [] })).toBe(true);
    expect(isEmptyCompanion({ extension: [{ url: "x", valueString: "y" }] })).toBe(false);
    expect(isEmptyCompanion({ id: "el1" })).toBe(false);
    expect(isEmptyCompanion("nope")).toBe(false);
  });

  it("accepts companion objects during validation without unknown-element noise", () => {
    const { tree, ctx } = createPatientProfileContext();
    const issues = validateResource(
      {
        resourceType: "Patient",
        name: [{ family: "Muster" }],
        identifier: [{ system: "https://example.org/mrn", value: "1" }],
        active: true,
        _active: {
          extension: [{ url: "https://example.org/reliability", valueString: "high" }],
        },
      },
      tree,
      ctx
    );
    expect(issues.filter((issue) => issue.code === "unknown-element")).toEqual([]);
    expect(issues.filter((issue) => issue.severity === "error")).toEqual([]);
  });

  it("rejects companions that are not objects", () => {
    const { tree, ctx } = createPatientProfileContext();
    const issues = validateResource(
      {
        resourceType: "Patient",
        name: [{ family: "Muster" }],
        identifier: [{ system: "https://example.org/mrn", value: "1" }],
        active: true,
        _active: "not-an-object",
      },
      tree,
      ctx
    );
    expect(
      issues.some(
        (issue) => issue.code === "primitive-companion-invalid" && issue.path === "_active"
      )
    ).toBe(true);
  });
});
