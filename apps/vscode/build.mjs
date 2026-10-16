import { pathToFileURL } from "node:url";
import { build, context } from "esbuild";

/**
 * Markers the `extension: watch` task in .vscode/tasks.json waits for, so F5
 * launches only once a build has actually finished.
 */
const watchMarkers = {
  name: "watch-markers",
  setup(builder) {
    builder.onStart(() => console.log("[watch] build started"));
    builder.onEnd((result) => {
      for (const { text, location } of result.errors) {
        console.error(
          `  ${location?.file}:${location?.line}:${location?.column}: error: ${text}`
        );
      }
      console.log("[watch] build finished");
    });
  },
};

/**
 * The single definition of how the extension is bundled. Exported so the
 * bundle test builds with exactly these settings instead of a copy that can
 * drift away from what actually ships.
 *
 * @param {{ production?: boolean, watch?: boolean, outfile?: string }} [options]
 * @returns {import("esbuild").BuildOptions}
 */
export const createBuildOptions = ({ production = false, watch = false, outfile } = {}) => ({
  entryPoints: [new URL("src/extension.ts", import.meta.url).pathname],
  bundle: true,
  outfile: outfile ?? new URL("dist/extension.js", import.meta.url).pathname,
  // The extension host loads CommonJS and provides `vscode` itself.
  format: "cjs",
  platform: "node",
  target: "node20",
  external: ["vscode"],
  // Prefer the ESM entry of dependencies. Some ship a UMD `main` whose
  // internal `require()` calls esbuild cannot follow, which then fails at
  // runtime inside the extension host rather than at build time.
  mainFields: ["module", "main"],
  sourcemap: !production,
  minify: production,
  logLevel: watch || production ? "info" : "silent",
  plugins: watch ? [watchMarkers] : [],
});

const invokedDirectly =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (invokedDirectly) {
  const production = process.argv.includes("--production");
  const watch = process.argv.includes("--watch");
  const options = createBuildOptions({ production, watch });

  if (watch) {
    const ctx = await context(options);
    await ctx.watch();
  } else {
    await build(options);
  }
}
