import { readFileSync } from "node:fs";
import path from "node:path";
import type { ResourcePayload } from "@/lib/fhir-importer/types";
import { buildRegistry, getStructureDefinitionByCanonical } from "@/lib/fhir-editor/registry";
import {
  buildSchemaTree,
  createSchemaContext,
  type SchemaContext,
  type SchemaTree,
} from "@/lib/fhir-editor/schema";

export const DIRECTORY_PROFILE_URL =
  "https://example.org/fhir/StructureDefinition/HealthcareServiceDirectory";

export const PATIENT_PROFILE_URL =
  "https://example.org/fhir/StructureDefinition/PatientProfile";

export const SURVEY_URL = "https://example.org/fhir/StructureDefinition/Survey";

export const BIRTH_PLACE_URL = "https://example.org/fhir/StructureDefinition/birth-place";

export const CONTACT_PREFERENCE_URL =
  "https://example.org/fhir/StructureDefinition/contact-preference";

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
  "test-fixtures-1.0.0/StructureDefinition-Patient.json",
  "test-fixtures-1.0.0/StructureDefinition-PatientProfile.json",
  "test-fixtures-1.0.0/StructureDefinition-Organization.json",
  "test-fixtures-1.0.0/StructureDefinition-Survey.json",
  "test-fixtures-1.0.0/StructureDefinition-HumanName.json",
  "test-fixtures-1.0.0/StructureDefinition-Period.json",
  "test-fixtures-1.0.0/StructureDefinition-Coding.json",
  "test-fixtures-1.0.0/StructureDefinition-CodeableConcept.json",
  "test-fixtures-1.0.0/StructureDefinition-Identifier.json",
  "test-fixtures-1.0.0/StructureDefinition-Reference.json",
  "test-fixtures-1.0.0/StructureDefinition-Extension.json",
  "test-fixtures-1.0.0/StructureDefinition-birth-place.json",
  "test-fixtures-1.0.0/StructureDefinition-contact-preference.json",
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

export const createFixtureRegistry = () => {
  const payloads = FIXTURE_PATHS.map((fixturePath) => toPayload(fixturePath));
  return buildRegistry(payloads);
};

export const loadFixtureJson = <T = unknown>(relativePath: string): T => {
  const absolutePath = resolveFixturePath(relativePath);
  const raw = readFileSync(absolutePath, "utf8");
  return JSON.parse(raw) as T;
};

export type SchemaFixtureContext = {
  registry: ReturnType<typeof buildRegistry>;
  ctx: SchemaContext;
  tree: SchemaTree;
};

export const createSchemaFixtureContext = (
  profileUrl: string
): SchemaFixtureContext => {
  const registry = createFixtureRegistry();
  const ctx = createSchemaContext(registry);
  const profile = getStructureDefinitionByCanonical(registry, profileUrl);
  if (!profile) {
    throw new Error(`Profile not found in fixtures: ${profileUrl}`);
  }
  const tree = buildSchemaTree(profile, ctx);
  if (!tree) {
    throw new Error(`Could not build schema tree for: ${profileUrl}`);
  }
  return { registry, ctx, tree };
};

export const createHealthcareServiceDirectoryContext = () =>
  createSchemaFixtureContext(DIRECTORY_PROFILE_URL);

export const createPatientProfileContext = () =>
  createSchemaFixtureContext(PATIENT_PROFILE_URL);
