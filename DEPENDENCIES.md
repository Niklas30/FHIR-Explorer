# Dependency maintenance

Runtime and build dependencies were refreshed on 2026-11-18. Dependabot checks
npm packages and GitHub Actions weekly, grouping compatible npm updates.

- Node.js 22.12 or newer is required; Node types follow the CI runtime (22).
- ESLint remains on 9 because eslint-plugin-react does not support ESLint 10 yet.
- TypeScript remains on 5 because the installed lint toolchain excludes TypeScript 7.
- In the deployment fork, VS Code types stay aligned with the minimum supported
  VS Code API (1.96), rather than silently requiring a newer editor.
- The minimatch override applies only to affected versions (7 through 11.0.0).
  It addresses GHSA-g3hv-75wg-m249 in tooling that still requests minimatch 10;
  older, unaffected minimatch 3 consumers keep their compatible API.

## Remaining upstream advisory

`npm audit --omit=dev` reports no known production vulnerabilities. The complete
audit still reports GHSA-fc5q-39xc-vjpf through build/test/lint tooling using
picomatch. The registry's latest picomatch version is 4.0.7, which is still
included in the advisory's affected range. Update when an upstream fix is
published; do not apply npm audit's suggested downgrades of Next.js/Vite/Vitest.
