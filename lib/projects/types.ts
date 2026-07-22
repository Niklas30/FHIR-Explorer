import type { PackageKey, PackageManifest } from "@/lib/fhir-importer/types";

/**
 * The kind of building block an authored resource represents within a project.
 * These map onto FHIR conformance resources plus plain example instances.
 */
export type AuthoredResourceKind =
  | "profile"
  | "extension"
  | "valueset"
  | "codesystem"
  | "example";

/**
 * A single authored building block of a project (a conformance resource or an
 * example instance). Mirrors {@link import("@/lib/datasets/content").DatasetResource}
 * but adds the {@link AuthoredResourceKind} so the explorer can group entries.
 */
export type AuthoredResource = {
  id: string;
  kind: AuthoredResourceKind;
  resourceType: string;
  /** Canonical profile url the instance conforms to (for examples). */
  profile?: string;
  title?: string;
  content: Record<string, unknown>;
  createdAt: number;
  updatedAt: number;
  lastSelectedAt?: number;
};

/**
 * An editable project the user authors from scratch. Distinct from the
 * read-only {@link import("@/lib/fhir-importer/types").PackageRecord}s that the
 * importer stores. The record itself lives in localStorage; the authored
 * resources live in IndexedDB (see `lib/projects/content.ts`).
 */
export type AuthoredProjectRecord = {
  key: PackageKey;
  id: string;
  version: string;
  manifest: PackageManifest;
  createdAt: number;
  updatedAt: number;
};
