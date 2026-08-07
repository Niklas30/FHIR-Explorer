import * as vscode from "vscode";
import type { ResourceStore } from "@fhir-explorer/core/ports";
import { extractAuthoredTitle } from "@fhir-explorer/core/projects/content";
import type { AuthoredResource } from "@fhir-explorer/core/projects/types";
import {
  RESOURCE_DIRECTORIES,
  directoryForKind,
  fileNameForResource,
  kindOfResource,
  serializeResource,
} from "@/workspace/layout";

/**
 * {@link ResourceStore} over the workspace file system.
 *
 * A collection key is the project root URI as a string; every resource is one
 * `.json` file below it. The files are the source of truth — this store owns
 * no cache and no index, so an edit made in the text editor, by the IG
 * Publisher or by a git checkout is picked up on the next read.
 */

const decoder = new TextDecoder();
const encoder = new TextEncoder();

/** Relative POSIX path from the project root, used as the resource id. */
const relativePath = (root: vscode.Uri, file: vscode.Uri): string =>
  file.path.slice(root.path.length).replace(/^\/+/, "");

const readJsonFile = async (
  uri: vscode.Uri
): Promise<Record<string, unknown> | undefined> => {
  try {
    const bytes = await vscode.workspace.fs.readFile(uri);
    const parsed = JSON.parse(decoder.decode(bytes));
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : undefined;
  } catch {
    // A malformed or unreadable file must not take the whole project down;
    // the diagnostics pass reports it to the user instead.
    return undefined;
  }
};

const listJsonFiles = async (directory: vscode.Uri): Promise<vscode.Uri[]> => {
  let entries: [string, vscode.FileType][];
  try {
    entries = await vscode.workspace.fs.readDirectory(directory);
  } catch {
    return []; // directory does not exist yet
  }
  return entries
    .filter(([name, type]) => type === vscode.FileType.File && name.endsWith(".json"))
    .map(([name]) => vscode.Uri.joinPath(directory, name));
};

const toAuthoredResource = async (
  root: vscode.Uri,
  file: vscode.Uri
): Promise<AuthoredResource | undefined> => {
  const content = await readJsonFile(file);
  if (!content) return undefined;

  const stat = await vscode.workspace.fs.stat(file);
  const resourceType =
    typeof content.resourceType === "string" ? content.resourceType : "Unknown";
  const meta = content.meta;
  const profile =
    meta && typeof meta === "object" && Array.isArray((meta as { profile?: unknown[] }).profile)
      ? (meta as { profile: unknown[] }).profile.find(
          (entry): entry is string => typeof entry === "string"
        )
      : undefined;

  return {
    id: relativePath(root, file),
    kind: kindOfResource(content),
    resourceType,
    profile,
    title: extractAuthoredTitle(content),
    content,
    // The file system already tracks these; keeping a second copy in a
    // sidecar file would only ever drift from it.
    createdAt: stat.ctime,
    updatedAt: stat.mtime,
  };
};

/** Target path for a resource: keep the existing file, otherwise derive one. */
const targetPathFor = (resource: AuthoredResource): string => {
  if (resource.id.endsWith(".json") && resource.id.includes("/")) return resource.id;
  const id = typeof resource.content.id === "string" ? resource.content.id : undefined;
  return `${directoryForKind(resource.kind)}/${fileNameForResource(
    resource.resourceType,
    id ?? resource.title
  )}`;
};

export const createFsResourceStore = (): ResourceStore<AuthoredResource> => ({
  load: async (collectionKey) => {
    const root = vscode.Uri.parse(collectionKey);
    const perDirectory = await Promise.all(
      RESOURCE_DIRECTORIES.map((directory) =>
        listJsonFiles(vscode.Uri.joinPath(root, ...directory.split("/")))
      )
    );
    const resources = await Promise.all(
      perDirectory.flat().map((file) => toAuthoredResource(root, file))
    );
    return resources
      .filter((entry): entry is AuthoredResource => entry !== undefined)
      .sort((a, b) => a.id.localeCompare(b.id));
  },

  save: async (collectionKey, entries) => {
    const root = vscode.Uri.parse(collectionKey);
    const existing = await Promise.all(
      RESOURCE_DIRECTORIES.map((directory) =>
        listJsonFiles(vscode.Uri.joinPath(root, ...directory.split("/")))
      )
    );
    const existingPaths = new Set(
      existing.flat().map((file) => relativePath(root, file))
    );

    const written = new Set<string>();
    for (const resource of entries) {
      const path = targetPathFor(resource);
      written.add(path);
      const uri = vscode.Uri.joinPath(root, ...path.split("/"));
      const next = serializeResource(resource.content);

      // Only touch files whose content actually changed, so saving a project
      // does not rewrite every file and flood the git diff.
      const current = await vscode.workspace.fs.readFile(uri).then(
        (bytes) => decoder.decode(bytes),
        () => undefined
      );
      if (current === next) continue;

      await vscode.workspace.fs.createDirectory(
        vscode.Uri.joinPath(root, ...path.split("/").slice(0, -1))
      );
      await vscode.workspace.fs.writeFile(uri, encoder.encode(next));
    }

    for (const path of existingPaths) {
      if (written.has(path)) continue;
      await vscode.workspace.fs.delete(vscode.Uri.joinPath(root, ...path.split("/")), {
        useTrash: true,
      });
    }
  },

  clear: async (collectionKey) => {
    const root = vscode.Uri.parse(collectionKey);
    const perDirectory = await Promise.all(
      RESOURCE_DIRECTORIES.map((directory) =>
        listJsonFiles(vscode.Uri.joinPath(root, ...directory.split("/")))
      )
    );
    // Delete the resource files, never the directories — they may hold other
    // IG inputs (ignoreWarnings.txt, images, pagecontent) we do not own.
    for (const file of perDirectory.flat()) {
      await vscode.workspace.fs.delete(file, { useTrash: true });
    }
  },
});
