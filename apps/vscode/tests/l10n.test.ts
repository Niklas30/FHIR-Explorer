import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * A string missing from a bundle does not fail anywhere — VS Code quietly
 * shows the English source instead. These checks are the only place a
 * forgotten translation or a stale bundle shows up.
 */

const root = fileURLToPath(new URL("..", import.meta.url));
const LOCALES = ["de", "fr", "es", "it"];

const readJson = (path: string) =>
  JSON.parse(readFileSync(join(root, path), "utf8")) as Record<string, unknown>;

const sourceFiles = (directory: string): string[] =>
  readdirSync(directory).flatMap((entry) => {
    const path = join(directory, entry);
    return statSync(path).isDirectory() ? sourceFiles(path) : path.endsWith(".ts") ? [path] : [];
  });

/** The value of a "…" or '…' literal. */
const literal = (code: string): string =>
  code.startsWith("'")
    ? (JSON.parse(`"${code.slice(1, -1).replace(/\\'/g, "'").replace(/"/g, '\\"')}"`) as string)
    : (JSON.parse(code) as string);

const placeholders = (text: string) => [...text.matchAll(/\{\d+\}/g)].map(String).sort();

describe("runtime strings (vscode.l10n)", () => {
  const calls = sourceFiles(join(root, "src")).flatMap((file) => {
    const text = readFileSync(file, "utf8");
    // A string literal as a whole, or else whatever was passed instead.
    return [...text.matchAll(/l10n\.t\(\s*("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|[^\s,)]+)/g)].map((match) => ({
      file,
      argument: match[1],
    }));
  });
  const source = readJson("l10n/bundle.l10n.json");

  it("passes l10n.t a string literal, so the strings can be extracted", () => {
    for (const { file, argument } of calls) {
      expect(argument, file).toMatch(/^(?:"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')$/);
    }
  });

  it("keeps the source bundle in step with the code", () => {
    // Regenerate with `npx @vscode/l10n-dev export -o l10n src`.
    const used = new Set(calls.map(({ argument }) => literal(argument)));
    expect([...used].sort()).toEqual(Object.keys(source).sort());
  });

  it.each(LOCALES)("translates every string into %s, with the same placeholders", (locale) => {
    const bundle = readJson(`l10n/bundle.l10n.${locale}.json`);
    expect(Object.keys(bundle).sort()).toEqual(Object.keys(source).sort());
    for (const [key, value] of Object.entries(bundle)) {
      expect(typeof value, key).toBe("string");
      expect(placeholders(value as string), key).toEqual(placeholders(key));
    }
  });
});

describe("manifest strings (package.nls)", () => {
  const manifest = readFileSync(join(root, "package.json"), "utf8");
  const english = readJson("package.nls.json");

  it("defines every %key% the manifest uses", () => {
    const used = new Set([...manifest.matchAll(/"%([\w.]+)%"/g)].map((match) => match[1]));
    expect([...used].sort()).toEqual(Object.keys(english).sort());
  });

  it.each(LOCALES)("translates every manifest string into %s", (locale) => {
    const translated = readJson(`package.nls.${locale}.json`);
    expect(Object.keys(translated).sort()).toEqual(Object.keys(english).sort());
    for (const [key, value] of Object.entries(translated)) {
      // Command links in welcome views and walkthroughs must survive translation.
      const commands = (text: string) => [...text.matchAll(/\(command:[\w.]+\)/g)].map(String);
      expect(commands(value as string), key).toEqual(commands(english[key] as string));
    }
  });
});
