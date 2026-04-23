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

- Node.js **20 LTS**
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

## Quality gates

Before opening a PR, make sure these are green:

- `npm run lint`
- `npm test`
- `npm run build`

## Logging

Please use the structured logger (`lib/logger.ts`) instead of `console.*`.

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

- General OSS / contributions: oss@health-compose.com

