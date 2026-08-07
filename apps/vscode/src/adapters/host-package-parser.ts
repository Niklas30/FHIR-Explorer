import { parsePackage } from "@fhir-explorer/core/fhir-importer/parser";
import type { PackageParser } from "@fhir-explorer/core/ports";

/**
 * {@link PackageParser} in the extension host.
 *
 * The web app needs a Web Worker here so a large IG does not freeze the UI.
 * In the extension the host is already off the UI thread, so the parser runs
 * directly and the whole worker plumbing disappears.
 */
export const hostPackageParser: PackageParser = {
  parse: (buffer, onProgress) => parsePackage(buffer, { onProgress }),
};
