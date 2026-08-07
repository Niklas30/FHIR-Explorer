import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  GENERATED_DIRECTORIES,
  IG_RESOURCE_DIRECTORIES,
} from "@/workspace/manifests";

/**
 * package.json declares where the extension applies; the code decides where it
 * actually looks. Nothing keeps the two in step, and a mismatch fails quietly:
 * a resource directory missing from the custom-editor selector simply cannot
 * be opened in the form, with no error to explain it.
 */

const manifest = JSON.parse(
  readFileSync(new URL("../package.json", import.meta.url), "utf8")
) as {
  activationEvents: string[];
  contributes: {
    customEditors: { selector: { filenamePattern: string }[] }[];
    menus: { "editor/title": { when: string }[] };
  };
};

describe("package.json contract", () => {
  it("offers the form editor in every directory resources are read from", () => {
    const patterns = manifest.contributes.customEditors[0].selector.map(
      (entry) => entry.filenamePattern
    );

    for (const directory of IG_RESOURCE_DIRECTORIES) {
      expect(patterns).toContain(`**/${directory}/*.json`);
    }
    // Generated output is offered too — opening it shows the "this is
    // generated" notice, which is more use than the command doing nothing.
    for (const directory of new Set(Object.values(GENERATED_DIRECTORIES).flat())) {
      expect(patterns).toContain(`**/${directory}/*.json`);
    }
  });

  it("lists the same directories in the editor title menu", () => {
    const when = manifest.contributes.menus["editor/title"][0].when;
    for (const directory of IG_RESOURCE_DIRECTORIES) {
      expect(when).toContain(directory.split("/")[1]);
    }
  });

  it("activates on every project marker discovery recognises", () => {
    // Missing one means the extension never wakes up in that kind of repo.
    for (const marker of ["sushi-config.yaml", "ig.ini", "package.json"]) {
      expect(manifest.activationEvents).toContain(`workspaceContains:**/${marker}`);
    }
  });
});
