import { createRequire } from "node:module";
import Module from "node:module";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type * as vscode from "vscode";
import type { GlobalPackageStore } from "@/adapters/global-package-store";
import type { deletePackageCommand } from "@/commands/delete-package";
import type { PackageRecord } from "@fhir-explorer/core/fhir-importer/types";
import { createBuildOptions } from "../build.mjs";
import { createVscodeStub } from "./helpers/vscode-stub";

const outDir = mkdtempSync(join(tmpdir(), "fhir-delete-package-"));
const stub = createVscodeStub();
const files = new Map<string, Uint8Array>();
const warning = vi.fn(), info = vi.fn(), error = vi.fn(), pick = vi.fn();
let command: typeof deletePackageCommand;
let store: GlobalPackageStore;
const refresh = vi.fn();
const record = (version: string): PackageRecord => ({
  key: `example.ig@${version}`, id: "example.ig", version,
  manifest: { name: "example.ig", version }, addedAt: 0, resourceCount: 1,
});
const selected = record("1.0.0"), other = record("2.0.0");

beforeAll(async () => {
  const outfile = join(outDir, "command.cjs");
  await build({
    ...createBuildOptions({ outfile }), entryPoints: undefined,
    stdin: {
      contents: 'export { deletePackageCommand } from "./src/commands/delete-package"; export { GlobalPackageStore } from "./src/adapters/global-package-store";',
      resolveDir: fileURLToPath(new URL("..", import.meta.url)), loader: "ts",
    },
  });
  Object.assign(stub.Uri, {
    joinPath: (base: { path: string }, ...parts: string[]) => ({ path: join(base.path, ...parts) }),
  });
  Object.assign(stub.workspace.fs, {
    readFile: async (uri: { path: string }) => {
      if (!files.has(uri.path)) throw new Error("not found");
      return files.get(uri.path);
    },
    writeFile: async (uri: { path: string }, data: Uint8Array) => { files.set(uri.path, data); },
    delete: async (uri: { path: string }) => { files.delete(uri.path); },
  });
  Object.assign(stub.window, {
    showWarningMessage: warning, showInformationMessage: info,
    showErrorMessage: error, showQuickPick: pick,
  });
  const loader = Module as unknown as { _load: (request: string, ...args: unknown[]) => unknown };
  const original = loader._load;
  loader._load = function(request, ...args) {
    return request === "vscode" ? stub : original.call(this, request, ...args);
  };
  try {
    const loaded = createRequire(import.meta.url)(outfile) as {
      deletePackageCommand: typeof deletePackageCommand;
      GlobalPackageStore: typeof GlobalPackageStore;
    };
    command = loaded.deletePackageCommand;
    store = new loaded.GlobalPackageStore({ path: "/test" } as vscode.Uri);
  } finally { loader._load = original; }
});
afterAll(() => rmSync(outDir, { recursive: true, force: true }));
beforeEach(async () => {
  files.clear(); vi.clearAllMocks();
  warning.mockResolvedValue("Delete Package"); pick.mockResolvedValue(undefined);
  await store.putPackage(selected); await store.putPackage(other);
  for (const pkg of [selected, other]) {
    await store.putResourceIndex([{ key: pkg.key, packageKey: pkg.key, resourceType: "ValueSet" }]);
    await store.putResourcePayloads([{ key: pkg.key, packageKey: pkg.key, resourceType: "ValueSet", content: { resourceType: "ValueSet" } }]);
  }
  await store.saveState({ versionSelections: {}, currentTarget: { id: selected.id, version: selected.version },
    importHistory: [{ targetKey: selected.key, completedAt: 1 }, { targetKey: other.key, completedAt: 2 }] });
});

describe("delete imported package", () => {
  it("removes only the confirmed version, its index, payload and history, then refreshes", async () => {
    await command(store, refresh, { type: "package", record: selected });
    expect(await store.listPackages()).toEqual([other]);
    expect(await store.getResourceIndexCount()).toBe(1);
    expect(await store.listResourcePayloadsByPackageKeys([selected.key])).toEqual([]);
    expect(await store.listResourcePayloadsByPackageKeys([other.key])).toHaveLength(1);
    expect((await store.loadState()).importHistory?.map(x => x.targetKey)).toEqual([other.key]);
    expect((await store.loadState()).currentTarget).toBeUndefined();
    expect(refresh).toHaveBeenCalledOnce();
    expect(error).not.toHaveBeenCalled();
  });
  it("leaves all data intact when confirmation is cancelled", async () => {
    warning.mockResolvedValue(undefined);
    await command(store, refresh, { type: "package", record: selected });
    expect(await store.listPackages()).toHaveLength(2);
    expect(await store.getResourceIndexCount()).toBe(2);
    expect(refresh).not.toHaveBeenCalled();
  });
  it("offers a package picker from the palette and respects cancellation", async () => {
    await command(store, refresh);
    expect(pick).toHaveBeenCalledOnce();
    expect(warning).not.toHaveBeenCalled();
    pick.mockResolvedValue({ record: other });
    await command(store, refresh);
    expect(await store.listPackages()).toEqual([selected]);
    expect((await store.loadState()).currentTarget?.version).toBe(selected.version);
  });
  it("reports deletion failures without claiming success or refreshing", async () => {
    const fail = vi.spyOn(store, "deletePackage").mockRejectedValueOnce(new Error("read-only"));
    await command(store, refresh, { type: "package", record: selected });
    expect(error).toHaveBeenCalledWith("Could not delete package: read-only");
    expect(refresh).not.toHaveBeenCalled();
    expect(info).not.toHaveBeenCalled();
    fail.mockRestore();
  });
});
