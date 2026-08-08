import * as vscode from "vscode";
import type { PackageRecord, ResourcePayload } from "@fhir-explorer/core/fhir-importer/types";
import { planClone } from "@/project/clone-plan";
import { serializeResource } from "@/workspace/layout";

/**
 * Fork an imported package into an editable project.
 *
 * Same semantics as the web app's duplicate: the resources are copied
 * verbatim. Canonicals are **not** rewritten — a fork that silently rewrote
 * every url would break the references between the copied resources and every
 * reference to them from outside. Adjusting them is an editing decision the
 * user makes afterwards, with go-to-definition and rename to help.
 *
 * The new project does not depend on the package it came from — it now
 * contains those resources — so it inherits the source's own dependencies
 * instead.
 */

const encoder = new TextEncoder();

export type CloneOutcome = { written: number; skipped: number };

export const clonePackageResources = async (
  root: vscode.Uri,
  payloads: ResourcePayload[],
  report?: (completed: number, total: number) => void
): Promise<CloneOutcome> => {
  const plan = planClone(payloads);

  for (const [index, file] of plan.files.entries()) {
    const segments = file.path.split("/");
    await vscode.workspace.fs.createDirectory(
      vscode.Uri.joinPath(root, ...segments.slice(0, -1))
    );
    await vscode.workspace.fs.writeFile(
      vscode.Uri.joinPath(root, ...segments),
      encoder.encode(serializeResource(file.content))
    );
    report?.(index + 1, plan.files.length);
  }

  return { written: plan.files.length, skipped: plan.skipped };
};

/** Manifest fields a clone inherits from the package it forks. */
export const cloneDefaultsFrom = (record: PackageRecord) => ({
  title: record.manifest.title,
  description: record.manifest.description,
  canonical: record.manifest.canonical,
  fhirVersion: record.manifest.fhirVersions?.[0],
  // Not the source package itself: the clone holds its resources now, and
  // depending on it as well would define every canonical twice.
  dependencies: record.manifest.dependencies ?? {},
});
