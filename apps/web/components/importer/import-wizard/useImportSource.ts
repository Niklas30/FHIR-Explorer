"use client";

import { useEffect, useState } from "react";
import { resolveImportUrl, type ResolvedSource } from "@/lib/fhir-importer/registry";
import type { PackageRef } from "@/lib/fhir-importer/types";

/**
 * Where the browser would fetch a package from, looked up before it does.
 *
 * The point is to be able to say so first. Importing reaches out to a third
 * party the user never named — the registry that happens to carry the version
 * — and a tool that fetches from somewhere the moment a name is typed is one
 * the user cannot audit. So the destination is resolved, shown, and only then
 * used.
 */

export type ImportSourceState =
  /** Still asking the registries. */
  | { status: "resolving" }
  /** The browser may fetch it, from here. */
  | { status: "ready"; source: ResolvedSource; host: string }
  /** No registry the browser may read carries this version. */
  | { status: "unavailable" };

const hostOf = (url: string): string => {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
};

export const useImportSource = (target: PackageRef | undefined): ImportSourceState => {
  const [state, setState] = useState<ImportSourceState>({ status: "resolving" });
  // Depend on the identity, not the object: the wizard rebuilds the reference
  // on every snapshot, and re-resolving on each of those would be pointless.
  const id = target?.id;
  const version = target?.version;

  useEffect(() => {
    if (!id || !version) {
      setState({ status: "resolving" });
      return;
    }

    let cancelled = false;
    setState({ status: "resolving" });

    void resolveImportUrl(id, version).then((source) => {
      if (cancelled) return;
      setState(
        source
          ? { status: "ready", source, host: hostOf(source.url) }
          : { status: "unavailable" }
      );
    });

    return () => {
      cancelled = true;
    };
  }, [id, version]);

  return state;
};
