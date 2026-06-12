import type { ParsedPackage, ParsedResource, PackageManifest } from "./types";
import { buildPackageKey } from "./utils";
import { gunzip, parseTar } from "./tar";

type ParseOptions = {
  includeDevDependencies?: boolean;
  onProgress?: (progress: number) => void;
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

const isGzipArchive = (buffer: ArrayBuffer) => {
  if (buffer.byteLength < 2) return false;
  const bytes = new Uint8Array(buffer, 0, 2);
  return bytes[0] === 0x1f && bytes[1] === 0x8b;
};

const readTarData = async (buffer: ArrayBuffer) => {
  if (!isGzipArchive(buffer)) {
    return new Uint8Array(buffer);
  }

  try {
    return await gunzip(buffer);
  } catch (error) {
    const message = error instanceof Error && error.message ? error.message : "Unknown gzip error";
    throw new Error(`Failed to decompress gzip FHIR package archive: ${message}`);
  }
};

export const parseTgzPackage = async (
  buffer: ArrayBuffer,
  options: ParseOptions = {}
): Promise<ParsedPackage> => {
  const includeDevDependencies = options.includeDevDependencies ?? false;
  const warnings: string[] = [];
  let manifest: PackageManifest | undefined;
  const resources: ParsedResource[] = [];

  const tarData = await readTarData(buffer);

  parseTar(tarData, {
    onEntry: (entry) => {
      if (entry.typeflag && entry.typeflag !== "0") return;

      if (entry.name === "package/package.json") {
        manifest = decodeJson<PackageManifest>(entry.data, entry.name);
        return;
      }

      if (!entry.name.startsWith("package/") || !entry.name.endsWith(".json")) {
        return;
      }

      if (entry.name === "package/package.json") return;

      try {
        const resource = decodeJson<Record<string, unknown>>(entry.data, entry.name);
        const resourceType = resource.resourceType as string | undefined;

        if (!resourceType) return;

        resources.push({
          resourceType,
          id: typeof resource.id === "string" ? resource.id : undefined,
          url: typeof resource.url === "string" ? resource.url : undefined,
          name: typeof resource.name === "string" ? resource.name : undefined,
          title: typeof resource.title === "string" ? resource.title : undefined,
          content: resource,
          packageKey: "",
          sourcePath: entry.name,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown parse error";
        warnings.push(message);
      }
    },
    onProgress: options.onProgress,
  });

  if (!manifest) {
    throw new Error("package/package.json is missing in the archive.");
  }

  if (!manifest.name || !manifest.version) {
    throw new Error("package.json is missing name or version.");
  }

  if (!includeDevDependencies) {
    manifest = { ...manifest };
    delete manifest.devDependencies;
  }

  const packageKey = buildPackageKey(manifest.name, manifest.version);
  const resolvedResources = resources.map((resource) => ({
    ...resource,
    packageKey,
  }));

  return {
    id: manifest.name,
    version: manifest.version,
    packageKey,
    manifest,
    resources: resolvedResources,
    warnings,
  };
};
