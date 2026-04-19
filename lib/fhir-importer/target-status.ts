import type { DependencyState, ImportState, PackageRecord } from "./types";
import { buildPackageKey } from "./utils";

type TargetStatusInput = {
  packages: Pick<PackageRecord, "key">[];
  state: Pick<ImportState, "currentTarget">;
  dependencyState?: Pick<DependencyState, "missing" | "conflicts">;
};

export const getCurrentTargetKey = (
  state: Pick<ImportState, "currentTarget">
): string | null => {
  if (!state.currentTarget) return null;
  return buildPackageKey(state.currentTarget.id, state.currentTarget.version);
};

export const isTargetImportInProgress = ({
  packages,
  state,
}: TargetStatusInput): boolean => {
  const targetKey = getCurrentTargetKey(state);
  if (!targetKey) return false;

  const isTargetImported = packages.some((pkg) => pkg.key === targetKey);
  return !isTargetImported;
};

export const isProjectSelectableForDatasets = (
  projectKey: string,
  input: TargetStatusInput
): boolean => {
  const targetKey = getCurrentTargetKey(input.state);
  if (!targetKey || projectKey !== targetKey) return true;
  if (isTargetImportInProgress(input)) return false;
  return (input.dependencyState?.missing.length ?? 0) === 0 && (input.dependencyState?.conflicts.length ?? 0) === 0;
};
