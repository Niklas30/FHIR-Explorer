import type { ProjectIssue } from "@fhir-explorer/core/projects/analysis";
import type { AuthoredResource } from "@fhir-explorer/core/projects/types";

/**
 * Where in the workspace a project issue is reported.
 *
 * An issue about one resource goes into that file at the path it names. A
 * duplicate canonical has no single owner, so every file claiming the url gets
 * it. Whatever is left — a project without core, say — is about the project as
 * a whole and lands on its manifest (`resourceId` undefined).
 */

export type IssueTarget = { resourceId?: string; path?: string };

export const issueTargets = (
  issue: ProjectIssue,
  resources: AuthoredResource[]
): IssueTarget[] => {
  if (issue.resourceId) return [{ resourceId: issue.resourceId, path: issue.path }];

  if (issue.code === "duplicate-canonical" && issue.target) {
    const claimants = resources.filter((resource) => resource.content.url === issue.target);
    if (claimants.length > 0) {
      return claimants.map((resource) => ({ resourceId: resource.id, path: "url" }));
    }
  }
  return [{}];
};
