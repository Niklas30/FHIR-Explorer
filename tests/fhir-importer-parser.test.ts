import { gzipSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { parseTgzPackage } from "@/lib/fhir-importer/parser";

const encoder = new TextEncoder();

const writeBytes = (target: Uint8Array, offset: number, value: string) => {
  target.set(encoder.encode(value), offset);
};

const writeOctal = (target: Uint8Array, offset: number, length: number, value: number) => {
  const octal = value.toString(8).padStart(length - 1, "0");
  writeBytes(target, offset, `${octal}\0`);
};

const createTarEntry = (name: string, content: string) => {
  const payload = encoder.encode(content);
  const header = new Uint8Array(512);
  writeBytes(header, 0, name);
  writeOctal(header, 100, 8, 0o644);
  writeOctal(header, 108, 8, 0);
  writeOctal(header, 116, 8, 0);
  writeOctal(header, 124, 12, payload.length);
  writeOctal(header, 136, 12, 0);
  header.fill(0x20, 148, 156);
  writeBytes(header, 156, "0");
  writeBytes(header, 257, "ustar\0");
  writeBytes(header, 263, "00");

  const checksum = header.reduce((sum, byte) => sum + byte, 0);
  writeBytes(header, 148, `${checksum.toString(8).padStart(6, "0")}\0 `);

  const paddedPayloadLength = Math.ceil(payload.length / 512) * 512;
  const entry = new Uint8Array(512 + paddedPayloadLength);
  entry.set(header, 0);
  entry.set(payload, 512);
  return entry;
};

const createTarArchive = (entries: Array<{ name: string; content: string }>) => {
  const entryBuffers = entries.map((entry) => createTarEntry(entry.name, entry.content));
  const totalLength = entryBuffers.reduce((sum, entry) => sum + entry.length, 1024);
  const archive = new Uint8Array(totalLength);
  let offset = 0;

  for (const entry of entryBuffers) {
    archive.set(entry, offset);
    offset += entry.length;
  }

  return archive.buffer;
};

describe("FHIR package parser", () => {
  const createDirectoryFixtureArchive = () =>
    createTarArchive([
      {
        name: "package/package.json",
        content: JSON.stringify({
          name: "de.gematik.fhir.directory",
          version: "1.0.0",
          dependencies: { "de.gematik.ti": "1.1.1" },
        }),
      },
      {
        name: "package/CodeSystem-test.json",
        content: JSON.stringify({
          resourceType: "CodeSystem",
          id: "test",
          url: "https://example.test/CodeSystem/test",
        }),
      },
    ]);

  it("imports plain tar archives", async () => {
    const archive = createDirectoryFixtureArchive();

    const parsed = await parseTgzPackage(archive);

    expect(parsed.packageKey).toBe("de.gematik.fhir.directory@1.0.0");
    expect(parsed.manifest.dependencies).toEqual({ "de.gematik.ti": "1.1.1" });
    expect(parsed.resources).toHaveLength(1);
    expect(parsed.resources[0]).toMatchObject({
      resourceType: "CodeSystem",
      id: "test",
      packageKey: "de.gematik.fhir.directory@1.0.0",
    });
  });

  it("imports gzipped tar archives", async () => {
    const archive = createDirectoryFixtureArchive();
    const compressed = gzipSync(new Uint8Array(archive));

    const parsed = await parseTgzPackage(
      compressed.buffer.slice(compressed.byteOffset, compressed.byteOffset + compressed.byteLength)
    );

    expect(parsed.packageKey).toBe("de.gematik.fhir.directory@1.0.0");
    expect(parsed.manifest.dependencies).toEqual({ "de.gematik.ti": "1.1.1" });
    expect(parsed.resources).toHaveLength(1);
  });
});
