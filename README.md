# FHIR Explorer

Local‑first FHIR R4 **package importer**, **project/dataset manager**, and **resource editor**.
FHIR Explorer runs entirely in the browser: no backend required.

> Status: work in progress (internal tooling). APIs and UX may change.

## What it does

- **Import FHIR packages** (target + transitive dependencies) and visualize the dependency graph.
- **Create projects and datasets** and manage them from an overview.
- **Edit resources** with profile‑driven forms generated from `StructureDefinition`.
- **Validate resources live** (cardinality, required fields, bindings, references).
- **Export** datasets/projects as JSON or ZIP.

## Key concepts

- **Project**: A chosen “target package” plus its dependency closure.
- **Dataset**: A collection of FHIR resources belonging to a project.
- **Registry**: In‑memory index of `StructureDefinition`, `ValueSet`, `CodeSystem` used for rendering and validation.

## Data model & privacy

This application is designed for **local-first** usage:

- Imported packages, cached resources, and datasets are stored **locally in your browser**.
- There is **no server component** in the default setup.
- Use the in‑app settings to clear local data when needed.

If you work with sensitive data, treat your browser storage like any other local persistence layer.

## Tech stack

- Next.js (App Router), React, TypeScript
- Tailwind CSS + Radix UI
- `@medplum/core` for parts of FHIR handling/validation
- Mermaid for dependency graph visualization
- IndexedDB / LocalStorage (local persistence)

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

## Docker

### Production (container)

Build and run the production image:

```bash
docker build -t fhir-explorer .
docker run --rm -p 3000:3000 fhir-explorer
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

- `npm run dev` – start dev server (Webpack)
- `npm run dev:turbo` – start dev server (Turbo)
- `npm run build` – production build (Webpack)
- `npm run build:turbo` – production build (Turbo)
- `npm run start` – run production server
- `npm run lint` – ESLint
- `npm test` – unit tests (Vitest)

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

FHIR® is a registered trademark of HL7. This project is not affiliated with or endorsed by HL7.
