import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

/**
 * Bundle for the webview that hosts the profile-driven form.
 *
 * The HTML is written by the extension (it has to carry a CSP nonce), so this
 * emits a plain JS + CSS pair with stable names rather than an entry HTML.
 * Nothing may be loaded from a remote host at runtime — the CSP forbids it —
 * so everything, including CSS, is inlined into these two files.
 */
export default defineConfig({
  plugins: [react(), tailwindcss()],
  root: fileURLToPath(new URL("./webview", import.meta.url)),
  resolve: {
    alias: {
      "@fhir-explorer/ui": fileURLToPath(new URL("../../packages/ui/src", import.meta.url)),
      "@fhir-explorer/core": fileURLToPath(new URL("../../packages/core/src", import.meta.url)),
      "@webview": fileURLToPath(new URL("./webview/src", import.meta.url)),
    },
  },
  build: {
    outDir: fileURLToPath(new URL("./dist/webview", import.meta.url)),
    emptyOutDir: true,
    sourcemap: false,
    rollupOptions: {
      // One entry per webview surface. They share the theme and the React
      // runtime through the common chunks rollup extracts.
      input: {
        main: fileURLToPath(new URL("./webview/src/main.tsx", import.meta.url)),
        graph: fileURLToPath(new URL("./webview/src/graph.tsx", import.meta.url)),
        "project-form": fileURLToPath(
          new URL("./webview/src/project-form.tsx", import.meta.url)
        ),
      },
      output: {
        entryFileNames: "[name].js",
        chunkFileNames: "[name].js",
        // Deterministic, because the HTML shell links it by name. Both
        // entries share one stylesheet; WEBVIEW_STYLESHEET must match.
        assetFileNames: "styles.[ext]",
      },
    },
  },
});
