import { createRequire } from "node:module";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Module from "node:module";
import { build } from "esbuild";
import { afterAll, describe, expect, it } from "vitest";
import { createBuildOptions } from "../build.mjs";
import { createVscodeStub } from "./helpers/vscode-stub";

/**
 * Loads the real esbuild output and activates it.
 *
 * Unit tests import source modules, which never exercises bundling. This test
 * exists because a dependency shipping a UMD entry point produced a bundle
 * that type-checked, built and then threw `Cannot find module './impl/format'`
 * the moment the extension host loaded it — a failure only reachable here.
 */

const outDir = mkdtempSync(join(tmpdir(), "fhir-explorer-bundle-"));

afterAll(() => rmSync(outDir, { recursive: true, force: true }));

describe("extension bundle", () => {
  it("loads under a plain node require and activates", async () => {
    const outfile = join(outDir, "extension.js");

    // The very options `npm run build` uses, so this cannot pass while the
    // shipped bundle is broken.
    await build(createBuildOptions({ outfile }));

    const stub = createVscodeStub();
    const loader = Module as unknown as {
      _load: (request: string, parent: unknown, isMain: boolean) => unknown;
    };
    const original = loader._load;
    loader._load = function (request, parent, isMain) {
      if (request === "vscode") return stub;
      return original.call(this, request, parent, isMain);
    };

    try {
      const requireBundle = createRequire(import.meta.url);
      const extension = requireBundle(outfile) as {
        activate: (context: unknown) => void;
        deactivate: () => void;
      };

      expect(typeof extension.activate).toBe("function");
      expect(typeof extension.deactivate).toBe("function");

      const subscriptions: unknown[] = [];
      extension.activate({ subscriptions, globalStorageUri: { path: outDir } });

      // Every command the manifest declares has to actually be registered.
      // A declared-but-unregistered command still appears in the palette and
      // then fails when invoked, which no type check can catch.
      const manifest = JSON.parse(
        readFileSync(new URL("../package.json", import.meta.url), "utf8")
      ) as { contributes: { commands: { command: string }[] } };
      const declared = manifest.contributes.commands.map((entry) => entry.command);

      expect(declared.length).toBeGreaterThan(0);
      expect([...stub.registeredCommands].sort()).toEqual([...declared].sort());
      expect(subscriptions.length).toBeGreaterThan(0);

      extension.deactivate();
    } finally {
      loader._load = original;
    }
  }, 30_000);
});
