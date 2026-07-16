import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parsePackage } from "@/lib/fhir-importer/parser";
import type { ResourcePayload } from "@/lib/fhir-importer/types";
import { buildRegistry } from "@/lib/fhir-editor/registry";
import { resolveProfileForResource } from "@/lib/fhir-editor/profiles";
import {
  buildSchemaTree,
  createSchemaContext,
  validateResource,
} from "@/lib/fhir-editor/schema";

/**
 * Programmatic end-to-end import of the de.gematik.fhir.directory 1.2.0
 * sample packages: parse the real .tar archives, build the registry and
 * validate every packaged example against its profile. Skipped when the
 * sample folder is not checked out (e.g. CI).
 */

const SAMPLE_ROOT = new URL("../../sample-projekts", import.meta.url).pathname;

const PACKAGE_FILES = [
  "package.tar",
  "de.gematik.fhir.directory-1.2.0.tar",
  "de.gematik.ti-1.3.0.tar",
  "de.basisprofil.r4-1.5.4.tar",
  "de.gematik.terminology-1.0.9.tar",
  "hl7.terminology.r4-7.1.0.tar",
  "hl7.fhir.uv.extensions.r4-5.2.0.tar",
  "dvmd.kdl.r4-2025.0.1.tar",
];

const sampleAvailable =
  existsSync(SAMPLE_ROOT) &&
  PACKAGE_FILES.every((name) => existsSync(`${SAMPLE_ROOT}/${name}`));

const toArrayBuffer = (bytes: Buffer): ArrayBuffer => {
  const buffer = new ArrayBuffer(bytes.length);
  new Uint8Array(buffer).set(bytes);
  return buffer;
};

describe.skipIf(!sampleAvailable)("de.gematik.fhir.directory 1.2.0 sample import", () => {
  const loadAll = (() => {
    let cached: {
      payloads: ResourcePayload[];
      packages: Awaited<ReturnType<typeof parsePackage>>[];
    } | null = null;
    return async () => {
      if (cached) return cached;
      const packages = [];
      const payloads: ResourcePayload[] = [];
      for (const name of PACKAGE_FILES) {
        const parsed = await parsePackage(
          toArrayBuffer(readFileSync(`${SAMPLE_ROOT}/${name}`))
        );
        packages.push(parsed);
        for (const resource of parsed.resources) {
          payloads.push({
            key: `${parsed.packageKey}|${resource.sourcePath}`,
            packageKey: parsed.packageKey,
            resourceType: resource.resourceType,
            id: resource.id,
            url: resource.url,
            content: resource.content as Record<string, unknown>,
          });
        }
      }
      cached = { payloads, packages };
      return cached;
    };
  })();

  it("imports all packages from the plain .tar archives", async () => {
    const { packages } = await loadAll();
    const keys = packages.map((pkg) => pkg.packageKey);
    expect(keys).toContain("de.gematik.fhir.directory@1.2.0");
    expect(keys).toContain("hl7.fhir.r4.core@4.0.1");
    for (const pkg of packages) {
      expect(pkg.resources.length).toBeGreaterThan(0);
    }
  });

  it("validates the packaged examples without unknown-element noise", async () => {
    const { payloads } = await loadAll();
    const registry = buildRegistry(payloads);
    const ctx = createSchemaContext(registry);

    const examples = payloads.filter(
      (payload) =>
        payload.packageKey === "de.gematik.fhir.directory@1.2.0" &&
        payload.key.includes("/examples/") &&
        payload.resourceType !== "Bundle"
    );
    expect(examples.length).toBeGreaterThan(5);

    const offenders: string[] = [];
    for (const example of examples) {
      const content = example.content as Record<string, unknown>;
      const profile = resolveProfileForResource(content, registry);
      if (!profile) continue;
      const tree = buildSchemaTree(profile, ctx);
      if (!tree) continue;
      const issues = validateResource(content, tree, ctx, { locale: "en" });
      for (const issue of issues.filter((entry) => entry.code === "unknown-element")) {
        offenders.push(`${example.resourceType}/${example.id} ${issue.path}: ${issue.message}`);
      }
    }

    expect(offenders).toEqual([]);
  });

  it("models Endpoint.connectionType as a Coding without a coding child", async () => {
    const { payloads } = await loadAll();
    const registry = buildRegistry(payloads);
    const ctx = createSchemaContext(registry);

    const endpointExample = payloads.find(
      (payload) =>
        payload.resourceType === "Endpoint" && payload.id === "KIMEndpointExample"
    );
    expect(endpointExample).toBeDefined();

    const endpointContent = endpointExample!.content as Record<string, unknown>;
    const profile = resolveProfileForResource(endpointContent, registry);
    const tree = buildSchemaTree(profile!, ctx)!;
    const connectionType = tree.root.children.find(
      (child) => child.key === "connectionType"
    );
    expect(connectionType?.types[0]?.code).toBe("Coding");

    // Editing must keep the Coding shape: a CodeableConcept-shaped value is
    // rejected by validation.
    const corrupted = {
      ...endpointContent,
      connectionType: { coding: [{ system: "x", code: "y" }] },
    };
    const issues = validateResource(corrupted, tree, ctx, { locale: "en" });
    expect(
      issues.some(
        (issue) =>
          issue.code === "unknown-element" && issue.path === "connectionType.coding"
      )
    ).toBe(true);
  });
});
