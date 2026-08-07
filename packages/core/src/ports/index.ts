/**
 * The seams between the domain logic and its host environment.
 *
 * Everything the core needs from the outside world is declared here as a
 * type. `adapters/browser` implements them against IndexedDB, localStorage,
 * `fetch` and Web Workers; the VS Code extension will implement them against
 * the workspace file system and the extension host.
 */
export type { HttpClient } from "@fhir-explorer/core/ports/http-client";
export type { PackageParser } from "@fhir-explorer/core/ports/package-parser";
export type { PackageStore } from "@fhir-explorer/core/ports/package-store";
export type { ResourceStore } from "@fhir-explorer/core/ports/resource-store";
