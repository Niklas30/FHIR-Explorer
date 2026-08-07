import { build, context } from "esbuild";

const production = process.argv.includes("--production");
const watch = process.argv.includes("--watch");

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
        console.error(`  ${location?.file}:${location?.line}:${location?.column}: error: ${text}`);
      }
      console.log("[watch] build finished");
    });
  },
};

/** @type {import("esbuild").BuildOptions} */
const options = {
  entryPoints: ["src/extension.ts"],
  bundle: true,
  outfile: "dist/extension.js",
  // The extension host loads CommonJS and provides `vscode` itself.
  format: "cjs",
  platform: "node",
  target: "node20",
  external: ["vscode"],
  sourcemap: !production,
  minify: production,
  logLevel: "info",
  plugins: watch ? [watchMarkers] : [],
};

if (watch) {
  const ctx = await context(options);
  await ctx.watch();
} else {
  await build(options);
}
