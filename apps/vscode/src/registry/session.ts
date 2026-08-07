import * as vscode from "vscode";
import { GlobalPackageStore } from "@/adapters/global-package-store";
import { listCachedPackages, type CachedPackage } from "@/adapters/fhir-home-cache";
import { nodeHttpClient } from "@/adapters/node-http-client";
import { PackageInstaller } from "@/registry/installer";
import { RegistryClient } from "@/registry/registry-client";

/**
 * Everything the import commands need, assembled from the current settings.
 *
 * Built per invocation rather than held: the user can change the registry or
 * turn the shared cache off between two commands, and a stale client would
 * quietly keep talking to the old one.
 */

export type ImportSession = {
  registry: RegistryClient;
  store: GlobalPackageStore;
  installer: PackageInstaller;
  /** `id@version` of everything already available without downloading. */
  available: Set<string>;
  cached: Map<string, CachedPackage>;
};

/** Serves dependencies in its metadata, which is what the planner needs. */
const DEFAULT_REGISTRY = "https://packages2.fhir.org/packages";
/** Serves the catalogue the metadata registry lacks. */
const DEFAULT_SEARCH = "https://packages.fhir.org";

export const createImportSession = async (
  context: vscode.ExtensionContext
): Promise<ImportSession> => {
  const configuration = vscode.workspace.getConfiguration("fhirExplorer");
  const baseUrl = configuration.get<string>("registry.baseUrl")?.trim() || DEFAULT_REGISTRY;
  const searchUrl = configuration.get<string>("registry.searchUrl")?.trim() || undefined;
  const useFhirHome = configuration.get<boolean>("packageCache.useFhirHome") ?? true;

  const registry = new RegistryClient(
    nodeHttpClient,
    baseUrl,
    searchUrl ?? (baseUrl === DEFAULT_REGISTRY ? DEFAULT_SEARCH : undefined)
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
