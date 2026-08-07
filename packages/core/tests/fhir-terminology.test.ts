import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearExpansionCacheForTests,
  expandValueSet,
} from "@fhir-explorer/core/fhir-editor/terminology";
import type { HttpClient } from "@fhir-explorer/core/ports";

const SERVER = "https://tx.example.org/r4";
const VALUE_SET = "http://example.org/fhir/ValueSet/specialty";

const expansionResponse = {
  resourceType: "ValueSet",
  expansion: {
    contains: [
      { system: "http://example.org/cs", code: "a", display: "Alpha" },
      {
        system: "http://example.org/cs",
        code: "b",
        display: "Beta",
        contains: [{ system: "http://example.org/cs", code: "b1", display: "Beta 1" }],
      },
    ],
  },
};

describe("terminology server expansion", () => {
  const getJson = vi.fn();
  const http: HttpClient = {
    getArrayBuffer: async () => new ArrayBuffer(0),
    getJson,
  };

  beforeEach(() => {
    clearExpansionCacheForTests();
    getJson.mockReset();
  });

  it("expands a ValueSet via $expand and flattens nested contains", async () => {
    getJson.mockResolvedValue(expansionResponse);

    const options = await expandValueSet(http, SERVER, VALUE_SET);

    expect(getJson).toHaveBeenCalledTimes(1);
    const requestedUrl = new URL(getJson.mock.calls[0][0] as string);
    expect(requestedUrl.pathname).toBe("/r4/ValueSet/$expand");
    expect(requestedUrl.searchParams.get("url")).toBe(VALUE_SET);
    expect(requestedUrl.searchParams.get("count")).toBe("200");

    expect(options.map((option) => option.code)).toEqual(["a", "b", "b1"]);
    expect(options[0]).toEqual({
      system: "http://example.org/cs",
      code: "a",
      display: "Alpha",
    });
  });

  it("caches expansions per server and canonical", async () => {
    getJson.mockResolvedValue(expansionResponse);

    await expandValueSet(http, SERVER, VALUE_SET);
    await expandValueSet(http, SERVER, VALUE_SET);
    expect(getJson).toHaveBeenCalledTimes(1);

    await expandValueSet(http, SERVER, "http://example.org/fhir/ValueSet/other");
    expect(getJson).toHaveBeenCalledTimes(2);
  });

  it("degrades to an empty option list on server errors", async () => {
    getJson.mockRejectedValue(new Error("Request failed with status 500"));

    const options = await expandValueSet(http, SERVER, VALUE_SET);
    expect(options).toEqual([]);
  });

  it("degrades to an empty option list on network failures", async () => {
    getJson.mockRejectedValue(new Error("offline"));

    const options = await expandValueSet(http, SERVER, VALUE_SET);
    expect(options).toEqual([]);
  });
});
