import * as os from "node:os";
import * as vscode from "vscode";
import { buildPackageKey } from "@fhir-explorer/core/fhir-importer/utils";
import type {
  PackageManifest,
  ParsedPackage,
  ParsedResource,
} from "@fhir-explorer/core/fhir-importer/types";

/**
 * The shared `~/.fhir/packages` cache.
 *
 * The IG Publisher, Sushi and the Firely tooling all populate it, so on a real
 * FHIR workstation the packages a user needs are usually already on disk. The
 * web app cannot see any of this — reading it is one of the concrete reasons
 * the extension is worth having.
 *
 * Entries are extracted folders named `<id>#<version>` holding a `package/`
 * directory, not archives, so they are read directly rather than through the
 * archive parser.
 */

export type CachedPackage = {
  id: string;
  version: string;
  key: string;
  folder: vscode.Uri;
};

const decoder = new TextDecoder();

export const fhirHomePackagesUri = (): vscode.Uri =>
  vscode.Uri.file(`${os.homedir()}/.fhir/packages`);

const readJson = async (uri: vscode.Uri): Promise<unknown> => {
  const bytes = await vscode.workspace.fs.readFile(uri);
  return JSON.parse(decoder.decode(bytes));
};

/** Every package in the local cache, newest name order, ignoring junk folders. */
export const listCachedPackages = async (): Promise<CachedPackage[]> => {
  let entries: [string, vscode.FileType][];
  try {
    entries = await vscode.workspace.fs.readDirectory(fhirHomePackagesUri());
  } catch {
    return []; // no cache on this machine
  }

  const packages: CachedPackage[] = [];
  for (const [name, type] of entries) {
    if (type !== vscode.FileType.Directory) continue;
    const separator = name.lastIndexOf("#");
    if (separator <= 0) continue;
    const id = name.slice(0, separator);
    const version = name.slice(separator + 1);
    packages.push({
      id,
      version,
      key: buildPackageKey(id, version),
      folder: vscode.Uri.joinPath(fhirHomePackagesUri(), name),
    });
  }

  return packages.sort(
    (a, b) => a.id.localeCompare(b.id) || a.version.localeCompare(b.version)
  );
};

const isManifest = (value: unknown): value is PackageManifest =>
  Boolean(
    value &&
      typeof value === "object" &&
      typeof (value as PackageManifest).name === "string" &&
      typeof (value as PackageManifest).version === "string"
  );

/**
 * Read an extracted cache entry into the same {@link ParsedPackage} the
 * archive parser produces, so the importer cannot tell the two apart.
 */
export const readCachedPackage = async (
  cached: CachedPackage,
  onProgress?: (progress: number) => void
): Promise<ParsedPackage> => {
  const packageDir = vscode.Uri.joinPath(cached.folder, "package");
  const manifestUri = vscode.Uri.joinPath(packageDir, "package.json");

  const rawManifest = await readJson(manifestUri);
  if (!isManifest(rawManifest)) {
    throw new Error(`${cached.key}: package/package.json is not a FHIR manifest`);
  }
  const manifest = rawManifest;
  const packageKey = buildPackageKey(manifest.name, manifest.version);

  const entries = await vscode.workspace.fs.readDirectory(packageDir);
  const files = entries
    .filter(
      ([name, type]) =>
        type === vscode.FileType.File &&
        name.endsWith(".json") &&
        // Index and manifest files are metadata, not FHIR resources.
        !["package.json", ".index.json", ".index.db"].includes(name)
    )
    .map(([name]) => name);

  const resources: ParsedResource[] = [];
  const warnings: string[] = [];

  for (const [position, name] of files.entries()) {
    const uri = vscode.Uri.joinPath(packageDir, name);
    try {
      const content = await readJson(uri);
      if (!content || typeof content !== "object" || Array.isArray(content)) continue;
      const record = content as Record<string, unknown>;
      if (typeof record.resourceType !== "string") continue;

      resources.push({
        resourceType: record.resourceType,
        id: typeof record.id === "string" ? record.id : undefined,
        url: typeof record.url === "string" ? record.url : undefined,
        name: typeof record.name === "string" ? record.name : undefined,
        title: typeof record.title === "string" ? record.title : undefined,
        content: record,
        packageKey,
        sourcePath: `package/${name}`,
      });
    } catch (error) {
      warnings.push(
        `package/${name}: ${error instanceof Error ? error.message : "unreadable"}`
      );
    }

    if (files.length > 0) onProgress?.((position + 1) / files.length);
  }

  return {
    id: manifest.name,
    version: manifest.version,
    packageKey,
    manifest,
    resources,
    warnings,
  };
};
