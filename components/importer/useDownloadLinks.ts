"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { resolveDownloadUrl } from "@/lib/fhir-importer/registry";
import type { DependencyRequirement, PackageRef } from "@/lib/fhir-importer/types";
import { buildPackageKey } from "@/lib/fhir-importer/utils";

/**
 * Turns package references into download links that actually resolve.
 *
 * The link cannot be built from the id and version alone: which registry
 * serves a given version is only known by asking, because the mirror the
 * importer defaults to carries just a slice of the versions publishers
 * released. So links are looked up in the background, and until an answer
 * arrives the default registry's url stands in — the same link as before.
 */

export type DownloadLink = {
  url: string;
  /** Registry the version was found in. */
  registry: string;
  /** False when no registry in the chain lists this version. */
  found: boolean;
};

export const useDownloadLinks = (
  currentTarget: PackageRef | undefined,
  missing: DependencyRequirement[],
  fallback: (id: string, version: string) => string
): ((id: string, version: string) => string) => {
  const [links, setLinks] = useState<Record<string, DownloadLink>>({});
  // Held in a ref as well, so the effect can tell what is already resolved
  // without listing `links` as a dependency and re-running on its own writes.
  const resolved = useRef<Record<string, DownloadLink>>({});

  // Every link on the page: the target, plus each missing dependency whose
  // version is already settled. Reduced to one string so re-rendering with an
  // equivalent set does not start the lookups over.
  const wanted = useMemo(() => {
    const refs: PackageRef[] = currentTarget ? [currentTarget] : [];
    for (const dependency of missing) {
      const version = dependency.exactVersion ?? dependency.chosenVersion;
      if (version) refs.push({ id: dependency.id, version });
    }
    return Array.from(new Set(refs.map((ref) => buildPackageKey(ref.id, ref.version))))
      .sort()
      .join("\n");
  }, [currentTarget, missing]);

  useEffect(() => {
    const keys = wanted ? wanted.split("\n") : [];
    const pending = keys.filter((key) => !resolved.current[key]);
    if (pending.length === 0) return;

    let cancelled = false;
    void (async () => {
      for (const key of pending) {
        const separator = key.lastIndexOf("@");
        const id = key.slice(0, separator);
        const version = key.slice(separator + 1);
        const link = await resolveDownloadUrl(id, version);
        if (cancelled) return;
        resolved.current = { ...resolved.current, [key]: link };
        setLinks(resolved.current);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [wanted]);

  return (id: string, version: string) =>
    links[buildPackageKey(id, version)]?.url ?? fallback(id, version);
};
