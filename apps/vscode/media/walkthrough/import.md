## Bring in the definitions you build on

FHIR Explorer validates and renders your resources against real
`StructureDefinition`s. Without at least one package there is nothing to
validate against, so this is the first step.

**Add Dependency** searches the package registry, lists the published versions,
and works out the whole dependency tree *before* downloading anything — you
confirm one plan instead of chasing missing packages one at a time.

Start with `hl7.fhir.r4.core`. Anything it needs comes along automatically.

Everything imported shows up under **Imported Packages** in the activity bar,
where you can search its profiles and open any of them read-only.
