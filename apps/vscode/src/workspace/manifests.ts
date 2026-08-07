import { parse as parseYaml } from "yaml";
import type { PackageManifest } from "@fhir-explorer/core/fhir-importer/types";

/**
 * Reading the three ways a FHIR project declares itself.
 *
 * The extension used to recognise only a `package.json` carrying FHIR fields —
 * which in practice meant only projects it had created itself. A Sushi repo
 * declares everything in `sushi-config.yaml`, a classic IG Publisher repo in
 * `ig.ini` plus an ImplementationGuide resource. Both are normalised onto the
 * same manifest here, so nothing downstream has to care which it was.
 *
 * Pure on purpose: no `vscode` import, so the parsing rules are unit-testable.
 */

export type ProjectKind = "fhir-package" | "sushi" | "ig-publisher";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value && typeof value === "object" && !Array.isArray(value));

const asString = (value: unknown): string | undefined =>
  typeof value === "string" && value.trim() ? value.trim() : undefined;

/**
 * Sushi and IG resources allow a dependency to be either a bare version string
 * or an object carrying `version`, so both shapes collapse to `id -> version`.
 */
const normalizeDependencies = (value: unknown): Record<string, string> | undefined => {
  if (!isRecord(value)) return undefined;
  const entries: [string, string][] = [];
  for (const [id, requirement] of Object.entries(value)) {
    const version =
      asString(requirement) ??
      (isRecord(requirement) ? asString(requirement.version) : undefined);
    if (version) entries.push([id, version]);
  }
  return entries.length > 0 ? Object.fromEntries(entries) : undefined;
};

/**
 * A `package.json` that is a FHIR manifest rather than an npm one.
 *
 * Requiring one of these fields is what keeps ordinary Node projects out of
 * the tree.
 */
export const parseFhirPackageJson = (text: string): PackageManifest | undefined => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return undefined;
  }
  if (!isRecord(parsed)) return undefined;

  const name = asString(parsed.name);
  const version = asString(parsed.version);
  if (!name || !version) return undefined;

  const looksFhir =
    Array.isArray(parsed.fhirVersions) ||
    typeof parsed.canonical === "string" ||
    (typeof parsed.type === "string" && parsed.type.startsWith("fhir"));
  if (!looksFhir) return undefined;

  return {
    ...(parsed as PackageManifest),
    name,
    version,
    dependencies: normalizeDependencies(parsed.dependencies),
  };
};

/**
 * `sushi-config.yaml`. The id, not the title, is the package name — that is
 * what ends up in the published package and in everyone else's dependencies.
 */
export const parseSushiConfig = (text: string): PackageManifest | undefined => {
  let parsed: unknown;
  try {
    parsed = parseYaml(text) as unknown;
  } catch {
    return undefined;
  }
  if (!isRecord(parsed)) return undefined;

  const name = asString(parsed.id) ?? asString(parsed.packageId) ?? asString(parsed.name);
  const version = asString(parsed.version);
  if (!name || !version) return undefined;

  const fhirVersion = asString(parsed.fhirVersion);
  const fhirVersions = Array.isArray(parsed.fhirVersion)
    ? parsed.fhirVersion.filter((entry): entry is string => typeof entry === "string")
    : fhirVersion
      ? [fhirVersion]
      : undefined;

  return {
    name,
    version,
    title: asString(parsed.title) ?? asString(parsed.name),
    description: asString(parsed.description),
    canonical: asString(parsed.canonical),
    status: asString(parsed.status),
    fhirVersions,
    dependencies: normalizeDependencies(parsed.dependencies),
  } as PackageManifest;
};

/** The `ig` entry of an `ig.ini`, pointing at the ImplementationGuide resource. */
export const parseIgIni = (text: string): { igPath?: string } => {
  for (const line of text.split(/\r?\n/)) {
    const match = /^\s*ig\s*=\s*(.+?)\s*$/i.exec(line);
    if (match) return { igPath: match[1] };
  }
  return {};
};

/**
 * An ImplementationGuide resource. `dependsOn` is the FHIR way of spelling
 * dependencies, keyed by `packageId` with `version` alongside.
 */
export const parseImplementationGuide = (text: string): PackageManifest | undefined => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return undefined;
  }
  if (!isRecord(parsed) || parsed.resourceType !== "ImplementationGuide") return undefined;

  const name = asString(parsed.packageId) ?? asString(parsed.id);
  const version = asString(parsed.version);
  if (!name) return undefined;

  const dependencies: Record<string, string> = {};
  for (const entry of Array.isArray(parsed.dependsOn) ? parsed.dependsOn : []) {
    if (!isRecord(entry)) continue;
    const id = asString(entry.packageId);
    const dependencyVersion = asString(entry.version);
    if (id && dependencyVersion) dependencies[id] = dependencyVersion;
  }

  const fhirVersions = Array.isArray(parsed.fhirVersion)
    ? parsed.fhirVersion.filter((entry): entry is string => typeof entry === "string")
    : undefined;

  return {
    name,
    // An IG without a version is still a project; the key just falls back.
    version: version ?? "0.0.0",
    title: asString(parsed.title) ?? asString(parsed.name),
    description: asString(parsed.description),
    canonical: asString(parsed.url)?.replace(/\/ImplementationGuide\/.*$/, ""),
    fhirVersions,
    dependencies: Object.keys(dependencies).length > 0 ? dependencies : undefined,
  } as PackageManifest;
};

/**
 * Directories the IG Publisher reads resources from.
 *
 * Broader than the four the extension creates: a project that predates it, or
 * one a human organised differently, still has to be validated in full.
 */
export const IG_RESOURCE_DIRECTORIES = [
  "input/capabilities",
  "input/examples",
  "input/extensions",
  "input/models",
  "input/operations",
  "input/profiles",
  "input/resources",
  "input/testing",
  "input/vocabulary",
] as const;

/**
 * Build output. Validated like anything else — a broken generated resource is
 * still a broken resource — but never offered for editing, because the next
 * build overwrites it.
 */
export const GENERATED_DIRECTORIES: Record<ProjectKind, string[]> = {
  "fhir-package": [],
  sushi: ["fsh-generated/resources"],
  "ig-publisher": ["fsh-generated/resources"],
};
