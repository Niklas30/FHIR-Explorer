import { describe, expect, it } from "vitest";
import { collectProfileClosure } from "@fhir-explorer/core/fhir-editor/closure";
import { buildRegistry } from "@fhir-explorer/core/fhir-editor/registry";
import {
  buildSchemaTree,
  createSchemaContext,
  getNodeChildren,
} from "@fhir-explorer/core/fhir-editor/schema";
import {
  PATIENT_PROFILE_URL,
  createFixtureRegistry,
} from "./helpers/fhir-test-fixtures";

/**
 * The closure exists so the VS Code webview can be handed a registry small
 * enough to postMessage. The property that matters is therefore not "it finds
 * some resources" but "a tree built from the closure alone is the same tree".
 */
describe("profile closure", () => {
  it("pulls in the base definition, data types and bindings", () => {
    const registry = createFixtureRegistry();
    const payloads = collectProfileClosure(PATIENT_PROFILE_URL, registry);
    const urls = new Set(payloads.map((payload) => payload.url));

    expect(urls.has(PATIENT_PROFILE_URL)).toBe(true);
    expect(urls.has("http://hl7.org/fhir/StructureDefinition/Patient")).toBe(true);
    expect(urls.has("http://hl7.org/fhir/StructureDefinition/HumanName")).toBe(true);
  });

  it("is smaller than the registry it came from", () => {
    const registry = createFixtureRegistry();
    const payloads = collectProfileClosure(PATIENT_PROFILE_URL, registry);
    const total =
      registry.structureDefinitions.length +
      registry.valueSetsByUrl.size +
      registry.codeSystemsByUrl.size;

    expect(payloads.length).toBeLessThan(total);
  });

  it("builds the same schema tree as the full registry", () => {
    const full = createFixtureRegistry();
    const reduced = buildRegistry(collectProfileClosure(PATIENT_PROFILE_URL, full));

    const treeOf = (registry: typeof full) => {
      const definition = registry.structureDefinitionsByUrl.get(PATIENT_PROFILE_URL);
      expect(definition).toBeDefined();
      const ctx = createSchemaContext(registry);
      const tree = buildSchemaTree(definition!, ctx);
      expect(tree).not.toBeNull();
      return { tree: tree!, ctx };
    };

    const a = treeOf(full);
    const b = treeOf(reduced);

    expect(b.tree.rootType).toBe(a.tree.rootType);

    const keysOf = ({ tree, ctx }: ReturnType<typeof treeOf>) =>
      getNodeChildren(tree.root, undefined, ctx, tree)
        .children.map((child) => child.key)
        .sort();
    expect(keysOf(b)).toEqual(keysOf(a));

    // One level deeper too: the closure has to carry the data types, not just
    // the profile's own elements.
    const nameChildren = ({ tree, ctx }: ReturnType<typeof treeOf>) => {
      const name = getNodeChildren(tree.root, undefined, ctx, tree).children.find(
        (child) => child.key === "name"
      );
      expect(name).toBeDefined();
      return getNodeChildren(name!, undefined, ctx, tree)
        .children.map((child) => child.key)
        .sort();
    };
    expect(nameChildren(b)).toEqual(nameChildren(a));
    expect(nameChildren(b).length).toBeGreaterThan(0);
  });

  it("returns nothing for a canonical that is not in the registry", () => {
    const registry = createFixtureRegistry();
    expect(collectProfileClosure("https://example.org/missing", registry)).toEqual([]);
  });
});
