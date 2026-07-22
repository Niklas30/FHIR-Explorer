import type { DependencyRequirement } from "@/lib/fhir-importer/types";

export const formatRequirement = (dependency: DependencyRequirement) => {
  if (dependency.exactVersion) {
    return dependency.exactVersion;
  }
  if (dependency.ranges.length === 1) {
    return dependency.ranges[0];
  }
  return dependency.ranges.join(", ");
};

export const parsePackageKey = (key: string) => {
  const index = key.lastIndexOf("@");
  if (index <= 0) return { id: key, version: "" };
  return { id: key.slice(0, index), version: key.slice(index + 1) };
};

/**
 * Derives which of the three wizard steps is active and whether the import has
 * finished, from the current import state. Kept as a pure helper so the wizard
 * component stays below the lint complexity budget.
 */
export const deriveWizardStep = ({
  hasTarget,
  isTargetImported,
  allResolved,
  hasCompletedSummary,
}: {
  hasTarget: boolean;
  isTargetImported: boolean;
  allResolved: boolean;
  hasCompletedSummary: boolean;
}): { activeStepIndex: number; importFinished: boolean } => {
  const importFinished = hasCompletedSummary && !hasTarget;
  if (!hasTarget) return { activeStepIndex: importFinished ? 2 : 0, importFinished };
  if (!isTargetImported) return { activeStepIndex: 0, importFinished };
  if (!allResolved) return { activeStepIndex: 1, importFinished };
  return { activeStepIndex: 2, importFinished };
};

