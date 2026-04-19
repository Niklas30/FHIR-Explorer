# FHIR-Explorer

Local-first FHIR R4 project + dataset editor that builds forms from StructureDefinitions, validates resources live, and exports datasets/projects as JSON or ZIP.

This app is designed to run entirely in the browser:

- Imported FHIR packages are cached locally (via the importer store/worker).
- Datasets and dataset resources are stored locally (LocalStorage).
- No backend is required.

## Features

- Import FHIR packages (target + dependencies) and inspect the dependency graph
- Create multiple datasets per project
- Profile-driven forms generated from StructureDefinitions (FHIR R4)
- Live validation (powered by `@medplum/core`)
- Dataset editor with:
  - Resource list + JSON preview
  - Export dataset/resources/searchset
  - Duplicate resources
  - Dataset metadata dialog (name + project key)
- Project/Dataset overview:
  - Export / delete / duplicate datasets
  - Edit dataset metadata from the context menu (same dialog as the editor)
  - Dependency tree view

## Getting Started

### Prerequisites

- Node.js + npm

### Install & Run

```bash
npm install
npm run dev
```

Then open `http://localhost:3000`.

## Project Structure (High Level)

- `app/` – Next.js App Router pages (overview, importer, dataset editor routes)
- `components/` – UI and editor components
- `lib/` – importer, dependency graph, profile/field building, validation, dataset storage helpers
- `tests/` – unit tests (FHIR importer/validation/profile logic)

## Scripts

- `npm run dev` – start dev server (Next.js)
- `npm run build` – production build
- `npm run start` – run production server
- `npm run lint` – eslint
- `npm test` – unit tests (Vitest)
- `npm run test:watch` – watch mode

## Testing

Run the full unit test suite:

```bash
npm test
```

Run tests in watch mode:

```bash
npm run test:watch
```

Current FHIR unit tests live in `tests/` and cover:

- Profile/field construction and cardinality behavior
- ValueSet/CodeSystem dependency resolution
- Local reference parsing and broken-reference detection
- Validation behavior (required fields, cardinality, references)
- Simulated UI action flows (add/remove fields, add/remove array items, group edits)

### Fixture lifecycle

- Required FHIR fixture files are prepared automatically at test start in a temporary directory.
- Source fixture data is committed under `tests/fixtures/fhir-packages/` and copied into that directory.
- Temporary fixture files are deleted automatically after the test run.

## Data & Privacy

This app stores imported packages, cached resources, and datasets locally in your browser storage.
Use the in-app settings to clear local data if needed.

## Contributing (Future Open Source)

This repository is being prepared for open-source release. Until then:

- Keep changes small and focused.
- Prefer adding/adjusting tests for non-trivial behavior.
- Ensure `npm test` and `npx tsc -p tsconfig.json --noEmit` are green.

Once the project is public, we’ll add contribution guidelines, a code of conduct, and a license file.

## Legal

FHIR® is a registered trademark of HL7. This project is not affiliated with or endorsed by HL7.
