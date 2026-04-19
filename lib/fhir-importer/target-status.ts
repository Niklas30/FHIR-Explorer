import type { DependencyState, ImportState, PackageKey } from "./types";
import { buildPackageKey } from "./utils";

export const getCurrentTargetKey = (state: Pick<ImportState, "currentTarget">) => {
  const currentTarget = state.currentTarget;
  if (!currentTarget) return null;
  return buildPackageKey(currentTarget.id, currentTarget.version);
};

type TargetStatusInput = {
  packages: Array<{ key: PackageKey }>;
  state: Pick<ImportState, "currentTarget">;
  dependencyState: Pick<DependencyState, "missing" | "conflicts">;
};

export const isTargetImportInProgress = (input: TargetStatusInput) => {
  const targetKey = getCurrentTargetKey(input.state);
  if (!targetKey) return false;
  return !input.packages.some((pkg) => pkg.key === targetKey);
};

export const isProjectSelectableForDatasets = (
  projectKey: PackageKey,
  input: TargetStatusInput
) => {
  const targetKey = getCurrentTargetKey(input.state);
  if (!targetKey) return true;
  if (projectKey !== targetKey) return true;
  if (isTargetImportInProgress(input)) return false;
  return input.dependencyState.missing.length === 0 && input.dependencyState.conflicts.length === 0;
};

