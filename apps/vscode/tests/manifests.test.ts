import { describe, expect, it } from "vitest";
import {
  parseFhirPackageJson,
  parseIgIni,
  parseImplementationGuide,
  parseSushiConfig,
} from "@/workspace/manifests";

describe("parseFhirPackageJson", () => {
  it("accepts a manifest that declares itself FHIR", () => {
    const manifest = parseFhirPackageJson(
      JSON.stringify({
        name: "de.example.ig",
        version: "0.1.0",
        canonical: "http://example.org/fhir",
        dependencies: { "hl7.fhir.r4.core": "4.0.1" },
      })
    );
    expect(manifest?.name).toBe("de.example.ig");
    expect(manifest?.dependencies).toEqual({ "hl7.fhir.r4.core": "4.0.1" });
  });

  it("rejects an ordinary npm manifest", () => {
    // Otherwise every Node project in the workspace shows up as a FHIR project.
    expect(
      parseFhirPackageJson(
        JSON.stringify({ name: "my-app", version: "1.0.0", scripts: { build: "tsc" } })
      )
    ).toBeUndefined();
  });

  it("rejects unparseable or incomplete input", () => {
    expect(parseFhirPackageJson("{ not json")).toBeUndefined();
    expect(parseFhirPackageJson(JSON.stringify({ canonical: "x" }))).toBeUndefined();
  });
});

describe("parseSushiConfig", () => {
  const config = `
id: de.example.ig
canonical: http://example.org/fhir
name: ExampleIG
title: Example Implementation Guide
status: draft
version: 1.2.0
fhirVersion: 4.0.1
dependencies:
  hl7.fhir.us.core: 3.1.0
  de.basisprofil.r4:
    version: 1.5.4
    uri: http://fhir.de/ImplementationGuide/basisprofil
`;

  it("takes the id as the package name, not the title", () => {
    const manifest = parseSushiConfig(config);
    // `name` in sushi-config is a computer-friendly display name; the id is
    // what gets published and what other people depend on.
    expect(manifest?.name).toBe("de.example.ig");
    expect(manifest?.title).toBe("Example Implementation Guide");
    expect(manifest?.version).toBe("1.2.0");
    expect(manifest?.canonical).toBe("http://example.org/fhir");
    expect(manifest?.fhirVersions).toEqual(["4.0.1"]);
  });

  it("accepts both dependency spellings", () => {
    expect(parseSushiConfig(config)?.dependencies).toEqual({
      "hl7.fhir.us.core": "3.1.0",
      "de.basisprofil.r4": "1.5.4",
    });
  });

  it("returns nothing without an id and a version", () => {
    expect(parseSushiConfig("canonical: http://example.org")).toBeUndefined();
    expect(parseSushiConfig(": : :")).toBeUndefined();
  });
});

describe("parseIgIni", () => {
  it("finds the ig entry regardless of spacing and section", () => {
    expect(
      parseIgIni("[IG]\nig = input/de.example.ig.json\ntemplate = fhir.base.template#current\n")
    ).toEqual({ igPath: "input/de.example.ig.json" });
    expect(parseIgIni("[IG]\nig=input/x.xml")).toEqual({ igPath: "input/x.xml" });
  });

  it("returns nothing when there is no ig entry", () => {
    expect(parseIgIni("[IG]\ntemplate = fhir.base.template")).toEqual({});
  });
});

describe("parseImplementationGuide", () => {
  it("reads packageId and dependsOn", () => {
    const manifest = parseImplementationGuide(
      JSON.stringify({
        resourceType: "ImplementationGuide",
        id: "example",
        packageId: "de.example.ig",
        version: "2.0.0",
        url: "http://example.org/fhir/ImplementationGuide/de.example.ig",
        fhirVersion: ["4.0.1"],
        dependsOn: [
          { packageId: "hl7.fhir.r4.core", version: "4.0.1" },
          { uri: "http://example.org/no-package" },
        ],
      })
    );

    expect(manifest?.name).toBe("de.example.ig");
    expect(manifest?.version).toBe("2.0.0");
    // The canonical is the base, not the IG resource's own url.
    expect(manifest?.canonical).toBe("http://example.org/fhir");
    // An entry without a packageId cannot be installed, so it is dropped.
    expect(manifest?.dependencies).toEqual({ "hl7.fhir.r4.core": "4.0.1" });
  });

  it("survives an IG without a version", () => {
    expect(
      parseImplementationGuide(
        JSON.stringify({ resourceType: "ImplementationGuide", packageId: "x" })
      )?.version
    ).toBe("0.0.0");
  });

  it("rejects anything that is not an ImplementationGuide", () => {
    expect(
      parseImplementationGuide(JSON.stringify({ resourceType: "Patient", id: "x" }))
    ).toBeUndefined();
  });
});
