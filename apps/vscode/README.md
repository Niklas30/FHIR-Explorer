# FHIR Explorer for VS Code

Author FHIR profiles, value sets and example instances in the editor you
already work in.

> **Preview.** This is an early build. It has not yet been through a full
> manual pass in a real workspace — please report anything that misbehaves.

## The workspace is the database

A project is any folder the FHIR toolchain already recognises as one:

| Marker | Repo type |
| --- | --- |
| `sushi-config.yaml` | Sushi / FSH |
| `ig.ini` | classic IG Publisher |
| `package.json` with FHIR fields | package-style, and what *Create FHIR Project* writes |

Resources are read from every directory the IG Publisher scans
(`input/profiles`, `input/extensions`, `input/vocabulary`, `input/examples`,
`input/resources`, …). In a Sushi repo, `fsh-generated/` is validated as well
but never offered for editing — the next build overwrites it, so the form
editor sends you to the `.fsh` source instead.

*Create FHIR Project* scaffolds this layout:

```
my.project/
├─ package.json          name, version, canonical, dependencies
└─ input/
   ├─ profiles/          StructureDefinition
   ├─ extensions/        StructureDefinition (Extension)
   ├─ vocabulary/        ValueSet, CodeSystem
   └─ examples/          instances
```

Nothing is hidden in an extension-private store, so git, the file explorer,
search, the IG Publisher and Sushi all keep working on the same files.

A dependency you add is recorded in whichever manifest your project actually
uses — `sushi-config.yaml`, the ImplementationGuide's `dependsOn`, or
`package.json` — so your existing toolchain sees it too.

## What it does

- **Problems** — profile-driven validation of every resource in the workspace:
  cardinalities, required elements, fixed and pattern values, bindings,
  primitive formats, unknown elements, broken local references and the
  profile's FHIRPath invariants. On top, the project as a whole is checked
  the way the web editor does it: a base definition or bound value set that
  does not resolve, a canonical outside the project's base, two files
  claiming one url, a project without `hl7.fhir.r4.core`.
- **Hover** on a canonical url resolves it to the profile, value set or code
  system it names, and says which package it came from.
- **Go to definition** from a canonical or a `ResourceType/id` reference to the
  file that defines it.
- **Completion** for the codes of the bound value set inside `code` fields.
- **Form editor** — *Open in FHIR Form Editor* renders the profile as a form in
  an editor tab. The file stays the source of truth: undo, dirty state and
  *Reopen with… Text Editor* behave normally, and writes are minimal edits, so
  untouched lines stay byte-identical.
- **Profile constraints** — a profile opens on its constraints: every element
  of the base definition with its cardinality, must-support and value set
  binding, edited in place and written to the differential. The same editor
  the web app uses; the form for the profile's metadata is one tab over.
- **Dependencies, resolved for you** — *Add Dependency* searches the registry,
  lists the published versions and works out the whole dependency tree from
  registry metadata *before* downloading anything. You confirm one plan; version
  conflicts are surfaced with a choice instead of failing later. The direct
  dependency is written to your `package.json`, so *Install Dependencies*
  reproduces the whole set on a fresh clone.
- **Shared package cache** — downloads are read from and written to
  `~/.fhir/packages`, so the IG Publisher, Sushi and this extension reuse each
  other's work.
- **Dependency view** — the closure as a tree in the activity bar, unmet
  entries first, each with an install action; update and remove on the ones
  your project declares itself. *Show Dependency Graph* opens the same closure
  as a diagram whose missing nodes are clickable.
- **Imported Packages view** — everything you have imported, independent of any
  project, expandable into its profiles, value sets and code systems. Opening
  one shows it read-only; go to definition reaches them too, so a canonical
  from a dependency is no longer a dead end. *Create Project Using This
  Package* turns an import into a project that depends on it, and *Clone as
  Editable Project* forks its resources into one you own.
- **Create FHIR Project** is a form, not a chain of prompts: id, version,
  canonical and the dependencies to start with, all visible at once, installed
  as soon as you confirm.
- **Project Settings** opens the same form on an existing project. Version,
  title, description, canonical, FHIR version and dependencies are written back
  in place — your manifest keeps its formatting and comments, whether it is a
  `package.json`, a `sushi-config.yaml` or an ImplementationGuide.

## Getting started

Run **Help ▸ Get Started ▸ Get started with FHIR Explorer** for a guided pass,
or do it by hand:

1. Open a folder.
2. **FHIR Explorer: Add Dependency** — start with `hl7.fhir.r4.core`. Without it
   there is no `StructureDefinition` to validate against. Anything it depends on
   comes along automatically.
3. **FHIR Explorer: Create FHIR Project**, then add resources from the tree in
   the activity bar. Creating an example instance starts by picking the profile
   it conforms to — your own profiles first, then the ones your dependencies
   bring, then the base FHIR resources.

## Languages

The extension follows VS Code's display language: English, German, French,
Spanish and Italian. That covers commands, views, messages, the Problems
panel and the form editor. The walkthrough pages are English only for now.
Strings live in `l10n/bundle.l10n.*.json` and `package.nls.*.json`. After
adding a `vscode.l10n.t` call, regenerate the source bundle with
`npx @vscode/l10n-dev export -o l10n src` and translate the new keys. A test
fails until every bundle has them.

## Settings

| Setting | Purpose |
| --- | --- |
| `fhirExplorer.registry.sources` | Registries searched for packages, in order. Defaults to `packages2.fhir.org` then `packages.simplifier.net`. |
| `fhirExplorer.packageCache.useFhirHome` | Share downloads through `~/.fhir/packages`. |
| `fhirExplorer.terminologyServer.url` | Optional `$expand` server for value sets the imported packages cannot expand. |

## Privacy

Everything runs locally. The only outbound requests are package downloads from
the configured registry and, if you set one, value set expansions from your
terminology server.

Licensed under Apache-2.0.
