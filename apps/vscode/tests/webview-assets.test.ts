import { mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "vite";
import { afterAll, describe, expect, it } from "vitest";
import { WEBVIEW_ENTRIES, WEBVIEW_STYLESHEET } from "@/webview/assets";

/**
 * The HTML shell links the webview bundle by file name, and nothing else
 * checks that those names are the ones the build actually emits. Getting it
 * wrong renders the panel unstyled or blank with no error anywhere — this test
 * exists because adding a second entry did exactly that: the shared stylesheet
 * stopped being called `main.css`.
 */

const configFile = fileURLToPath(new URL("../vite.config.ts", import.meta.url));
const outDir = mkdtempSync(join(tmpdir(), "fhir-explorer-webview-"));

afterAll(() => rmSync(outDir, { recursive: true, force: true }));

describe("webview bundle", () => {
  it("emits exactly the files the html shell references", async () => {
    await build({
      configFile,
      logLevel: "silent",
      build: { outDir, emptyOutDir: true },
    });

    const emitted = readdirSync(outDir);

    expect(emitted).toContain(WEBVIEW_STYLESHEET);
    for (const entry of WEBVIEW_ENTRIES) {
      expect(emitted).toContain(`${entry}.js`);
    }

    // Tailwind reaches @fhir-explorer/ui through a node_modules symlink, which
    // its source detection skips by default. Without an explicit @source none
    // of the shared components' classes are generated: the build stays green
    // and the dependency graph renders as black boxes on black. These classes
    // appear only in packages/ui, so they are the canary.
    const css = readFileSync(join(outDir, WEBVIEW_STYLESHEET), "utf8");
    for (const utility of [".fill-background", ".fill-foreground", ".stroke-primary"]) {
      expect(css, `${utility} missing — packages/ui is not being scanned`).toContain(
        utility
      );
    }
  }, 120_000);
});
