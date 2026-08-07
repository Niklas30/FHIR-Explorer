import * as vscode from "vscode";
import { modify } from "jsonc-parser";

/**
 * Records a dependency in the project's `package.json`.
 *
 * Only direct dependencies are written — transitive ones are the registry's
 * business, not the manifest's. That is the same contract npm has, and it is
 * what makes "Install Dependencies" reproducible on a fresh checkout.
 */

const decoder = new TextDecoder();
const encoder = new TextEncoder();

export const addDependencyToManifest = async (
  manifestUri: vscode.Uri,
  id: string,
  version: string
): Promise<void> => {
  const bytes = await vscode.workspace.fs.readFile(manifestUri);
  const text = decoder.decode(bytes);

  // Edited through jsonc rather than parse-and-restringify, so the user's
  // formatting, key order and any comments survive.
  const edits = modify(text, ["dependencies", id], version, {
    formattingOptions: { tabSize: 2, insertSpaces: true, eol: "\n" },
  });

  let next = text;
  for (const edit of edits) {
    next =
      next.slice(0, edit.offset) + edit.content + next.slice(edit.offset + edit.length);
  }

  if (next === text) return;
  await vscode.workspace.fs.writeFile(manifestUri, encoder.encode(next));
};
