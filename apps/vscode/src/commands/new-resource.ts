import * as vscode from "vscode";
import { buildConformanceSkeleton } from "@fhir-explorer/core/projects/content";
import type { AuthoredResourceKind } from "@fhir-explorer/core/projects/types";
import type { FhirIndex } from "@/language/fhir-index";
import { pickProfile } from "@/commands/pick-profile";
import type { WorkspaceProject } from "@/workspace/project-discovery";
import {
  directoryForKind,
  fileNameForResource,
  serializeResource,
} from "@/workspace/layout";

const encoder = new TextEncoder();

const KINDS: AuthoredResourceKind[] = ["profile", "extension", "valueset", "codesystem", "example"];

/** A function, not a table: the display language is only known at runtime. */
const kindLabel = (kind: AuthoredResourceKind): string => {
  switch (kind) {
    case "profile":
      return vscode.l10n.t("Profile");
    case "extension":
      return vscode.l10n.t("Extension");
    case "valueset":
      return "ValueSet";
    case "codesystem":
      return "CodeSystem";
    case "example":
      return vscode.l10n.t("Example instance");
  }
};

const NAME = /^[A-Za-z][A-Za-z0-9-]*$/;

// `kind` is taken by QuickPickItem itself, hence the longer field name.
type KindPick = vscode.QuickPickItem & { resourceKind: AuthoredResourceKind };

const pickKind = async (): Promise<AuthoredResourceKind | undefined> => {
  const items: KindPick[] = KINDS.map((resourceKind) => ({
    label: kindLabel(resourceKind),
    resourceKind,
  }));
  const picked = await vscode.window.showQuickPick(items, {
    title: vscode.l10n.t("New FHIR Resource"),
    placeHolder: vscode.l10n.t("What do you want to create?"),
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
  index: FhirIndex,
  onCreated: () => void
): Promise<void> => {
  const kind = presetKind ?? (await pickKind());
  if (!kind) return;

  // The profile comes first for an instance: it decides the resource type, so
  // asking for the type separately would only let the two disagree.
  let profileUrl: string | undefined;
  let exampleResourceType: string | undefined;
  if (kind === "example") {
    const snapshot = await index.get();
    const choice = await pickProfile(
      snapshot,
      project.key,
      vscode.l10n.t("New Example instance — which profile?")
    );
    if (!choice) return;
    profileUrl = choice.profileUrl;
    exampleResourceType = choice.resourceType;
  }

  const name = await vscode.window.showInputBox({
    title: vscode.l10n.t("New {0}", kindLabel(kind)),
    prompt:
      kind === "example"
        ? vscode.l10n.t("Instance id")
        : vscode.l10n.t("Resource name (PascalCase)"),
    placeHolder:
      kind === "example"
        ? `${exampleResourceType?.toLowerCase() ?? "patient"}-example`
        : "MyPatient",
    ignoreFocusOut: true,
    validateInput: (value) =>
      NAME.test(value.trim())
        ? undefined
        : vscode.l10n.t("Letters, digits and hyphens, starting with a letter"),
  });
  if (!name) return;

  const skeleton = buildConformanceSkeleton({
    kind,
    name: name.trim(),
    canonicalBase: project.manifest.canonical,
    exampleResourceType,
    exampleProfile: profileUrl,
  });

  // An instance carries the id it was named with, so the file name, the
  // resource id and any local reference to it line up.
  if (kind === "example") skeleton.content.id = name.trim();

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
    vscode.window.showErrorMessage(vscode.l10n.t("{0} already exists.", target.fsPath));
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
