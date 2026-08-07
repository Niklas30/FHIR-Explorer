import { describe, expect, it } from "vitest";
import { compareVersions, isPrerelease, sortVersionsForPicking } from "@/lib/fhir-importer/version";

describe("version ordering", () => {
  it("orders by numeric component, not by string", () => {
    expect(compareVersions("1.10.0", "1.9.0")).toBeGreaterThan(0);
    expect(compareVersions("2.0.0", "10.0.0")).toBeLessThan(0);
    expect(compareVersions("1.4.0", "1.4.0")).toBe(0);
  });

  it("treats a missing component as zero, so 1.4 and 1.4.0 are the same", () => {
    expect(compareVersions("1.4", "1.4.0")).toBe(0);
    expect(compareVersions("1.4.0.2", "1.4.0")).toBeGreaterThan(0);
  });

  it("ranks a release above its own pre-releases", () => {
    expect(compareVersions("1.5.0", "1.5.0-ballot2")).toBeGreaterThan(0);
    expect(isPrerelease("1.5.0-alpha1")).toBe(true);
    expect(isPrerelease("1.5.0")).toBe(false);
  });

  it("does not fall over on versions it cannot parse", () => {
    expect(() => compareVersions("current", "1.0.0")).not.toThrow();
  });

  it("puts every pre-release below every stable version when picking", () => {
    expect(
      sortVersionsForPicking(["1.5.0-alpha10", "1.3.2", "1.5.0", "1.4.0", "1.6.0-ballot"])
    ).toEqual(["1.5.0", "1.4.0", "1.3.2", "1.6.0-ballot", "1.5.0-alpha10"]);
  });

  it("picks the newer of two pinned versions, which is what the resolver needs", () => {
    // The real case: ISiK pins de.basisprofil.r4 1.4.0, KBV pins 1.3.2.
    expect(sortVersionsForPicking(["1.4.0", "1.3.2"])[0]).toBe("1.4.0");
  });
});
