import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: "node",
    // Only modules that do not import `vscode` are unit-testable here; the
    // adapters are exercised in the Extension Development Host.
    include: ["tests/**/*.test.ts"],
  },
});
