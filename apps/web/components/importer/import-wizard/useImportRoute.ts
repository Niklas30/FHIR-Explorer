"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useDependencySources } from "@/components/importer/import-wizard/useDependencySources";
import type { DependencyRequirement, PackageRef } from "@/lib/fhir-importer/types";

/**
 * Which route the user took through the import, and what it needs to know.
 *
 * There are two, chosen after the package is named and before anything is
 * downloaded: let the tool walk the tree, or pick every package's registry by
 * hand. The choice is per target — agreeing to import one package is not
 * agreement to import the next one — and the step-by-step route needs the list
 * of registries carrying each package, which the automatic one does not.
 */

export type ImportMode = "undecided" | "auto" | "manual";

type ImportRouteOptions = {
  currentTarget?: PackageRef;
  /** Identity of the target, so a new one resets the choice. */
  targetKey: string | null;
  missing: DependencyRequirement[];
  advancedMode: boolean;
  allResolved: boolean;
  isTargetImported: boolean;
  /** Runs the whole tree; used by both the automatic route and the way out of the manual one. */
  onAuto: () => void;
};

export const useImportRoute = ({
  currentTarget,
  targetKey,
  missing,
  advancedMode,
  allResolved,
  isTargetImported,
  onAuto,
}: ImportRouteOptions) => {
  const [importMode, setImportMode] = useState<ImportMode>("undecided");

  useEffect(() => {
    setImportMode("undecided");
  }, [targetKey]);

  const choosingSources = advancedMode || importMode === "manual";

  // The target is on this list too: in the step-by-step route it is the first
  // thing the user picks a source for, not something fetched for them.
  const sourceRefs = useMemo<PackageRef[]>(() => {
    const refs: PackageRef[] = currentTarget ? [currentTarget] : [];
    for (const dependency of missing) {
      const version = dependency.exactVersion ?? dependency.chosenVersion;
      if (version) refs.push({ id: dependency.id, version });
    }
    return refs;
  }, [currentTarget, missing]);

  const sources = useDependencySources(sourceRefs, choosingSources);

  const chooseAuto = useCallback(() => {
    setImportMode("auto");
    onAuto();
  }, [onAuto]);

  const chooseManual = useCallback(() => setImportMode("manual"), []);
  const resetRoute = useCallback(() => setImportMode("undecided"), []);

  return {
    importMode,
    choosingSources,
    sources,
    chooseAuto,
    chooseManual,
    resetRoute,
    /** The route has not been chosen yet, and there is still something to import. */
    showChoice: Boolean(currentTarget) && importMode === "undecided" && !allResolved,
    /** Step by step, and the named package itself is still the next step. */
    showManualTarget: Boolean(currentTarget) && importMode === "manual" && !isTargetImported,
  };
};
