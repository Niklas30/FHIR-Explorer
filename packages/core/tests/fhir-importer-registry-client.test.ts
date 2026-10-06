import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import type { HttpClient } from "@fhir-explorer/core/ports";
import { RegistryClient } from "@fhir-explorer/core/fhir-importer/registry-client";

/**
 * A package archive carrying nothing but its manifest — enough to prove where
 * the dependencies of a registry that does not publish them come from.
 */
const archive = async (manifest: Record<string, unknown>): Promise<ArrayBuffer> => {
  const zip = new JSZip();
  zip.file("package/package.json", JSON.stringify(manifest));
  const bytes = await zip.generateAsync({ type: "uint8array" });
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
};

const stubHttp = (
  json: Record<string, unknown>,
  archives: Record<string, ArrayBuffer> = {}
): HttpClient & { downloads: string[] } => {
  const downloads: string[] = [];
  return {
    downloads,
    getJson: async <T>(url: string) => {
      const body = json[url];
      if (!body) throw new Error(`unexpected request to ${url}`);
      return body as T;
    },
    getArrayBuffer: async (url: string) => {
      downloads.push(url);
      const buffer = archives[url];
      if (!buffer) throw new Error(`unexpected download of ${url}`);
      return buffer;
    },
  };
};

/** Shaped like packages.simplifier.net: a version map, no dependencies in it. */
const simplifierMetadata = {
  name: "kbv.basis",
  "dist-tags": { latest: "1.3.0" },
  versions: {
    "1.3.0": {
      name: "kbv.basis",
      version: "1.3.0",
      dist: { tarball: "https://packages.example/kbv.basis/1.3.0" },
    },
  },
};

describe("RegistryClient.dependencies", () => {
  it("reads them from the metadata when the registry publishes them", async () => {
    const http = stubHttp({
      "https://packages.example/kbv.basis": {
        name: "kbv.basis",
        versions: {
          "1.3.0": { version: "1.3.0", dependencies: { "hl7.fhir.r4.core": "4.0.1" } },
        },
      },
    });
    const client = new RegistryClient(http, "https://packages.example");

    expect(await client.dependencies("kbv.basis", "1.3.0")).toEqual({
      "hl7.fhir.r4.core": "4.0.1",
    });
    expect(http.downloads).toEqual([]);
  });

  it("falls back to the manifest inside the archive when it does not", async () => {
    const http = stubHttp(
      { "https://packages.example/kbv.basis": simplifierMetadata },
      {
        "https://packages.example/kbv.basis/1.3.0": await archive({
          name: "kbv.basis",
          version: "1.3.0",
          dependencies: { "de.basisprofil.r4": "1.3.2" },
        }),
      }
    );
    const client = new RegistryClient(http, "https://packages.example");

    expect(await client.dependencies("kbv.basis", "1.3.0")).toEqual({
      "de.basisprofil.r4": "1.3.2",
    });
  });

  it("downloads the archive once, however often the planner asks", async () => {
    const http = stubHttp(
      { "https://packages.example/kbv.basis": simplifierMetadata },
      {
        "https://packages.example/kbv.basis/1.3.0": await archive({
          name: "kbv.basis",
          version: "1.3.0",
        }),
      }
    );
    const client = new RegistryClient(http, "https://packages.example");

    await Promise.all([
      client.dependencies("kbv.basis", "1.3.0"),
      client.dependencies("kbv.basis", "1.3.0"),
    ]);
    await client.dependencies("kbv.basis", "1.3.0");

    expect(http.downloads).toHaveLength(1);
  });

  it("reports nothing for a version the registry does not have", async () => {
    const http = stubHttp({ "https://packages.example/kbv.basis": simplifierMetadata });
    const client = new RegistryClient(http, "https://packages.example");

    expect(await client.dependencies("kbv.basis", "9.9.9")).toEqual({});
    expect(http.downloads).toEqual([]);
  });
});
