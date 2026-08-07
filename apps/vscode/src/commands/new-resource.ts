import * as vscode from "vscode";
import { buildConformanceSkeleton } from "@fhir-explorer/core/projects/content";
import type { AuthoredResourceKind } from "@fhir-explorer/core/projects/types";
import type { WorkspaceProject } from "@/workspace/project-discovery";
import {
  directoryForKind,
  fileNameForResource,
  serializeResource,
} from "@/workspace/layout";

const encoder = new TextEncoder();

const KIND_LABELS: Record<AuthoredResourceKind, string> = {
  profile: "Profile",
  extension: "Extension",
  valueset: "ValueSet",
  codesystem: "CodeSystem",
  example: "Example instance",
};

const NAME = /^[A-Za-z][A-Za-z0-9-]*$/;

// `kind` is taken by QuickPickItem itself, hence the longer field name.
type KindPick = vscode.QuickPickItem & { resourceKind: AuthoredResourceKind };

const pickKind = async (): Promise<AuthoredResourceKind | undefined> => {
  const items: KindPick[] = (Object.keys(KIND_LABELS) as AuthoredResourceKind[]).map(
    (resourceKind) => ({ label: KIND_LABELS[resourceKind], resourceKind })
  );
  const picked = await vscode.window.showQuickPick(items, {
    title: "New FHIR Resource",
    placeHolder: "What do you want to create?",
  });
  return picked?.resourceKind;
};

/**
 * Create a resource by writing one file.
 *
 * Deliberately not a load-modify-save over the whole collection: touching only
 * the new file keeps the git diff to a single addition and leaves every other
 * file byte-identical.
 */
export const newResourceCommand = async (
  project: WorkspaceProject,
  presetKind: AuthoredResourceKind | undefined,
  onCreated: () => void
): Promise<void> => {
  const kind = presetKind ?? (await pickKind());
  if (!kind) return;

  const name = await vscode.window.showInputBox({
    title: `New ${KIND_LABELS[kind]}`,
    prompt: kind === "example" ? "Instance id" : "Resource name (PascalCase)",
    placeHolder: kind === "example" ? "patient-example" : "MyPatient",
    ignoreFocusOut: true,
    validateInput: (value) =>
      NAME.test(value.trim())
        ? undefined
        : "Letters, digits and hyphens, starting with a letter",
  });
  if (!name) return;

  let exampleResourceType: string | undefined;
  if (kind === "example") {
    exampleResourceType = await vscode.window.showInputBox({
      title: "New Example instance",
      prompt: "Resource type",
      placeHolder: "Patient",
      ignoreFocusOut: true,
      validateInput: (value) =>
        /^[A-Z][A-Za-z]+$/.test(value.trim()) ? undefined : "A FHIR resource type",
    });
    if (!exampleResourceType) return;
  }

  const skeleton = buildConformanceSkeleton({
    kind,
    name: name.trim(),
    canonicalBase: project.manifest.canonical,
    exampleResourceType: exampleResourceType?.trim(),
  });

  const id = typeof skeleton.content.id === "string" ? skeleton.content.id : name.trim();
  const target = vscode.Uri.joinPath(
    project.root,
    ...directoryForKind(kind).split("/"),
    fileNameForResource(skeleton.resourceType, id)
  );

  const exists = await vscode.workspace.fs.stat(target).then(
    () => true,
    () => false
  );
  if (exists) {
    vscode.window.showErrorMessage(`${target.fsPath} already exists.`);
    return;
  }

  await vscode.workspace.fs.createDirectory(
    vscode.Uri.joinPath(project.root, ...directoryForKind(kind).split("/"))
  );
  await vscode.workspace.fs.writeFile(
    target,
    encoder.encode(serializeResource(skeleton.content))
  );

  onCreated();
  await vscode.window.showTextDocument(target);
};
