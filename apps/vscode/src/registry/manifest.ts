import * as vscode from "vscode";
import { modify } from "jsonc-parser";
import { parseDocument } from "yaml";
import type { WorkspaceProject } from "@/workspace/project-discovery";

/**
 * Records a dependency in the project's own manifest.
 *
 * Which file that is depends on the project: `package.json` for a package-style
 * project, `sushi-config.yaml` for a Sushi repo, the `dependsOn` list of the
 * ImplementationGuide for a classic IG. Writing to the wrong one would leave a
 * dependency the project's real toolchain never sees.
 *
 * Only direct dependencies are written — transitive ones are the registry's
 * business. That is the same contract npm has, and it is what makes "Install
 * Dependencies" reproducible on a fresh checkout.
 */

const decoder = new TextDecoder();
const encoder = new TextEncoder();

export class ManifestNotWritable extends Error {}

const readText = async (uri: vscode.Uri): Promise<string> =>
  decoder.decode(await vscode.workspace.fs.readFile(uri));

const write = async (uri: vscode.Uri, text: string): Promise<void> => {
  await vscode.workspace.fs.writeFile(uri, encoder.encode(text));
};

/** Apply jsonc edits, which are offsets into the original text. */
const applyEdits = (
  text: string,
  edits: { offset: number; length: number; content: string }[]
): string => {
  let next = text;
  for (const edit of edits) {
    next =
      next.slice(0, edit.offset) + edit.content + next.slice(edit.offset + edit.length);
  }
  return next;
};

const addToPackageJson = async (
  uri: vscode.Uri,
  id: string,
  version: string
): Promise<void> => {
  const text = await readText(uri);
  // Edited through jsonc rather than parse-and-restringify, so the user's
  // formatting, key order and any comments survive.
  const next = applyEdits(
    text,
    modify(text, ["dependencies", id], version, {
      formattingOptions: { tabSize: 2, insertSpaces: true, eol: "\n" },
    })
  );
  if (next !== text) await write(uri, next);
};

const addToSushiConfig = async (
  uri: vscode.Uri,
  id: string,
  version: string
): Promise<void> => {
  const text = await readText(uri);
  // The document API keeps comments and layout; sushi-config files are
  // hand-maintained and usually well commented.
  const document = parseDocument(text);
  document.setIn(["dependencies", id], version);
  const next = document.toString();
  if (next !== text) await write(uri, next);
};

const addToImplementationGuide = async (
  uri: vscode.Uri,
  id: string,
  version: string
): Promise<void> => {
  const text = await readText(uri);
  const parsed: unknown = JSON.parse(text);
  const dependsOn = Array.isArray((parsed as { dependsOn?: unknown[] }).dependsOn)
    ? ((parsed as { dependsOn: Record<string, unknown>[] }).dependsOn ?? [])
    : [];

  const existing = dependsOn.findIndex((entry) => entry?.packageId === id);
  const path = existing >= 0 ? ["dependsOn", existing] : ["dependsOn", dependsOn.length];

  const next = applyEdits(
    text,
    modify(
      text,
      path,
      { packageId: id, version },
      { formattingOptions: { tabSize: 2, insertSpaces: true, eol: "\n" }, isArrayInsertion: existing < 0 }
    )
  );
  if (next !== text) await write(uri, next);
};

export const addDependencyToManifest = async (
  project: WorkspaceProject,
  id: string,
  version: string
): Promise<void> => {
  const file = project.manifestFile;

  if (file.path.endsWith("sushi-config.yaml") || file.path.endsWith("sushi-config.yml")) {
    return await addToSushiConfig(file, id, version);
  }
  if (file.path.endsWith("/package.json")) {
    return await addToPackageJson(file, id, version);
  }
  if (file.path.endsWith(".json")) {
    return await addToImplementationGuide(file, id, version);
  }

  // An ig.ini pointing at an XML ImplementationGuide. The package is installed
  // either way; we just cannot record it without an XML writer.
  throw new ManifestNotWritable(
    `Cannot record the dependency in ${file.path.split("/").pop()} — add it to the ImplementationGuide by hand.`
  );
};
