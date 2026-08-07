## The editor already knows FHIR

No command needed — these work on any resource file in the project:

- **Problems** lists cardinality violations, missing required elements, invalid
  codes and broken references, per file and line, across the whole workspace.
- **Hover** a canonical url to see what it resolves to and which package it
  came from.
- **Go to definition** jumps to the defining file — including into a
  dependency, opened read-only.
- **Completion** offers the codes of the bound value set inside `code` fields.

**Show Dependency Graph** draws the closure, and a missing package in it is one
click from being installed.
