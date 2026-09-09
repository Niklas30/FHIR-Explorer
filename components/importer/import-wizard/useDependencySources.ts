"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { listSourcesFor, type PackageSource } from "@/lib/fhir-importer/registry";
import type { PackageRef } from "@/lib/fhir-importer/types";
import { buildPackageKey } from "@/lib/fhir-importer/utils";

/**
 * Which registries carry each of these packages.
 *
 * Only asked for when someone is choosing by hand: it is one metadata request
 * per package, and the automatic import has no use for the answer — it picks
 * a source and says which.
 */

export type DependencySources = Record<string, PackageSource[]>;

export const useDependencySources = (
  refs: PackageRef[],
  enabled: boolean
): DependencySources => {
  const [sources, setSources] = useState<DependencySources>({});
  // Kept in a ref as well so the effect can see what is already known without
  // depending on the state it writes.
  const known = useRef<DependencySources>({});

  const wanted = useMemo(() => {
    if (!enabled) return "";
    return Array.from(new Set(refs.map((ref) => buildPackageKey(ref.id, ref.version))))
      .sort()
      .join("\n");
  }, [enabled, refs]);

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
