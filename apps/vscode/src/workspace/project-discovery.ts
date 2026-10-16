import * as vscode from "vscode";
import { buildProjectKey } from "@fhir-explorer/core/projects/storage";
import type { PackageManifest } from "@fhir-explorer/core/fhir-importer/types";
import {
  GENERATED_DIRECTORIES,
  IG_RESOURCE_DIRECTORIES,
  parseFhirPackageJson,
  parseIgIni,
  parseImplementationGuide,
  parseSushiConfig,
  type ProjectKind,
} from "@/workspace/manifests";

/**
 * Finding the FHIR projects in the open workspace.
 *
 * The workspace is the registry — there is no separate project list — so this
 * has to recognise the projects people actually have, not only the ones the
 * extension created. A Sushi repo is marked by `sushi-config.yaml`, a classic
 * IG Publisher repo by `ig.ini`, and a package-style project by a
 * `package.json` carrying FHIR fields.
 */

export type WorkspaceProject = {
  /** Project root, also the collection key of the resource store. */
  root: vscode.Uri;
  kind: ProjectKind;
  manifest: PackageManifest;
  /** `id@version`, the same key space the importer uses. */
  key: string;
  /** File a new dependency is recorded in. */
  manifestFile: vscode.Uri;
  /** Relative directories holding resources that may be edited. */
  resourceDirectories: readonly string[];
  /** Relative directories holding build output: validated, never edited. */
  generatedDirectories: readonly string[];
};

const decoder = new TextDecoder();

/** Output and vendor trees that must never be mistaken for a project. */
const MARKER_EXCLUDE =
  "**/{node_modules,.git,out,dist,.next,temp,template,output,fsh-generated}/**";

const readText = async (uri: vscode.Uri): Promise<string | undefined> => {
  try {
    return decoder.decode(await vscode.workspace.fs.readFile(uri));
  } catch {
    return undefined;
  }
};

const exists = async (uri: vscode.Uri): Promise<boolean> =>
  await vscode.workspace.fs.stat(uri).then(
    () => true,
    () => false
  );

/**
 * An extracted published package looks exactly like a project — a
 * `package.json` with FHIR fields — but it is a dependency someone unpacked,
 * not something to author. The `.index.json` the registry ships alongside is
 * the reliable tell.
 */
const isExtractedPackage = async (directory: vscode.Uri): Promise<boolean> =>
  await exists(vscode.Uri.joinPath(directory, ".index.json"));

const fromSushi = async (
  directory: vscode.Uri,
  file: vscode.Uri
): Promise<WorkspaceProject | undefined> => {
  const text = await readText(file);
  const manifest = text ? parseSushiConfig(text) : undefined;
  if (!manifest) return undefined;
  return project(directory, "sushi", manifest, file);
};

const fromIgIni = async (
  directory: vscode.Uri,
  file: vscode.Uri
): Promise<WorkspaceProject | undefined> => {
  const text = await readText(file);
  if (!text) return undefined;
  const { igPath } = parseIgIni(text);
  if (!igPath) return undefined;

  const igUri = vscode.Uri.joinPath(directory, ...igPath.split(/[\\/]/));
  // Only a JSON ImplementationGuide can be read here; an XML one would need a
  // parser we do not ship. The project is still recognised, just without the
  // metadata that resource would have carried.
  const manifest = igPath.endsWith(".json")
    ? parseImplementationGuide((await readText(igUri)) ?? "")
    : undefined;

  return project(
    directory,
    "ig-publisher",
    manifest ?? {
      name: directory.path.split("/").pop() ?? "implementation-guide",
      version: "0.0.0",
    },
    igPath.endsWith(".json") ? igUri : file
  );
};

const fromPackageJson = async (
  directory: vscode.Uri,
  file: vscode.Uri
): Promise<WorkspaceProject | undefined> => {
  if (await isExtractedPackage(directory)) return undefined;
  const text = await readText(file);
  const manifest = text ? parseFhirPackageJson(text) : undefined;
  if (!manifest) return undefined;
  return project(directory, "fhir-package", manifest, file);
};

const project = (
  root: vscode.Uri,
  kind: ProjectKind,
  manifest: PackageManifest,
  manifestFile: vscode.Uri
): WorkspaceProject => ({
  root,
  kind,
  manifest,
  key: buildProjectKey(manifest.name, manifest.version),
  manifestFile,
  resourceDirectories: IG_RESOURCE_DIRECTORIES,
  generatedDirectories: GENERATED_DIRECTORIES[kind],
});

/**
 * Every FHIR project across all workspace folders.
 *
 * A directory carrying several markers is one project, not three: Sushi wins
 * because it is the source of truth in a repo that has it, then `ig.ini`, then
 * `package.json`.
 */
export const discoverProjects = async (): Promise<WorkspaceProject[]> => {
  const markers = await vscode.workspace.findFiles(
    "**/{package.json,sushi-config.yaml,sushi-config.yml,ig.ini}",
    MARKER_EXCLUDE
  );

  const byDirectory = new Map<string, vscode.Uri[]>();
  for (const marker of markers) {
    const directory = marker.path.slice(0, marker.path.lastIndexOf("/"));
    byDirectory.set(directory, [...(byDirectory.get(directory) ?? []), marker]);
  }

  const projects: WorkspaceProject[] = [];
  for (const files of byDirectory.values()) {
    const directory = vscode.Uri.joinPath(files[0], "..");
    const named = (name: string) => files.find((file) => file.path.endsWith(`/${name}`));

    const sushi = named("sushi-config.yaml") ?? named("sushi-config.yml");
    const found =
      (sushi ? await fromSushi(directory, sushi) : undefined) ??
      (named("ig.ini") ? await fromIgIni(directory, named("ig.ini")!) : undefined) ??
      (named("package.json")
        ? await fromPackageJson(directory, named("package.json")!)
        : undefined);

    if (found) projects.push(found);
  }

  return projects.sort((a, b) => a.manifest.name.localeCompare(b.manifest.name));
};

/** The project a file belongs to, or undefined when it sits outside one. */
export const projectForUri = (
  projects: WorkspaceProject[],
  uri: vscode.Uri
): WorkspaceProject | undefined =>
  projects
    .filter((entry) => uri.path.startsWith(`${entry.root.path}/`))
    // Nested projects: the closest root wins.
    .sort((a, b) => b.root.path.length - a.root.path.length)[0];

/** Path of `uri` relative to the project root, or undefined when outside. */
export const relativeToProject = (
  project: WorkspaceProject,
  uri: vscode.Uri
): string | undefined =>
  uri.path.startsWith(`${project.root.path}/`)
    ? uri.path.slice(project.root.path.length + 1)
    : undefined;

/** Whether a file is build output, which may be validated but not edited. */
export const isGeneratedResource = (
  project: WorkspaceProject,
  uri: vscode.Uri
): boolean => {
  const relative = relativeToProject(project, uri);
  if (!relative) return false;
  return project.generatedDirectories.some((directory) =>
    relative.startsWith(`${directory}/`)
  );
};

/** Whether a file is somewhere the project keeps FHIR resources. */
export const isProjectResource = (
  project: WorkspaceProject,
  uri: vscode.Uri
): boolean => {
  const relative = relativeToProject(project, uri);
  if (!relative) return false;
  return [...project.resourceDirectories, ...project.generatedDirectories].some(
    (directory) => relative.startsWith(`${directory}/`)
  );
};
