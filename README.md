# FHIR-Explorer

Local‑first HL7 FHIR® R4 **package importer**, **project/dataset manager**, and **resource editor**.
FHIR-Explorer runs entirely in the browser: no backend required.

> Status: work in progress (internal tooling). APIs and UX may change.

## What it does

- **Import HL7 FHIR® packages** (target + transitive dependencies) and visualize the dependency graph.
- **Create projects and datasets** and manage them from an overview.
- **Edit resources** with profile‑driven forms generated from `StructureDefinition`.
- **Validate resources live** (cardinality, required fields, bindings, references).
- **Export** datasets/projects as JSON or ZIP.

## Key concepts

- **Project**: A chosen “target package” plus its dependency closure.
- **Dataset**: A collection of FHIR® resources belonging to a project.
- **Registry**: In‑memory index of `StructureDefinition`, `ValueSet`, `CodeSystem` used for rendering and validation.

## Data model & privacy

This application is designed for **local-first** usage:

- Imported packages, cached resources, and datasets are stored **locally in your browser**.
- There is **no server component** in the default setup.
- Use the in‑app settings to clear local data when needed.

If you work with sensitive data, treat your browser storage like any other local persistence layer.

### Outbound requests

Nothing you import is sent to a server of ours — there is none. Package
archives are fetched by **your browser, directly from the package registry**,
so the only parties that see which packages you are interested in are the
registries themselves:

| Host | What it is asked for |
| --- | --- |
| `packages2.fhir.org` | Package metadata, and download links for versions it carries. |
| `packages.simplifier.net` | Metadata, and the package archives themselves — it is the registry whose archives a browser is allowed to read. |

Metadata is requested for any package id you type or that a dependency names.
Archives are only fetched when you import one.

A terminology server is contacted **only** if you configure one in the
settings, and only to `$expand` a value set that the imported packages cannot
expand on their own.

## Tech stack

- Next.js (App Router), React, TypeScript
- Tailwind CSS + Radix UI
- `@medplum/core` for parts of FHIR® handling/validation
- Mermaid for dependency graph visualization
- IndexedDB / LocalStorage (local persistence)

## Repository layout

This is an npm workspace:

| Path | Package | Contents |
| --- | --- | --- |
| `packages/core` | `@fhir-explorer/core` | Framework-agnostic domain logic: FHIR schema/snapshot handling, validation, the package importer, project and dataset models. No React, no framework. |
| `apps/web` | `@fhir-explorer/web` | The Next.js application: UI components, routing, styling. |
| `packages/ui` | `@fhir-explorer/ui` | Shared React components, above all the profile-driven form generated from a `StructureDefinition`. |
| `apps/vscode` | `fhir-explorer` | The VS Code extension: extension host plus the form webview. |

`core` reaches its host environment only through the types in
`packages/core/src/ports` — HTTP, package persistence, resource persistence and
archive parsing. `packages/core/src/adapters/browser` implements those against
IndexedDB, localStorage, `fetch` and Web Workers; `apps/vscode/src/adapters`
implements the same ports against the workspace file system and the extension
host. The domain logic itself is shared verbatim.

Inside `core`, modules import each other by package name
(`@fhir-explorer/core/fhir-editor/schema`) so a single alias resolves in every
bundler. `apps/web` keeps `@/*` for its own files.

## Getting started

### Prerequisites

- Node.js (recommended: **Node 20 LTS**)
- npm

### Install

```bash
npm install
```

### Run (dev)

```bash
npm run dev
```

Then open `http://localhost:3000`.

Tip: There are alternate scripts using Turbo mode:

```bash
npm run dev:turbo
```

## VS Code extension

The extension in `apps/vscode` treats the **workspace as the database**: a
project is a folder with a FHIR `package.json`, and every resource is a `.json`
file below `input/` in the IG Publisher layout. Nothing is hidden in an
extension-private store, so git, the file explorer, the IG Publisher and Sushi
all keep working on the same files.

Run it from the repository root:

1. `npm install`
2. Press <kbd>F5</kbd> (*Run FHIR Explorer Extension*) — the watch build starts
   and an Extension Development Host opens.
3. Open a folder in the new window and run **FHIR Explorer: Create FHIR Project**.

Dependencies are resolved the way a package manager should: *Add Dependency*
searches the registry, then walks the whole dependency tree from registry
metadata before downloading a single byte, so the user confirms one plan instead
of discovering missing packages one at a time. The browser build cannot do this
— CORS stops it downloading at all. Packages are shared through
`~/.fhir/packages`, so the IG Publisher and Sushi reuse the same files.

Because the resources are ordinary JSON files, the editor features work on them
without opening anything FHIR-specific:

- **Problems** — the same profile-driven validation the web app runs behind its
  form, reported per file and line across the whole workspace.
- **Hover** on a canonical url resolves it to the profile, value set or code
  system it names, and says which package it came from.
- **Go to definition** jumps from a canonical or a `ResourceType/id` reference
  to the file that defines it.
- **Completion** offers the codes of the bound value set inside `code` fields.

**Form editor.** *Open in FHIR Form Editor* shows the same profile-driven form
the web app has, as an editor tab over the file. The text document stays the
single source of truth, so undo, dirty state, hot exit, *Reopen with… Text
Editor* and a live text editor in a split pane all behave normally. Writes go
back as minimal edits, leaving every untouched line byte-identical.

`packages/ui` is shared verbatim between the two apps; the hosts differ only in
the two contexts they fill in — the locale and the optional terminology server.

## Docker

### Production (container)

Build and run the production image:

```bash
docker build -t fhir-explorer-editor .
docker run --rm -p 3000:3000 fhir-explorer-editor
```

Then open `http://localhost:3000`.

### Docker Compose

Production:

```bash
docker compose up --build
```

Development (hot reload, bind mount):

```bash
docker compose --profile dev up --build dev
```

## Scripts

Run from the repository root; they fan out over the workspaces.

- `npm run dev` – start dev server (Webpack)
- `npm run build` – production build of every workspace
- `npm run start` – run production server
- `npm run lint` – ESLint over the whole repository
- `npm run typecheck` – `tsc --noEmit` per workspace
- `npm test` – unit tests (Vitest)

Turbo-mode variants live on the web app: `npm run dev:turbo -w @fhir-explorer/web`.

## Testing

Run the full unit test suite:

```bash
npm test
```

Run tests in watch mode:

```bash
npm run test:watch
```

### Test fixtures

Unit tests use committed fixtures under `tests/fixtures/fhir-packages/`.
At test start, fixtures are copied into a temporary directory and exposed via `FHIR_TEST_FIXTURE_ROOT`.

## Project structure

- `app/` – Next.js routes (overview, importer, editor)
- `components/` – UI components (dialogs, editors, layout)
- `lib/` – importer logic, dependency graph, profile/field building, validation, persistence
- `tests/` – unit tests and fixture setup

## Contributing

This repository is being prepared for a broader release.
If you contribute internally:

- Keep changes focused and well-scoped.
- Add/adjust tests for non-trivial behavior.
- Ensure `npm test` and `npm run lint` are green.

## Legal

FHIR® is a registered trademark of Health Level Seven International (HL7).
Use of this trademark does not constitute endorsement by HL7.
This project is not affiliated with or endorsed by HL7.
