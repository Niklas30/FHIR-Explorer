# Contributing

Thanks for considering contributing!

## Ways to contribute

- Report bugs and request features via GitHub Issues.
- Improve docs and examples.
- Fix bugs and add tests.
- Propose UX improvements (screenshots/recordings are very helpful).

If you’re unsure where to start, open an issue describing what you want to do.

## Development setup

### Prerequisites

- Node.js **22.12 or newer** (Node 22 LTS recommended)
- npm

### Install

```bash
npm ci
```

### Run locally

```bash
npm run dev
```

Open `http://localhost:3000`.

## Shared web and extension development

The public `main` branch is the source of truth. Start feature branches here
and open pull requests here. Deployment forks should consume upstream changes
instead of becoming the only home of editor or extension features.

- Put reusable FHIR logic in `packages/core`; use its ports for host I/O.
- Put reusable React forms and controls in `packages/ui`.
- Keep browser integration in `apps/web` and VS Code integration in `apps/vscode`.
- Keep extension strings in the localization bundles, including the five supported languages.

Run `npm run dev` for the web app. To develop the extension, open the repository
root in VS Code and press **F5**. Run `npm run extension:package` to build an
installable VSIX in `apps/vscode`. CI runs the same quality gates and uploads
the VSIX as a build artifact. This does not publish to the Marketplace.

## Quality gates

Before opening a PR, make sure these are green:

- `npm run lint`
- `npm run typecheck`
- `npm test`
- `npm run build`
- `npm run extension:package`

## Logging

Please use the structured logger (`packages/core/src/logger.ts`) instead of `console.*`.

## Commit messages

This repo uses Conventional Commits (e.g. `feat(editor): ...`, `fix(importer): ...`).

## Pull requests

### Scope & design

- Keep PRs focused and small when possible.
- Prefer readable, testable code over clever code.
- For refactors: explain intent and include behavior notes.

### Tests

- Add/adjust tests for non-trivial behavior.
- If behavior changes, include a short note describing the user-visible effect.

### Review readiness

- Update docs if you add new scripts, env vars, or workflows.

## Security issues

Do **not** open public issues for security vulnerabilities.
See `SECURITY.md` for reporting instructions.

## Contact

- General OSS / contributions: oss@fhir-explorer.com

