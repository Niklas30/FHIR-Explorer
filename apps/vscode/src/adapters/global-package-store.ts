import * as vscode from "vscode";
import type { PackageStore } from "@fhir-explorer/core/ports";
import type {
  ImportState,
  PackageRecord,
  ResourceIndexEntry,
  ResourcePayload,
} from "@fhir-explorer/core/fhir-importer/types";

/**
 * {@link PackageStore} over the extension's global storage.
 *
 * Imported packages are machine-wide, not workspace-specific — the same IG is
 * a dependency of many projects — so this lives next to VS Code's own state
 * rather than in the user's repository.
 *
 * Payloads are split per package because they dominate the size; state, the
 * package list and the canonical index are small enough to rewrite whole.
 */

const decoder = new TextDecoder();
const encoder = new TextEncoder();

const EMPTY_STATE: ImportState = { versionSelections: {} };

/** Package keys contain characters (`@`, `.`) a file name should not carry raw. */
const payloadFileName = (packageKey: string): string =>
  `${encodeURIComponent(packageKey)}.json`;

export class GlobalPackageStore implements PackageStore {
  private readonly root: vscode.Uri;
  private readonly payloadsRoot: vscode.Uri;
  private ready: Promise<void> | undefined;

  constructor(globalStorageUri: vscode.Uri) {
    this.root = vscode.Uri.joinPath(globalStorageUri, "packages");
    this.payloadsRoot = vscode.Uri.joinPath(this.root, "payloads");
  }

  private ensureRoot(): Promise<void> {
    this.ready ??= (async () => {
      await vscode.workspace.fs.createDirectory(this.payloadsRoot);
    })();
    return this.ready;
  }

  private async readJson<T>(uri: vscode.Uri, fallback: T): Promise<T> {
    try {
      const bytes = await vscode.workspace.fs.readFile(uri);
      return JSON.parse(decoder.decode(bytes)) as T;
    } catch {
      return fallback;
    }
  }

  private async writeJson(uri: vscode.Uri, value: unknown): Promise<void> {
    await this.ensureRoot();
    await vscode.workspace.fs.writeFile(uri, encoder.encode(JSON.stringify(value)));
  }

  private file(name: string): vscode.Uri {
    return vscode.Uri.joinPath(this.root, name);
  }

  private payloadFile(packageKey: string): vscode.Uri {
    return vscode.Uri.joinPath(this.payloadsRoot, payloadFileName(packageKey));
  }

  private listIndex(): Promise<ResourceIndexEntry[]> {
    return this.readJson<ResourceIndexEntry[]>(this.file("resource-index.json"), []);
  }

  async loadState(): Promise<ImportState> {
    return await this.readJson<ImportState>(this.file("state.json"), EMPTY_STATE);
  }

  async saveState(state: ImportState): Promise<void> {
    await this.writeJson(this.file("state.json"), state);
  }

  async listPackages(): Promise<PackageRecord[]> {
    return await this.readJson<PackageRecord[]>(this.file("packages.json"), []);
  }

  async getPackage(key: string): Promise<PackageRecord | undefined> {
    return (await this.listPackages()).find((entry) => entry.key === key);
  }

  async putPackage(record: PackageRecord): Promise<void> {
    const rest = (await this.listPackages()).filter((entry) => entry.key !== record.key);
    await this.writeJson(this.file("packages.json"), [...rest, record]);
  }

  async deletePackage(key: string): Promise<void> {
    await this.deletePackages([key]);
  }

  async deletePackages(keys: string[]): Promise<void> {
    if (keys.length === 0) return;
    const remaining = (await this.listPackages()).filter(
      (entry) => !keys.includes(entry.key)
    );
    await this.writeJson(this.file("packages.json"), remaining);
  }

  async putResourceIndex(entries: ResourceIndexEntry[]): Promise<void> {
    if (entries.length === 0) return;
    const added = new Set(entries.map((entry) => entry.key));
    const kept = (await this.listIndex()).filter((entry) => !added.has(entry.key));
    await this.writeJson(this.file("resource-index.json"), [...kept, ...entries]);
  }

  async deleteResourceIndexByPackageKeys(packageKeys: string[]): Promise<void> {
    if (packageKeys.length === 0) return;
    const remaining = (await this.listIndex()).filter(
      (entry) => !packageKeys.includes(entry.packageKey)
    );
    await this.writeJson(this.file("resource-index.json"), remaining);
  }

  async getResourceIndexCount(): Promise<number> {
    return (await this.listIndex()).length;
  }

  async putResourcePayloads(entries: ResourcePayload[]): Promise<void> {
    if (entries.length === 0) return;
    const byPackage = new Map<string, ResourcePayload[]>();
    for (const entry of entries) {
      const bucket = byPackage.get(entry.packageKey);
      if (bucket) bucket.push(entry);
      else byPackage.set(entry.packageKey, [entry]);
    }

    for (const [packageKey, added] of byPackage) {
      const addedKeys = new Set(added.map((entry) => entry.key));
      const existing = await this.readJson<ResourcePayload[]>(
        this.payloadFile(packageKey),
        []
      );
      const kept = existing.filter((entry) => !addedKeys.has(entry.key));
      await this.writeJson(this.payloadFile(packageKey), [...kept, ...added]);
    }
  }

  async deleteResourcePayloadsByPackageKeys(packageKeys: string[]): Promise<void> {
    for (const packageKey of packageKeys) {
      try {
        await vscode.workspace.fs.delete(this.payloadFile(packageKey));
      } catch {
        // never stored, or already gone
      }
    }
  }

  async listResourcePayloadsByPackageKeys(
    packageKeys: string[]
  ): Promise<ResourcePayload[]> {
    if (packageKeys.length === 0) return [];
    const perPackage = await Promise.all(
      packageKeys.map((packageKey) =>
        this.readJson<ResourcePayload[]>(this.payloadFile(packageKey), [])
      )
    );
    return perPackage.flat();
  }

  async clearAll(): Promise<void> {
    try {
      await vscode.workspace.fs.delete(this.root, { recursive: true });
    } catch {
      // nothing written yet
    }
    this.ready = undefined;
  }
}
