import { mkdtempSync, readdirSync, rmSync } from "node:fs";
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
  }, 120_000);
});
