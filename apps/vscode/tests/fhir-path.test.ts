import { describe, expect, it } from "vitest";
import { findNodeAtLocation, parseTree } from "jsonc-parser";
import { toJsonSegments } from "@/language/fhir-path";

describe("validation path -> json segments", () => {
  it("splits plain dotted paths", () => {
    expect(toJsonSegments("meta.profile")).toEqual(["meta", "profile"]);
  });

  it("turns array suffixes into numeric segments", () => {
    expect(toJsonSegments("name[0].given[1]")).toEqual(["name", 0, "given", 1]);
  });

  it("handles nested arrays on one segment", () => {
    expect(toJsonSegments("code.coding[0][1]")).toEqual(["code", "coding", 0, 1]);
  });

  it("returns nothing for the root path", () => {
    expect(toJsonSegments("")).toEqual([]);
  });

  it("addresses the node the validator meant", () => {
    // The contract that matters: the segments have to resolve against the
    // same document jsonc-parser sees.
    const text = JSON.stringify(
      {
        resourceType: "Patient",
        name: [{ given: ["Ada", "Byron"], family: "Lovelace" }],
      },
      null,
      2
    );
    const root = parseTree(text);
    expect(root).toBeDefined();

    const node = findNodeAtLocation(root!, toJsonSegments("name[0].given[1]"));
    expect(node?.value).toBe("Byron");

    const family = findNodeAtLocation(root!, toJsonSegments("name[0].family"));
    expect(family?.value).toBe("Lovelace");
  });

  it("resolves nothing for a path that is not in the document", () => {
    const root = parseTree(JSON.stringify({ resourceType: "Patient" }));
    expect(findNodeAtLocation(root!, toJsonSegments("name[0].given"))).toBeUndefined();
  });
});
