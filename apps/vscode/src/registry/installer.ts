import * as vscode from "vscode";
import { ImporterClient } from "@fhir-explorer/core/fhir-importer/client";
import { extractArchiveEntries } from "@fhir-explorer/core/fhir-importer/parser";
import type { HttpClient } from "@fhir-explorer/core/ports";
import { hostPackageParser } from "@/adapters/host-package-parser";
import {
  fhirHomePackagesUri,
  readCachedPackage,
  type CachedPackage,
} from "@/adapters/fhir-home-cache";
import type { GlobalPackageStore } from "@/adapters/global-package-store";
import type { PlannedPackage } from "@/registry/plan";
import type { PackageRegistryApi } from "@/registry/types";

/**
 * Downloads and installs the packages a plan calls for.
 *
 * Two destinations: the extension's own store, which is what the language
 * features read, and — unless the user turned it off — the shared
 * `~/.fhir/packages` cache, so the IG Publisher and Sushi benefit from the
 * same download instead of fetching it again.
 */

export type InstallOutcome = {
  installed: string[];
  reused: string[];
  failed: { key: string; message: string }[];
};

/** How many downloads run at once. Enough to be quick, not enough to be rude. */
const CONCURRENCY = 4;

const decoder = new TextDecoder();

const runWithLimit = async <T, R>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<R>
): Promise<R[]> => {
  const results: R[] = new Array(items.length);
  let next = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    for (let index = next++; index < items.length; index = next++) {
      results[index] = await worker(items[index]);
    }
  });
  await Promise.all(runners);
  return results;
};

/**
 * Write the archive into the shared cache in its own layout:
 * `<id>#<version>/package/…`, exactly as the other FHIR tools expect it.
 */
const writeToFhirHome = async (
  id: string,
  version: string,
  buffer: ArrayBuffer
): Promise<void> => {
  const root = vscode.Uri.joinPath(fhirHomePackagesUri(), `${id}#${version}`);
  const entries = await extractArchiveEntries(buffer);
  if (entries.length === 0) return;

  // Write to a sibling first and move it into place, so a cancelled or failed
  // download cannot leave another tool looking at half a package.
  const staging = vscode.Uri.joinPath(
    fhirHomePackagesUri(),
    `.${id}#${version}.incomplete`
  );
  try {
    await vscode.workspace.fs.delete(staging, { recursive: true });
  } catch {
    // nothing staged from an earlier run
  }

  for (const entry of entries) {
    const segments = entry.path.split("/").filter(Boolean);
    if (segments.length === 0 || segments.includes("..")) continue;
    const target = vscode.Uri.joinPath(staging, ...segments);
    await vscode.workspace.fs.createDirectory(
      vscode.Uri.joinPath(staging, ...segments.slice(0, -1))
    );
    await vscode.workspace.fs.writeFile(target, entry.data);
  }

  try {
    await vscode.workspace.fs.delete(root, { recursive: true });
  } catch {
    // not cached yet
  }
  await vscode.workspace.fs.rename(staging, root, { overwrite: true });
};

export type InstallerOptions = {
  store: GlobalPackageStore;
  registry: PackageRegistryApi;
  http: HttpClient;
  /** Cached packages found on this machine, keyed by `id@version`. */
  cached: Map<string, CachedPackage>;
  writeToSharedCache: boolean;
};

export class PackageInstaller {
  private readonly client: ImporterClient;

  constructor(private readonly options: InstallerOptions) {
    this.client = new ImporterClient({
      store: options.store,
      parser: hostPackageParser,
    });
  }

  /**
   * Install everything in `packages` that is not already there.
   *
   * A single failure does not abort the rest: a missing optional dependency
   * still leaves a usable install, and the caller reports what did not work.
   */
  async install(
    packages: PlannedPackage[],
    report: (message: string, completed: number, total: number) => void,
    token?: vscode.CancellationToken
  ): Promise<InstallOutcome> {
    const outcome: InstallOutcome = { installed: [], reused: [], failed: [] };
    const pending = packages.filter((entry) => !entry.satisfied);
    let completed = 0;

    const step = (label: string) => {
      completed += 1;
      report(label, completed, pending.length);
    };

    await runWithLimit(pending, CONCURRENCY, async (entry) => {
      if (token?.isCancellationRequested) return;

      try {
        const cached = this.options.cached.get(entry.key);
        if (cached) {
          // Already extracted on this machine — read it rather than download.
          await this.client.importParsed(await readCachedPackage(cached));
          outcome.reused.push(entry.key);
          step(`Read ${entry.key} from the local cache`);
          return;
        }

        const url =
          entry.tarball ?? this.options.registry.tarballUrl(entry.id, entry.version);
        const buffer = await this.options.http.getArrayBuffer(url);
        if (token?.isCancellationRequested) return;

        await this.client.importPackageBuffer(buffer);

        if (this.options.writeToSharedCache) {
          try {
            await writeToFhirHome(entry.id, entry.version, buffer);
          } catch (error) {
            // The install itself succeeded; sharing it is a courtesy.
            console.warn(
              `Could not write ${entry.key} to ~/.fhir/packages:`,
              error instanceof Error ? error.message : error
            );
          }
        }

        outcome.installed.push(entry.key);
        step(`Installed ${entry.key}`);
      } catch (error) {
        outcome.failed.push({
          key: entry.key,
          message: error instanceof Error ? error.message : String(error),
        });
        step(`Failed ${entry.key}`);
      }
    });

    return outcome;
  }
}

/** Read a project manifest's `dependencies`, tolerating a malformed file. */
export const readManifestDependencies = async (
  manifestUri: vscode.Uri
): Promise<Record<string, string>> => {
  try {
    const bytes = await vscode.workspace.fs.readFile(manifestUri);
    const parsed: unknown = JSON.parse(decoder.decode(bytes));
    if (!parsed || typeof parsed !== "object") return {};
    const dependencies = (parsed as { dependencies?: unknown }).dependencies;
    if (!dependencies || typeof dependencies !== "object") return {};
    return Object.fromEntries(
      Object.entries(dependencies as Record<string, unknown>).filter(
        (entry): entry is [string, string] => typeof entry[1] === "string"
      )
    );
  } catch {
    return {};
  }
};
