import type {
  ImportProgress,
  ImportResult,
  ImporterSnapshot,
  PackageRecord,
  ParsedPackage,
  ResourcePayload,
} from "./types";
import { buildResourceIndexEntries } from "./indexer";
import { parseTgzPackage } from "./parser";
import { resolveDependencies } from "./resolver";
import { ImporterStorage } from "./storage";
import { buildPackageKey } from "./utils";
import type { RegistryStrategy } from "./registry";
import { defaultRegistry } from "./registry";
import { parsePackageInWorker } from "./worker-client";

export type ImporterClientOptions = {
  registry?: RegistryStrategy;
  storeResourcePayloads?: boolean;
  useWorker?: boolean;
};

export class ImporterClient {
  private registry: RegistryStrategy;
  private storage: ImporterStorage;
  private storeResourcePayloads: boolean;
  private useWorker: boolean;

  constructor(options: ImporterClientOptions = {}) {
    this.registry = options.registry ?? defaultRegistry;
    this.storage = new ImporterStorage();
    this.storeResourcePayloads = options.storeResourcePayloads ?? true;
    this.useWorker = options.useWorker ?? true;
  }

  async loadSnapshot(): Promise<ImporterSnapshot> {
    const [state, packages, resourceIndexCount] = await Promise.all([
      this.storage.loadState(),
      this.storage.listPackages(),
      this.storage.getResourceIndexCount(),
    ]);

    return {
      state,
      packages,
      dependencyState: resolveDependencies(packages, state),
      resourceIndexCount,
    };
  }

  getDownloadUrl(id: string, version: string) {
    return this.registry.buildDownloadUrl(id, version);
  }

  async setCurrentTarget(id: string, version: string) {
    const state = await this.storage.loadState();
    const nextState = {
      ...state,
      currentTarget: { id, version },
      sessionId: state.sessionId ?? `session-${Date.now().toString(36)}-${Math.random()
        .toString(36)
        .slice(2, 8)}`,
    };
    await this.storage.saveState(nextState);
  }

  async clearCurrentTarget() {
    const state = await this.storage.loadState();
    const sessionId = state.sessionId;
    if (sessionId) {
      const packages = await this.storage.listPackages();
      const sessionPackages = packages.filter((pkg) => pkg.sessionId === sessionId);
      const keys = sessionPackages.map((pkg) => pkg.key);
      await this.storage.deletePackages(keys);
      await this.storage.deleteResourceIndexByPackageKeys(keys);
      await this.storage.deleteResourcePayloadsByPackageKeys(keys);
    }

    await this.storage.saveState({
      versionSelections: {},
      importHistory: state.importHistory,
    });
  }

  async finalizeCurrentTarget() {
    const state = await this.storage.loadState();
    await this.storage.saveState({
      versionSelections: {},
      importHistory: state.importHistory,
    });
  }

  async setVersionSelection(depId: string, version: string) {
    const state = await this.storage.loadState();
    const nextState = {
      ...state,
      versionSelections: {
        ...state.versionSelections,
        [depId]: version,
      },
    };
    await this.storage.saveState(nextState);
  }

  async clearVersionSelection(depId: string) {
    const state = await this.storage.loadState();
    const rest = { ...state.versionSelections };
    delete rest[depId];
    await this.storage.saveState({
      ...state,
      versionSelections: rest,
    });
  }

  async importPackageFile(
    file: File,
    onProgress?: (progress: ImportProgress) => void
  ): Promise<ImportResult> {
    onProgress?.({ phase: "reading", message: "Reading package file" });

    const buffer = await file.arrayBuffer();

    onProgress?.({ phase: "parsing", message: "Parsing archive" });

    const parsed = await this.parsePackage(buffer, (progress) =>
      onProgress?.({
        phase: "parsing",
        message: "Parsing archive",
        percent: progress,
      })
    );
    return await this.importParsedPackage(parsed, onProgress);
  }

  async importTargetFile(
    file: File,
    onProgress?: (progress: ImportProgress) => void
  ): Promise<ImportResult> {
    onProgress?.({ phase: "reading", message: "Reading package file" });

    const buffer = await file.arrayBuffer();

    onProgress?.({ phase: "parsing", message: "Parsing archive" });

    const parsed = await this.parsePackage(buffer, (progress) =>
      onProgress?.({
        phase: "parsing",
        message: "Parsing archive",
        percent: progress,
      })
    );

    await this.setCurrentTarget(parsed.id, parsed.version);

    return await this.importParsedPackage(parsed, onProgress);
  }

  async addImportHistory(targetKey: string) {
    const state = await this.storage.loadState();
    const history = state.importHistory ?? [];
    const filtered = history.filter((entry) => entry.targetKey !== targetKey);
    const next = [{ targetKey, completedAt: Date.now() }, ...filtered].slice(0, 20);
    await this.storage.saveState({
      ...state,
      importHistory: next,
    });
  }

  private async parsePackage(
    buffer: ArrayBuffer,
    onProgress?: (progress: number) => void
  ): Promise<ParsedPackage> {
    if (this.useWorker && typeof Worker !== "undefined") {
      return await parsePackageInWorker(buffer, onProgress);
    }

    return await parseTgzPackage(buffer, { onProgress });
  }

  private async importParsedPackage(
    parsed: ParsedPackage,
    onProgress?: (progress: ImportProgress) => void
  ): Promise<ImportResult> {
    const existing = await this.storage.getPackage(parsed.packageKey);
    if (existing) {
      onProgress?.({ phase: "completed", message: "Package already imported" });
      return { status: "duplicate", packageKey: parsed.packageKey, warnings: [] };
    }

    onProgress?.({ phase: "indexing", message: "Indexing resources" });

    const resourceIndex = buildResourceIndexEntries(parsed.resources);
    const resourcePayloads: ResourcePayload[] = this.storeResourcePayloads
      ? parsed.resources.map((resource) => ({
          key: `${resource.resourceType}|${resource.id ?? resource.sourcePath}|${resource.packageKey}`,
          packageKey: resource.packageKey,
          resourceType: resource.resourceType,
          id: resource.id,
          url: resource.url,
          content: resource.content,
        }))
      : [];

    onProgress?.({ phase: "saving", message: "Saving to browser storage" });

    const state = await this.storage.loadState();
    const record: PackageRecord = {
      key: parsed.packageKey,
      id: parsed.id,
      version: parsed.version,
      manifest: parsed.manifest,
      addedAt: Date.now(),
      resourceCount: parsed.resources.length,
      sessionId: state.sessionId,
    };

    await this.storage.putPackage(record);
    await this.storage.putResourceIndex(resourceIndex);

    if (this.storeResourcePayloads) {
      await this.storage.putResourcePayloads(resourcePayloads);
    }

    await this.persistRangeSelections(parsed.id, parsed.version);

    onProgress?.({ phase: "completed", message: "Import complete" });

    await this.cleanupIfComplete();

    return {
      status: "imported",
      packageKey: parsed.packageKey,
      warnings: parsed.warnings,
    };
  }

  private async persistRangeSelections(importedId: string, importedVersion: string) {
    const state = await this.storage.loadState();
    if (state.versionSelections[importedId]) return;

    const packages = await this.storage.listPackages();
    const dependencyState = resolveDependencies(packages, state);

    const matching = [...dependencyState.missing, ...dependencyState.resolved].find(
      (dependency) => dependency.id === importedId && !dependency.exactVersion
    );

    if (matching?.chosenVersion) {
      await this.storage.saveState({
        ...state,
        versionSelections: {
          ...state.versionSelections,
          [importedId]: matching.chosenVersion ?? importedVersion,
        },
      });
    }
  }

  private async cleanupIfComplete() {
    const state = await this.storage.loadState();
    if (!state.currentTarget) return;

    const packages = await this.storage.listPackages();
    const dependencyState = resolveDependencies(packages, state);
    const targetKey = buildPackageKey(state.currentTarget.id, state.currentTarget.version);
    const isTargetImported = packages.some((pkg) => pkg.key === targetKey);

    if (!isTargetImported || dependencyState.missing.length > 0) {
      return;
    }

    const requiredKeys = this.getRequiredPackageKeys(
      state.currentTarget.id,
      state.currentTarget.version,
      packages,
      state.versionSelections
    );

    if (!state.sessionId) return;

    const sessionPackages = packages.filter((pkg) => pkg.sessionId === state.sessionId);
    const deletions = sessionPackages
      .filter((pkg) => !requiredKeys.has(pkg.key))
      .map((pkg) => pkg.key);

    await this.storage.deletePackages(deletions);
    await this.storage.deleteResourceIndexByPackageKeys(deletions);
    await this.storage.deleteResourcePayloadsByPackageKeys(deletions);
  }

  async deletePackage(packageKey: string) {
    const record = await this.storage.getPackage(packageKey);
    if (!record) return;
    await this.storage.deletePackage(packageKey);
    await this.storage.deleteResourceIndexByPackageKeys([packageKey]);
    await this.storage.deleteResourcePayloadsByPackageKeys([packageKey]);

    const state = await this.storage.loadState();
    const history = state.importHistory ?? [];
    const nextHistory = history.filter((entry) => entry.targetKey !== packageKey);

    if (state.currentTarget && buildPackageKey(state.currentTarget.id, state.currentTarget.version) === packageKey) {
      await this.storage.saveState({
        versionSelections: {},
        importHistory: nextHistory,
      });
    } else {
      await this.storage.saveState({
        ...state,
        importHistory: nextHistory,
      });
    }
  }

  private getRequiredPackageKeys(
    targetId: string,
    targetVersion: string,
    packages: PackageRecord[],
    selections: Record<string, string>
  ): Set<string> {
    const byIdVersion = new Map<string, PackageRecord>();
    for (const pkg of packages) {
      byIdVersion.set(buildPackageKey(pkg.id, pkg.version), pkg);
    }

    const required = new Set<string>();
    const queue: PackageRecord[] = [];
    const targetKey = buildPackageKey(targetId, targetVersion);
    const targetPackage = byIdVersion.get(targetKey);
    if (targetPackage) {
      queue.push(targetPackage);
    }

    while (queue.length > 0) {
      const current = queue.shift()!;
      if (required.has(current.key)) continue;
      required.add(current.key);

      const deps = current.manifest.dependencies ?? {};
      for (const [depId, spec] of Object.entries(deps)) {
        const depKey = buildPackageKey(depId, spec);
        let nextKey = depKey;
        if (spec.trim() !== spec || /[<>=^~*xX|\s]/.test(spec.trim())) {
          const chosen = selections[depId];
          if (!chosen) continue;
          nextKey = buildPackageKey(depId, chosen);
        }
        const depPackage = byIdVersion.get(nextKey);
        if (depPackage) {
          queue.push(depPackage);
        }
      }
    }

    return required;
  }
}
