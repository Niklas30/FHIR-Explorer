# FHIR Explorer for VS Code

Author FHIR profiles, value sets and example instances in the editor you
already work in.

> **Preview.** This is an early build. It has not yet been through a full
> manual pass in a real workspace — please report anything that misbehaves.

## The workspace is the database

A project is a folder with a FHIR `package.json`; every resource is a `.json`
file below `input/` in the IG Publisher layout:

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

## What it does

- **Problems** — profile-driven validation of every resource in the workspace:
  cardinalities, required elements, fixed and pattern values, bindings,
  primitive formats, unknown elements and broken local references.
- **Hover** on a canonical url resolves it to the profile, value set or code
  system it names, and says which package it came from.
- **Go to definition** from a canonical or a `ResourceType/id` reference to the
  file that defines it.
- **Completion** for the codes of the bound value set inside `code` fields.
- **Form editor** — *Open in FHIR Form Editor* renders the profile as a form in
  an editor tab. The file stays the source of truth: undo, dirty state and
  *Reopen with… Text Editor* behave normally, and writes are minimal edits, so
  untouched lines stay byte-identical.
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
  entries first, each with an install action. *Show Dependency Graph* opens the
  same closure as a diagram whose missing nodes are clickable.

## Getting started

1. Open a folder.
2. **FHIR Explorer: Add Dependency** — start with `hl7.fhir.r4.core`. Without it
   there is no `StructureDefinition` to validate against. Anything it depends on
   comes along automatically.
3. **FHIR Explorer: Create FHIR Project**, then add resources from the tree in
   the activity bar.

## Settings

| Setting | Purpose |
| --- | --- |
| `fhirExplorer.registry.baseUrl` | Registry serving package metadata. Must publish each version's `dependencies`. |
| `fhirExplorer.registry.searchUrl` | Registry serving `/catalog?op=find`. Optional — without it you type package ids. |
| `fhirExplorer.packageCache.useFhirHome` | Share downloads through `~/.fhir/packages`. |
| `fhirExplorer.terminologyServer.url` | Optional `$expand` server for value sets the imported packages cannot expand. |

## Privacy

Everything runs locally. The only outbound requests are package downloads from
the configured registry and, if you set one, value set expansions from your
terminology server.

Licensed under Apache-2.0.
