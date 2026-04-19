import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import sonarjs from "eslint-plugin-sonarjs";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  {
    plugins: {
      sonarjs,
    },
    rules: {
      // Complexity + size gates (keep codebase maintainable; refactor hotspots to comply).
      complexity: ["error", 35],
      "max-lines": ["error", { max: 900, skipBlankLines: true, skipComments: true }],
      "max-lines-per-function": ["error", { max: 400, skipBlankLines: true, skipComments: true }],
      "max-depth": ["error", 5],
      "max-params": ["error", 6],

      "sonarjs/cognitive-complexity": ["error", 60],

      "react-hooks/purity": "off",
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/preserve-manual-memoization": "off",
      "react-compiler/react-compiler": "off",
    },
  },
  {
    files: ["tests/**/*.{ts,tsx}"],
    rules: {
      "max-lines-per-function": "off",
    },
  },
]);

export default eslintConfig;
