/**
 * Curated entry point of the core package.
 *
 * Host applications (the Next.js web app, the VS Code extension) wire their
 * environment in through the ports re-exported here; everything else is
 * reached through deep imports such as `@fhir-explorer/core/fhir-editor/schema`.
 */
export * from "@fhir-explorer/core/ports";
