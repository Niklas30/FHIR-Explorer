import * as vscode from "vscode";
import { getProfileSummaries } from "@fhir-explorer/core/fhir-editor/profiles/summaries";
import type { ProfileSummary } from "@fhir-explorer/core/fhir-editor/profiles/types";
import type { FhirIndexSnapshot } from "@/language/fhir-index";

/**
 * Choose the profile a new instance conforms to.
 *
 * Without this the extension asked for a resource type as free text and wrote
 * a skeleton with no `meta.profile`, so the form and the validator fell back to
 * the base FHIR definition — you were authoring against the spec instead of
 * against your own profile, with nothing to tell you.
 */

export type ProfileChoice = {
  resourceType: string;
  /** Undefined for a base FHIR resource, which needs no meta.profile. */
  profileUrl?: string;
};

const BASE_PREFIX = "http://hl7.org/fhir/StructureDefinition/";

/**
 * A base resource definition is not a profile — writing `meta.profile` for
 * `Patient` would claim a constraint that is not there.
 */
const isBaseResource = (summary: ProfileSummary): boolean =>
  summary.url === `${BASE_PREFIX}${summary.type}`;

type ProfilePick = vscode.QuickPickItem & { choice?: ProfileChoice };

const groupLabel = (origin: string | undefined, project: string | undefined): string => {
  if (!origin) return "Other";
  if (origin === project) return "This project";
  return origin;
};

export const pickProfile = async (
  snapshot: FhirIndexSnapshot,
  projectKey: string | undefined,
  title: string
): Promise<ProfileChoice | undefined> => {
  const summaries = getProfileSummaries(snapshot.registry);
  if (summaries.length === 0) {
    vscode.window.showWarningMessage(
      "No StructureDefinitions available. Add a dependency such as hl7.fhir.r4.core first."
    );
    return undefined;
  }

  // Grouped by where the profile came from: your own profiles first, then the
  // packages, then the base spec — which is the order they matter in.
  const byGroup = new Map<string, ProfileSummary[]>();
  for (const summary of summaries) {
    const origin = snapshot.origins.get(summary.url);
    const group = isBaseResource(summary)
      ? "Base FHIR resources"
      : groupLabel(origin, projectKey);
    byGroup.set(group, [...(byGroup.get(group) ?? []), summary]);
  }

  const order = [...byGroup.keys()].sort((a, b) => {
    const rank = (value: string) =>
      value === "This project" ? 0 : value === "Base FHIR resources" ? 2 : 1;
    return rank(a) - rank(b) || a.localeCompare(b);
  });

  const items: ProfilePick[] = [];
  for (const group of order) {
    items.push({ label: group, kind: vscode.QuickPickItemKind.Separator });
    for (const summary of byGroup.get(group) ?? []) {
      items.push({
        label: summary.title ?? summary.name,
        description: summary.type,
        detail: summary.url,
        choice: {
          resourceType: summary.type ?? "Basic",
          profileUrl: isBaseResource(summary) ? undefined : summary.url,
        },
      });
    }
  }

  const picked = await vscode.window.showQuickPick(items, {
    title,
    placeHolder: "Search by name, resource type or canonical url",
    matchOnDescription: true,
    matchOnDetail: true,
  });
  return picked?.choice;
};
