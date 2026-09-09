import { collectDependencies, type DependencyGraph } from "@/lib/fhir-importer/dependency-graph";
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


/**
 * Which log the wizard shows, and how it labels it.
 *
 * While a target is active the log is the running commentary of this import;
 * once it is done, the same card carries the last completed one.
 */
export const describeLog = ({
  running,
  importLog,
  lastImportLog,
  text,
}: {
  running: boolean;
  importLog: string[];
  lastImportLog: string[];
  text: { latestImportActions: string; importLogHistory: string };
}): { log: string[]; description: string } =>
  running
    ? { log: importLog, description: text.latestImportActions }
    : { log: lastImportLog, description: text.importLogHistory };

/**
 * What the dependency graph card shows, and what the success card counts.
 *
 * Both read the same graph from different ends: while an import runs the root
 * is the active target, and once it is finished the root is the target that
 * was completed — which is also the point at which its dependencies can be
 * counted.
 */
export const describeGraph = ({
  graph,
  importFinished,
  completedTargetKey,
  targetKey,
  isTargetReady,
}: {
  graph: DependencyGraph;
  importFinished: boolean;
  completedTargetKey?: string;
  targetKey: string | null;
  isTargetReady: boolean;
}): { rootKey: string | null; show: boolean; dependencyCount: number } => {
  const rootKey = importFinished ? completedTargetKey ?? null : targetKey;
  return {
    rootKey,
    show: Boolean(rootKey) && (isTargetReady || importFinished),
    dependencyCount:
      importFinished && completedTargetKey
        ? collectDependencies(completedTargetKey, graph).size
        : 0,
  };
};
