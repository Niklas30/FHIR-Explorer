import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearExpansionCacheForTests,
  expandValueSet,
} from "@/lib/fhir-editor/terminology";

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
  const fetchMock = vi.fn();

  beforeEach(() => {
    clearExpansionCacheForTests();
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("expands a ValueSet via $expand and flattens nested contains", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => expansionResponse,
    });

    const options = await expandValueSet(SERVER, VALUE_SET);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const requestedUrl = new URL(fetchMock.mock.calls[0][0] as string);
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
    fetchMock.mockResolvedValue({ ok: true, json: async () => expansionResponse });

    await expandValueSet(SERVER, VALUE_SET);
    await expandValueSet(SERVER, VALUE_SET);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await expandValueSet(SERVER, "http://example.org/fhir/ValueSet/other");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("degrades to an empty option list on server errors", async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 500, json: async () => ({}) });

    const options = await expandValueSet(SERVER, VALUE_SET);
    expect(options).toEqual([]);
  });

  it("degrades to an empty option list on network failures", async () => {
    fetchMock.mockRejectedValue(new Error("offline"));

    const options = await expandValueSet(SERVER, VALUE_SET);
    expect(options).toEqual([]);
  });
});
