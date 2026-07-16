import JSZip from "jszip";
import type { ParsedPackage, ParsedResource, PackageManifest } from "./types";
import { buildPackageKey } from "./utils";
import { detectArchiveFormat } from "./archive";
import { gunzip, parseTar } from "./tar";

type ParseOptions = {
  includeDevDependencies?: boolean;
  onProgress?: (progress: number) => void;
};

/** A file inside the archive, independent of the container format. */
type ArchiveEntry = {
  path: string;
  data: Uint8Array;
};

const decodeJson = <T,>(payload: Uint8Array, path: string): T => {
  const text = new TextDecoder().decode(payload);
  try {
    return JSON.parse(text) as T;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown JSON error";
    throw new Error(`Failed to parse ${path}: ${message}`);
  }
};

const normalizePath = (path: string) => path.replace(/\\/g, "/").replace(/^\.\//, "").replace(/^\/+/, "");

const basenameOf = (path: string) => path.slice(path.lastIndexOf("/") + 1);

const dirnameOf = (path: string) => {
  const index = path.lastIndexOf("/");
  return index === -1 ? "" : path.slice(0, index);
};

const isManifestLike = (value: unknown): value is PackageManifest => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  return typeof record.name === "string" && typeof record.version === "string";
};

const collectTarEntries = (tarBytes: Uint8Array, onProgress?: (progress: number) => void) => {
  const entries: ArchiveEntry[] = [];
  parseTar(tarBytes, {
    onEntry: (entry) => {
      // "0" and the legacy empty typeflag denote regular files.
      if (entry.typeflag && entry.typeflag !== "0") return;
      entries.push({ path: normalizePath(entry.name), data: entry.data });
    },
    onProgress,
  });
  return entries;
};

const collectZipEntries = async (
  bytes: Uint8Array,
  onProgress?: (progress: number) => void
): Promise<ArchiveEntry[]> => {
  const zip = await JSZip.loadAsync(bytes);
  const files = Object.values(zip.files).filter((file) => !file.dir);
  const entries: ArchiveEntry[] = [];
  for (const [index, file] of files.entries()) {
    const data = await file.async("uint8array");
    entries.push({ path: normalizePath(file.name), data });
    onProgress?.((index + 1) / files.length);
  }
  return entries;
};

/**
 * Locates the package manifest. npm-style archives use
 * "package/package.json", but zips exported from other tools may carry the
 * manifest at the root or under a wrapper directory — the shallowest valid
 * package.json wins.
 */
const findManifest = (entries: ArchiveEntry[]) => {
  const candidates = entries
    .filter((entry) => basenameOf(entry.path) === "package.json")
    .sort((a, b) => a.path.split("/").length - b.path.split("/").length);

  for (const candidate of candidates) {
    const parsed = decodeJson<unknown>(candidate.data, candidate.path);
    if (isManifestLike(parsed)) {
      return { manifest: parsed, root: dirnameOf(candidate.path) };
    }
  }
  return null;
};

const buildPackageFromEntries = (
  entries: ArchiveEntry[],
  options: ParseOptions
): ParsedPackage => {
  const located = findManifest(entries);
  if (!located) {
    throw new Error(
      "No package.json with name and version found in the archive. " +
        "Expected an npm-style FHIR package (package/package.json)."
    );
  }

  let manifest = located.manifest;
  const rootPrefix = located.root ? `${located.root}/` : "";
  const warnings: string[] = [];
  const resources: ParsedResource[] = [];

  for (const entry of entries) {
    if (!entry.path.startsWith(rootPrefix)) continue;
    if (!entry.path.endsWith(".json")) continue;
    const basename = basenameOf(entry.path);
    // Skip the manifest itself and index/metadata files (.index.json, …).
    if (basename === "package.json" || basename.startsWith(".")) continue;

    try {
      const resource = decodeJson<Record<string, unknown>>(entry.data, entry.path);
      const resourceType = resource.resourceType;
      if (typeof resourceType !== "string") continue;

      resources.push({
        resourceType,
        id: typeof resource.id === "string" ? resource.id : undefined,
        url: typeof resource.url === "string" ? resource.url : undefined,
        name: typeof resource.name === "string" ? resource.name : undefined,
        title: typeof resource.title === "string" ? resource.title : undefined,
        content: resource,
        packageKey: "",
        sourcePath: entry.path,
      });
    } catch (error) {
      warnings.push(error instanceof Error ? error.message : "Unknown parse error");
    }
  }

  if (!(options.includeDevDependencies ?? false)) {
    manifest = { ...manifest };
    delete manifest.devDependencies;
  }

  const packageKey = buildPackageKey(manifest.name, manifest.version);
  return {
    id: manifest.name,
    version: manifest.version,
    packageKey,
    manifest,
    resources: resources.map((resource) => ({ ...resource, packageKey })),
    warnings,
  };
};

/**
 * Parses a FHIR package archive in any of the common containers:
 * gzipped tar (.tgz/.tar.gz), plain tar (browsers transparently decompress
 * gzip downloads and keep the .tgz name) and zip. The container is detected
 * from magic bytes, never from the file name.
 */
export const parsePackage = async (
  buffer: ArrayBuffer,
  options: ParseOptions = {}
): Promise<ParsedPackage> => {
  const bytes = new Uint8Array(buffer);
  const format = detectArchiveFormat(bytes);

  switch (format) {
    case "gzip": {
      let tarBytes: Uint8Array;
      try {
        tarBytes = await gunzip(bytes);
      } catch (error) {
        const message = error instanceof Error ? error.message : "unknown error";
        throw new Error(`The gzip archive could not be decompressed (${message}).`);
      }
      return buildPackageFromEntries(collectTarEntries(tarBytes, options.onProgress), options);
    }
    case "tar":
      return buildPackageFromEntries(collectTarEntries(bytes, options.onProgress), options);
    case "zip":
      return buildPackageFromEntries(
        await collectZipEntries(bytes, options.onProgress),
        options
      );
    default:
      throw new Error(
        "Unsupported file format: expected a FHIR package as .tgz/.tar.gz, .tar or .zip archive."
      );
  }
};
