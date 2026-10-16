import { gzipSync } from "node:zlib";
import JSZip from "jszip";

/**
 * Builders for dummy FHIR package archives used by importer tests. The tar
 * builder writes USTAR headers by hand so tests can exercise long-path
 * (prefix field) and GNU longname variants deterministically.
 */

export type ArchiveFile = {
  path: string;
  content: string;
};

const encoder = new TextEncoder();

const writeString = (block: Uint8Array, offset: number, value: string) => {
  const bytes = encoder.encode(value);
  block.set(bytes.subarray(0, Math.min(bytes.length, block.length - offset)), offset);
};

const writeOctal = (block: Uint8Array, offset: number, length: number, value: number) => {
  const text = value.toString(8).padStart(length - 1, "0");
  writeString(block, offset, `${text}\0`);
};

const finalizeChecksum = (block: Uint8Array) => {
  // Checksum is computed with the checksum field itself filled with spaces.
  block.fill(0x20, 148, 156);
  let sum = 0;
  for (const byte of block) sum += byte;
  const text = sum.toString(8).padStart(6, "0");
  writeString(block, 148, `${text}\0 `);
};

const buildHeader = (name: string, size: number, typeflag: string, prefix = "") => {
  const block = new Uint8Array(512);
  writeString(block, 0, name);
  writeOctal(block, 100, 8, 0o644); // mode
  writeOctal(block, 108, 8, 0); // uid
  writeOctal(block, 116, 8, 0); // gid
  writeOctal(block, 124, 12, size);
  writeOctal(block, 136, 12, 0); // mtime
  writeString(block, 156, typeflag);
  writeString(block, 257, "ustar\0");
  writeString(block, 263, "00");
  if (prefix) writeString(block, 345, prefix);
  finalizeChecksum(block);
  return block;
};

const padTo512 = (data: Uint8Array) => {
  const paddedLength = Math.ceil(data.length / 512) * 512;
  const padded = new Uint8Array(paddedLength);
  padded.set(data);
  return padded;
};

type TarBuildOptions = {
  /** Encode long paths via GNU "L" entries instead of the USTAR prefix. */
  useGnuLongnames?: boolean;
};

export const buildTar = (files: ArchiveFile[], options: TarBuildOptions = {}): Uint8Array => {
  const blocks: Uint8Array[] = [];

  for (const file of files) {
    const data = encoder.encode(file.content);

    if (file.path.length > 100) {
      if (options.useGnuLongnames) {
        const nameBytes = encoder.encode(`${file.path}\0`);
        blocks.push(buildHeader("././@LongLink", nameBytes.length, "L"));
        blocks.push(padTo512(nameBytes));
        blocks.push(buildHeader(file.path.slice(0, 100), data.length, "0"));
      } else {
        // USTAR: split into prefix + name at a slash boundary.
        const splitIndex = file.path.lastIndexOf("/", file.path.length - 101 + 155);
        const prefix = file.path.slice(0, splitIndex);
        const name = file.path.slice(splitIndex + 1);
        blocks.push(buildHeader(name, data.length, "0", prefix));
      }
    } else {
      blocks.push(buildHeader(file.path, data.length, "0"));
    }
    blocks.push(padTo512(data));
  }

  // Two terminating zero blocks.
  blocks.push(new Uint8Array(1024));

  const total = blocks.reduce((sum, block) => sum + block.length, 0);
  const tar = new Uint8Array(total);
  let offset = 0;
  for (const block of blocks) {
    tar.set(block, offset);
    offset += block.length;
  }
  return tar;
};

export const buildTgz = (files: ArchiveFile[], options: TarBuildOptions = {}): Uint8Array =>
  new Uint8Array(gzipSync(buildTar(files, options)));

export const buildZip = async (files: ArchiveFile[]): Promise<Uint8Array> => {
  const zip = new JSZip();
  for (const file of files) {
    zip.file(file.path, file.content);
  }
  return zip.generateAsync({ type: "uint8array" });
};

export const toArrayBuffer = (bytes: Uint8Array): ArrayBuffer => {
  const buffer = new ArrayBuffer(bytes.length);
  new Uint8Array(buffer).set(bytes);
  return buffer;
};

/** Minimal but realistic dummy FHIR package content. */
export const dummyPackageFiles = (root = "package"): ArchiveFile[] => {
  const prefix = root ? `${root}/` : "";
  return [
    {
      path: `${prefix}package.json`,
      content: JSON.stringify({
        name: "dummy.fhir.package",
        version: "1.2.3",
        fhirVersions: ["4.0.1"],
        dependencies: { "hl7.fhir.r4.core": "4.0.1" },
      }),
    },
    {
      path: `${prefix}StructureDefinition-DummyPatient.json`,
      content: JSON.stringify({
        resourceType: "StructureDefinition",
        id: "DummyPatient",
        url: "https://example.org/fhir/StructureDefinition/DummyPatient",
        name: "DummyPatient",
        kind: "resource",
        type: "Patient",
      }),
    },
    {
      path: `${prefix}ValueSet-dummy.json`,
      content: JSON.stringify({
        resourceType: "ValueSet",
        id: "dummy",
        url: "https://example.org/fhir/ValueSet/dummy",
      }),
    },
    {
      path: `${prefix}examples/Patient-example.json`,
      content: JSON.stringify({ resourceType: "Patient", id: "example" }),
    },
    // Metadata files that must not surface as resources.
    { path: `${prefix}.index.json`, content: JSON.stringify({ files: [] }) },
    { path: `${prefix}other.txt`, content: "not json" },
  ];
};
