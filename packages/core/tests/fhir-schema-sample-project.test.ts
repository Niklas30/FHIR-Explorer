import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { buildRegistry, getStructureDefinitionByCanonical } from "@/lib/fhir-editor/registry";
import type { ResourcePayload } from "@/lib/fhir-importer/types";
import {
  buildSchemaTree,
  createSchemaContext,
  getNodeChildren,
  resolveSnapshotElements,
  validateResource,
} from "@/lib/fhir-editor/schema";

// Integration test against the real gematik directory sample project. It is
// skipped automatically when the sample data is not checked out next to the
// repository (e.g. in CI).
const SAMPLE_ROOT = new URL(
  "../../sample-projekts/de.gematik.fhir.directory-1.0.0-compose",
  import.meta.url
).pathname;

const loadPackage = (name: string): ResourcePayload[] => {
  const raw = JSON.parse(readFileSync(`${SAMPLE_ROOT}/packages/${name}`, "utf8"));
  return (raw.resources as Array<{ content: Record<string, unknown> }>).map(
    (entry, index) => ({
      key: `${name}-${index}`,
      packageKey: name,
      resourceType: String(entry.content.resourceType ?? ""),
      id: typeof entry.content.id === "string" ? entry.content.id : undefined,
      url: typeof entry.content.url === "string" ? entry.content.url : undefined,
      content: entry.content,
    })
  );
};

const sampleAvailable = existsSync(SAMPLE_ROOT);

const loadSampleContext = (() => {
  let cached: { registry: ReturnType<typeof buildRegistry>; ctx: ReturnType<typeof createSchemaContext> } | null = null;
  return () => {
    if (!cached) {
      const payloads = [
        ...loadPackage("hl7.fhir.r4.core-4.0.1.json"),
        ...loadPackage("de.gematik.fhir.directory-1.0.0.json"),
        ...loadPackage("de.basisprofil.r4-1.5.4.json"),
      ];
      const registry = buildRegistry(payloads);
      cached = { registry, ctx: createSchemaContext(registry) };
    }
    return cached;
  };
})();

describe.skipIf(!sampleAvailable)("schema engine against sample project", () => {
  const { registry, ctx } = sampleAvailable
    ? loadSampleContext()
    : ({ registry: buildRegistry([]), ctx: createSchemaContext(buildRegistry([])) });

  it("generates a snapshot for the directory profile", () => {
    const profile = getStructureDefinitionByCanonical(
      registry,
      "https://gematik.de/fhir/directory/StructureDefinition/HealthcareServiceDirectory"
    );
    expect(profile).toBeDefined();
    const elements = resolveSnapshotElements(profile!, ctx);
    // Base HealthcareService snapshot has 50 elements; the diff adds slices.
    expect(elements.length).toBeGreaterThan(50);
    const paths = elements.map((e) => e.id ?? e.path);
    expect(paths).toContain("HealthcareService.providedBy");
    expect(paths).toContain("HealthcareService.identifier:TelematikID");
    expect(paths).toContain("HealthcareService.availableTime.daysOfWeek");

    const providedBy = elements.find((e) => e.path === "HealthcareService.providedBy");
    expect(providedBy?.min).toBe(1);
    expect(providedBy?.type?.[0]?.code).toBe("Reference");
  });

  it("builds a full tree with backbone children and slices", () => {
    const profile = getStructureDefinitionByCanonical(
      registry,
      "https://gematik.de/fhir/directory/StructureDefinition/HealthcareServiceDirectory"
    );
    const tree = buildSchemaTree(profile!, ctx);
    expect(tree).toBeTruthy();
    const keys = tree!.root.children.map((c) => c.key);
    expect(keys).toContain("providedBy");
    expect(keys).toContain("availableTime");
    expect(keys).toContain("extension");

    const availableTime = tree!.root.children.find((c) => c.key === "availableTime");
    expect(availableTime?.children.map((c) => c.key)).toContain("daysOfWeek");

    const identifier = tree!.root.children.find((c) => c.key === "identifier");
    expect(identifier?.slices.map((s) => s.sliceName)).toContain("TelematikID");

    const extension = tree!.root.children.find((c) => c.key === "extension");
    expect(extension?.slices.length).toBeGreaterThan(0);
  });

  it("expands complex datatypes lazily", () => {
    const profile = getStructureDefinitionByCanonical(
      registry,
      "http://hl7.org/fhir/StructureDefinition/Patient"
    );
    const tree = buildSchemaTree(profile!, ctx);
    const name = tree!.root.children.find((c) => c.key === "name");
    expect(name).toBeDefined();
    const { children, source } = getNodeChildren(name!, "HumanName", ctx, tree!);
    expect(source).toBe("datatype");
    expect(children.map((c) => c.key)).toEqual(
      expect.arrayContaining(["family", "given", "use", "period"])
    );
  });

  it("handles choice elements", () => {
    const profile = getStructureDefinitionByCanonical(
      registry,
      "http://hl7.org/fhir/StructureDefinition/Patient"
    );
    const tree = buildSchemaTree(profile!, ctx);
    const deceased = tree!.root.children.find((c) => c.key === "deceased");
    expect(deceased?.isChoice).toBe(true);
    expect(deceased?.types.map((t) => t.code)).toEqual(["boolean", "dateTime"]);
  });

  it("handles recursive contentReference types", () => {
    const profile = getStructureDefinitionByCanonical(
      registry,
      "http://hl7.org/fhir/StructureDefinition/Questionnaire"
    );
    const tree = buildSchemaTree(profile!, ctx);
    const item = tree!.root.children.find((c) => c.key === "item");
    expect(item).toBeDefined();
    const nestedItem = item!.children.find((c) => c.key === "item");
    expect(nestedItem?.contentReference).toBe("#Questionnaire.item");
    const { children, source } = getNodeChildren(nestedItem!, undefined, ctx, tree!);
    expect(source).toBe("content-reference");
    expect(children.map((c) => c.key)).toContain("linkId");
  });

  it("validates the sample HealthcareService dataset resource", () => {
    const dataset = JSON.parse(
      readFileSync(`${SAMPLE_ROOT}/datasets/081295aa-aa2d-4513-8ddd-04eaa42e851e.json`, "utf8")
    );
    const resource = (dataset.resources[0].content ??
      dataset.resources[0]) as Record<string, unknown>;
    const profile = getStructureDefinitionByCanonical(
      registry,
      "https://gematik.de/fhir/directory/StructureDefinition/HealthcareServiceDirectory"
    );
    const tree = buildSchemaTree(profile!, ctx);
    const issues = validateResource(resource, tree!, ctx, { locale: "en" });
    // Should not crash and should not flag structurally valid content as unknown.
    const unknownIssues = issues.filter((issue) => issue.code === "unknown-element");
    expect(unknownIssues).toEqual([]);
  });
});
