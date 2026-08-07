import * as vscode from "vscode";
import { buildProjectKey } from "@fhir-explorer/core/projects/storage";
import type { PackageManifest } from "@fhir-explorer/core/fhir-importer/types";

/**
 * A FHIR project in the open workspace: a folder whose `package.json` is a
 * FHIR package manifest.
 *
 * There is no separate project registry in the extension — the workspace is
 * the registry. That is what keeps git, the file explorer and external FHIR
 * tooling in sync with the editor for free.
 */
export type WorkspaceProject = {
  /** Project root, also the collection key of the resource store. */
  root: vscode.Uri;
  manifest: PackageManifest;
  /** `id@version`, the same key space the importer uses. */
  key: string;
};

const decoder = new TextDecoder();

/**
 * Tell a FHIR package manifest from an ordinary npm one. A FHIR manifest
 * always carries at least one of these; requiring one of them keeps every
 * `node_modules`-adjacent package.json out of the tree.
 */
const isFhirManifest = (value: Record<string, unknown>): value is PackageManifest => {
  if (typeof value.name !== "string" || typeof value.version !== "string") return false;
  if (Array.isArray(value.fhirVersions)) return true;
  if (typeof value.canonical === "string") return true;
  return typeof value.type === "string" && value.type.startsWith("fhir");
};

const readManifest = async (
  manifestUri: vscode.Uri
): Promise<PackageManifest | undefined> => {
  try {
    const bytes = await vscode.workspace.fs.readFile(manifestUri);
    const parsed: unknown = JSON.parse(decoder.decode(bytes));
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return undefined;
    const record = parsed as Record<string, unknown>;
    return isFhirManifest(record) ? record : undefined;
  } catch {
    return undefined;
  }
};

/** Every FHIR project across all workspace folders, sorted by name. */
export const discoverProjects = async (): Promise<WorkspaceProject[]> => {
  const manifests = await vscode.workspace.findFiles(
    "**/package.json",
    "**/{node_modules,.git,out,dist,.next}/**"
  );

  const projects: WorkspaceProject[] = [];
  for (const manifestUri of manifests) {
    const manifest = await readManifest(manifestUri);
    if (!manifest) continue;
    projects.push({
      root: vscode.Uri.joinPath(manifestUri, ".."),
      manifest,
      key: buildProjectKey(manifest.name, manifest.version),
    });
  }

  return projects.sort((a, b) => a.manifest.name.localeCompare(b.manifest.name));
};

/** The project a file belongs to, or undefined when it sits outside one. */
export const projectForUri = (
  projects: WorkspaceProject[],
  uri: vscode.Uri
): WorkspaceProject | undefined =>
  projects
    .filter((project) => uri.path.startsWith(`${project.root.path}/`))
    // Nested projects: the closest root wins.
    .sort((a, b) => b.root.path.length - a.root.path.length)[0];
