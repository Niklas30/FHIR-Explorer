import * as vscode from "vscode";
import { GlobalPackageStore } from "@/adapters/global-package-store";
import { listCachedPackages, type CachedPackage } from "@/adapters/fhir-home-cache";
import { nodeHttpClient } from "@/adapters/node-http-client";
import {
  PACKAGES2_REGISTRY_BASE,
  PACKAGES_CATALOG_BASE,
  SIMPLIFIER_REGISTRY_BASE,
} from "@fhir-explorer/core/fhir-importer/registry";
import { ChainedRegistry } from "@fhir-explorer/core/fhir-importer/chained-registry";
import { PackageInstaller } from "@/registry/installer";
import { RegistryClient } from "@fhir-explorer/core/fhir-importer/registry-client";
import type { PackageRegistryApi } from "@fhir-explorer/core/fhir-importer/registry-api";

/**
 * Everything the import commands need, assembled from the current settings.
 *
 * Built per invocation rather than held: the user can change the registry or
 * turn the shared cache off between two commands, and a stale client would
 * quietly keep talking to the old one.
 */

export type ImportSession = {
  registry: PackageRegistryApi;
  store: GlobalPackageStore;
  installer: PackageInstaller;
  /** `id@version` of everything already available without downloading. */
  available: Set<string>;
  cached: Map<string, CachedPackage>;
};

export type RegistrySource = {
  /** npm-shaped metadata endpoint, answering at `/{id}`. */
  url: string;
  /** Catalogue endpoint for search, when this registry has one. */
  searchUrl?: string;
};

/**
 * Where packages are looked for, in order.
 *
 * `packages2.fhir.org` first because it publishes each version's
 * `dependencies`, so the tree resolves without downloading anything. It
 * mirrors only a slice of the versions publishers released, though — a
 * package pinning an older dependency needs Simplifier, which has the full
 * history and whose dependencies are read out of the archive instead.
 */
const DEFAULT_SOURCES: RegistrySource[] = [
  { url: PACKAGES2_REGISTRY_BASE, searchUrl: PACKAGES_CATALOG_BASE },
  { url: SIMPLIFIER_REGISTRY_BASE, searchUrl: SIMPLIFIER_REGISTRY_BASE },
];

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value && typeof value === "object" && !Array.isArray(value));

/** Settings are user-editable JSON, so anything unusable is dropped, not trusted. */
const readSources = (configured: unknown): RegistrySource[] => {
  if (!Array.isArray(configured)) return DEFAULT_SOURCES;
  const sources = configured.filter(isRecord).flatMap((entry) => {
    const url = typeof entry.url === "string" ? entry.url.trim() : "";
    if (!url) return [];
    const searchUrl = typeof entry.searchUrl === "string" ? entry.searchUrl.trim() : "";
    return [{ url, searchUrl: searchUrl || undefined }];
  });
  return sources.length > 0 ? sources : DEFAULT_SOURCES;
};

export const createImportSession = async (
  context: vscode.ExtensionContext
): Promise<ImportSession> => {
  const configuration = vscode.workspace.getConfiguration("fhirExplorer");
  const sources = readSources(configuration.get<unknown>("registry.sources"));
  const useFhirHome = configuration.get<boolean>("packageCache.useFhirHome") ?? true;

  const registry = new ChainedRegistry(
    sources.map(
      (source) => new RegistryClient(nodeHttpClient, source.url, source.searchUrl)
    )
  );
  const store = new GlobalPackageStore(context.globalStorageUri);

  const cached = new Map<string, CachedPackage>();
  if (useFhirHome) {
    for (const entry of await listCachedPackages()) cached.set(entry.key, entry);
  }

  const available = new Set<string>([
    ...(await store.listPackages()).map((entry) => entry.key),
    ...cached.keys(),
  ]);

  return {
    registry,
    store,
    available,
    cached,
    installer: new PackageInstaller({
      store,
      registry,
      http: nodeHttpClient,
      cached,
      writeToSharedCache: useFhirHome,
    }),
  };
};
