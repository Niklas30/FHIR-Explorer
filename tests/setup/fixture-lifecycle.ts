import { existsSync } from "node:fs";
import { cp, mkdir, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const FIXTURE_PACKAGE_DIR = "test-fixtures-1.0.0";

const REQUIRED_RELATIVE_PATHS = [
  `${FIXTURE_PACKAGE_DIR}/StructureDefinition-HealthcareService.json`,
  `${FIXTURE_PACKAGE_DIR}/StructureDefinition-HealthcareServiceDirectory.json`,
  `${FIXTURE_PACKAGE_DIR}/CodeSystem-days-of-week.json`,
  `${FIXTURE_PACKAGE_DIR}/ValueSet-days-of-week.json`,
  `${FIXTURE_PACKAGE_DIR}/CodeSystem-specialty-local.json`,
  `${FIXTURE_PACKAGE_DIR}/ValueSet-specialty-local.json`,
  `${FIXTURE_PACKAGE_DIR}/CodeSystem-specialty-extra.json`,
  `${FIXTURE_PACKAGE_DIR}/ValueSet-specialty.json`,
  `${FIXTURE_PACKAGE_DIR}/examples/HealthcareService-Example.json`,
] as const;

const copyFromRepoFixtures = async (targetRoot: string) => {
  const projectRoot = process.cwd();
  const fixtureSourceRoot = path.resolve(projectRoot, "tests", "fixtures", "fhir-packages");

  for (const relative of REQUIRED_RELATIVE_PATHS) {
    const from = path.resolve(fixtureSourceRoot, relative);
    if (!existsSync(from)) {
      throw new Error(
        `Missing committed test fixture: ${path.relative(projectRoot, from)} (required: ${relative})`
      );
    }
  }

  for (const relative of REQUIRED_RELATIVE_PATHS) {
    const from = path.resolve(fixtureSourceRoot, relative);
    const to = path.resolve(targetRoot, relative);
    await mkdir(path.dirname(to), { recursive: true });
    await cp(from, to);
  }
};

const assertFixtureTree = async (targetRoot: string) => {
  for (const relative of REQUIRED_RELATIVE_PATHS) {
    const absolute = path.resolve(targetRoot, relative);
    if (!existsSync(absolute)) {
      throw new Error(`Missing test fixture after setup: ${relative}`);
    }
  }
};

export default async function setupFixtures() {
  const fixtureRoot = path.resolve(
    os.tmpdir(),
    `fhir-explorer-editor-test-fixtures-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  );
  await mkdir(fixtureRoot, { recursive: true });
  process.env.FHIR_TEST_FIXTURE_ROOT = fixtureRoot;

  await copyFromRepoFixtures(fixtureRoot);
  await assertFixtureTree(fixtureRoot);

  return async () => {
    await rm(fixtureRoot, { recursive: true, force: true });
    delete process.env.FHIR_TEST_FIXTURE_ROOT;
  };
}
