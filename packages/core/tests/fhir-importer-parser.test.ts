import { describe, expect, it } from "vitest";
import { detectArchiveFormat } from "@/lib/fhir-importer/archive";
import { parsePackage } from "@/lib/fhir-importer/parser";
import {
  buildTar,
  buildTgz,
  buildZip,
  dummyPackageFiles,
  toArrayBuffer,
} from "@/tests/helpers/package-archive-builder";

const expectDummyPackage = (parsed: Awaited<ReturnType<typeof parsePackage>>) => {
  expect(parsed.id).toBe("dummy.fhir.package");
  expect(parsed.version).toBe("1.2.3");
  expect(parsed.packageKey).toBe("dummy.fhir.package@1.2.3");
  expect(parsed.manifest.dependencies).toEqual({ "hl7.fhir.r4.core": "4.0.1" });

  const types = parsed.resources.map((resource) => resource.resourceType).sort();
  expect(types).toEqual(["Patient", "StructureDefinition", "ValueSet"]);
  // Metadata files (.index.json) must not surface as resources.
  expect(
    parsed.resources.every((resource) => !resource.sourcePath.endsWith(".index.json"))
  ).toBe(true);
  expect(parsed.warnings).toEqual([]);
};

describe("archive format detection", () => {
  it("detects gzip, zip and tar by magic bytes", async () => {
    expect(detectArchiveFormat(buildTgz(dummyPackageFiles()))).toBe("gzip");
    expect(detectArchiveFormat(buildTar(dummyPackageFiles()))).toBe("tar");
    expect(detectArchiveFormat(await buildZip(dummyPackageFiles()))).toBe("zip");
    expect(detectArchiveFormat(new TextEncoder().encode('{"resourceType":"Patient"}'))).toBe(
      "unknown"
    );
    expect(detectArchiveFormat(new Uint8Array([1, 2, 3, 4]))).toBe("unknown");
  });
});

describe("parsePackage", () => {
  it("imports npm-style .tgz packages", async () => {
    const parsed = await parsePackage(toArrayBuffer(buildTgz(dummyPackageFiles())));
    expectDummyPackage(parsed);
  });

  it("imports plain .tar packages (transparently decompressed downloads)", async () => {
    // Browsers strip the gzip layer of Content-Encoding responses but keep
    // the .tgz file name — this used to fail with a decode error.
    const parsed = await parsePackage(toArrayBuffer(buildTar(dummyPackageFiles())));
    expectDummyPackage(parsed);
  });

  it("imports .zip packages with the standard package/ layout", async () => {
    const parsed = await parsePackage(toArrayBuffer(await buildZip(dummyPackageFiles())));
    expectDummyPackage(parsed);
  });

  it("imports .zip packages with a flat root layout", async () => {
    const parsed = await parsePackage(toArrayBuffer(await buildZip(dummyPackageFiles(""))));
    expectDummyPackage(parsed);
  });

  it("imports .zip packages nested under a wrapper directory", async () => {
    const parsed = await parsePackage(
      toArrayBuffer(await buildZip(dummyPackageFiles("dummy.fhir.package-1.2.3/package")))
    );
    expectDummyPackage(parsed);
  });

  it("handles long paths via the USTAR prefix field", async () => {
    const deepPath = `package/${"very-long-directory-name/".repeat(5)}StructureDefinition-Deep.json`;
    expect(deepPath.length).toBeGreaterThan(100);
    const files = [
      ...dummyPackageFiles(),
      {
        path: deepPath,
        content: JSON.stringify({ resourceType: "StructureDefinition", id: "Deep" }),
      },
    ];

    const parsed = await parsePackage(toArrayBuffer(buildTgz(files)));
    expect(parsed.resources.some((resource) => resource.sourcePath === deepPath)).toBe(true);
  });

  it("handles long paths via GNU longname entries", async () => {
    const deepPath = `package/${"very-long-directory-name/".repeat(5)}StructureDefinition-Deep.json`;
    const files = [
      ...dummyPackageFiles(),
      {
        path: deepPath,
        content: JSON.stringify({ resourceType: "StructureDefinition", id: "Deep" }),
      },
    ];

    const parsed = await parsePackage(
      toArrayBuffer(buildTgz(files, { useGnuLongnames: true }))
    );
    expect(parsed.resources.some((resource) => resource.sourcePath === deepPath)).toBe(true);
  });

  it("collects warnings for broken resource files instead of failing", async () => {
    const files = [
      ...dummyPackageFiles(),
      { path: "package/Broken-resource.json", content: "{ not json" },
    ];
    const parsed = await parsePackage(toArrayBuffer(buildTgz(files)));
    expect(parsed.warnings.length).toBe(1);
    expect(parsed.warnings[0]).toContain("Broken-resource.json");
    expectDummyPackage({ ...parsed, warnings: [] });
  });

  it("rejects archives without a valid package.json", async () => {
    const files = [
      { path: "package/README.md", content: "hello" },
      // package.json without name/version does not count as a manifest.
      { path: "package/package.json", content: JSON.stringify({ description: "x" }) },
    ];
    await expect(parsePackage(toArrayBuffer(buildTgz(files)))).rejects.toThrow(
      /No package\.json with name and version/
    );
  });

  it("rejects unknown file formats with an actionable message", async () => {
    const bytes = new TextEncoder().encode("this is definitely not an archive");
    await expect(parsePackage(toArrayBuffer(bytes))).rejects.toThrow(
      /Unsupported file format.*\.tgz.*\.tar.*\.zip/
    );
  });

  it("rejects truncated gzip data with a decompression error", async () => {
    const truncated = buildTgz(dummyPackageFiles()).slice(0, 20);
    await expect(parsePackage(toArrayBuffer(truncated))).rejects.toThrow(
      /could not be decompressed/
    );
  });

  it("strips devDependencies from the manifest by default", async () => {
    const files = dummyPackageFiles().map((file) =>
      file.path === "package/package.json"
        ? {
            path: file.path,
            content: JSON.stringify({
              ...JSON.parse(file.content),
              devDependencies: { "some.dev.package": "1.0.0" },
            }),
          }
        : file
    );
    const parsed = await parsePackage(toArrayBuffer(buildTgz(files)));
    expect(parsed.manifest.devDependencies).toBeUndefined();
  });
});
