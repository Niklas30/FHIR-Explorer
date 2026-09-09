"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { listSourcesFor, type PackageSource } from "@/lib/fhir-importer/registry";
import type { DependencyRequirement } from "@/lib/fhir-importer/types";
import { buildPackageKey } from "@/lib/fhir-importer/utils";

/**
 * Which registries carry each missing dependency.
 *
 * Only asked for when the advanced controls are open: it is one metadata
 * request per dependency, and the automatic import has no use for the answer
 * — it picks a source and says which. This is for deciding by hand.
 */

export type DependencySources = Record<string, PackageSource[]>;

export const useDependencySources = (
  missing: DependencyRequirement[],
  enabled: boolean
): DependencySources => {
  const [sources, setSources] = useState<DependencySources>({});
  // Kept in a ref as well so the effect can see what is already known without
  // depending on the state it writes.
  const known = useRef<DependencySources>({});

  const wanted = useMemo(() => {
    if (!enabled) return "";
    return missing
      .map((dependency) => {
        const version = dependency.exactVersion ?? dependency.chosenVersion;
        return version ? buildPackageKey(dependency.id, version) : "";
      })
      .filter(Boolean)
      .sort()
      .join("\n");
  }, [enabled, missing]);

  useEffect(() => {
    const keys = wanted ? wanted.split("\n") : [];
    const pending = keys.filter((key) => !known.current[key]);
    if (pending.length === 0) return;

    let cancelled = false;
    void (async () => {
      for (const key of pending) {
        const separator = key.lastIndexOf("@");
        const found = await listSourcesFor(key.slice(0, separator), key.slice(separator + 1));
        if (cancelled) return;
        known.current = { ...known.current, [key]: found };
        setSources(known.current);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [wanted]);

  return sources;
};
