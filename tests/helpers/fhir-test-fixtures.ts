import { readFileSync } from "node:fs";
import path from "node:path";
import type { ResourcePayload } from "@/lib/fhir-importer/types";
import { buildRegistry, getStructureDefinitionByCanonical } from "@/lib/fhir-editor/registry";
import { buildFieldDefinitions } from "@/lib/fhir-editor/profiles";

export const DIRECTORY_PROFILE_URL =
  "https://example.org/fhir/StructureDefinition/HealthcareServiceDirectory";

export const HEALTHCARE_SERVICE_EXAMPLE_PATH =
  "test-fixtures-1.0.0/examples/HealthcareService-Example.json";

const resolveFixturePath = (relativePath: string) => {
  const fixtureRoot = process.env.FHIR_TEST_FIXTURE_ROOT;
  if (!fixtureRoot) {
    throw new Error(
      "FHIR_TEST_FIXTURE_ROOT is not set. Run tests via vitest so fixture setup can prepare data."
    );
  }
  return path.resolve(fixtureRoot, relativePath);
};

const FIXTURE_PATHS = [
  "test-fixtures-1.0.0/StructureDefinition-HealthcareService.json",
  "test-fixtures-1.0.0/StructureDefinition-HealthcareServiceDirectory.json",
  "test-fixtures-1.0.0/CodeSystem-days-of-week.json",
  "test-fixtures-1.0.0/ValueSet-days-of-week.json",
  "test-fixtures-1.0.0/CodeSystem-specialty-local.json",
  "test-fixtures-1.0.0/ValueSet-specialty-local.json",
  "test-fixtures-1.0.0/CodeSystem-specialty-extra.json",
  "test-fixtures-1.0.0/ValueSet-specialty.json",
] as const;

const toPayload = (relativePath: string): ResourcePayload => {
  const absolutePath = resolveFixturePath(relativePath);
  const raw = readFileSync(absolutePath, "utf8");
  const content = JSON.parse(raw) as Record<string, unknown>;
  const resourceType = content.resourceType;

  if (typeof resourceType !== "string") {
    throw new Error(`Fixture is missing resourceType: ${relativePath}`);
  }

  return {
    key: relativePath,
    packageKey: "test-fixtures",
    resourceType,
    id: typeof content.id === "string" ? content.id : undefined,
    url: typeof content.url === "string" ? content.url : undefined,
    content,
  };
};

const fixturePayloads = FIXTURE_PATHS.map((fixturePath) => toPayload(fixturePath));

export const createFixtureRegistry = () => buildRegistry(fixturePayloads);

export const loadFixtureJson = <T = unknown>(relativePath: string): T => {
  const absolutePath = resolveFixturePath(relativePath);
  const raw = readFileSync(absolutePath, "utf8");
  return JSON.parse(raw) as T;
};

export const createHealthcareServiceDirectoryFieldContext = () => {
  const registry = createFixtureRegistry();
  const profile = getStructureDefinitionByCanonical(registry, DIRECTORY_PROFILE_URL);
  if (!profile) {
    throw new Error(`Profile not found in fixtures: ${DIRECTORY_PROFILE_URL}`);
  }

  const fields = buildFieldDefinitions(profile, registry);
  return { registry, profile, fields };
};
