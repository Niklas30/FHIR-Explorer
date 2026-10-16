import { describe, expect, it } from "vitest";
import {
  compareVersions,
  isPrerelease,
  resolveVersionRange,
  sortVersionsForPicking,
} from "@fhir-explorer/core/fhir-importer/version";

describe("version ordering", () => {
  it("orders by numeric component, not by string", () => {
    expect(compareVersions("1.10.0", "1.9.0")).toBeGreaterThan(0);
    expect(compareVersions("2.0.0", "10.0.0")).toBeLessThan(0);
    expect(compareVersions("1.4.0", "1.4.0")).toBe(0);
  });

  it("treats a missing component as zero, so 1.4 and 1.4.0 are the same", () => {
    expect(compareVersions("1.4", "1.4.0")).toBe(0);
    expect(compareVersions("1.4.0.2", "1.4.0")).toBeGreaterThan(0);
    expect(compareVersions("2", "1.9.9")).toBeGreaterThan(0);
  });

  it("ranks a release above its own pre-releases", () => {
    expect(compareVersions("1.5.0", "1.5.0-ballot2")).toBeGreaterThan(0);
    expect(compareVersions("1.6.0-ballot", "1.6.0-ballot2")).toBeLessThan(0);
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

describe("resolveVersionRange", () => {
  const available = ["1.5.1", "1.5.4", "1.6.0", "1.6.0-ballot2"];

  it("takes an exact pin as it is", () => {
    expect(resolveVersionRange("1.5.4", available, "1.6.0")).toBe("1.5.4");
  });

  it("resolves a pre-release pin the registry actually lists", () => {
    expect(resolveVersionRange("1.6.0-ballot2", available, "1.6.0")).toBe("1.6.0-ballot2");
  });

  it("maps latest and wildcards onto the dist-tag", () => {
    expect(resolveVersionRange("latest", available, "1.6.0")).toBe("1.6.0");
    expect(resolveVersionRange("*", available, "1.6.0")).toBe("1.6.0");
  });

  it("gives caret and tilde their real semver meaning", () => {
    // Caret allows minor bumps, tilde does not. Approximating either by string
    // prefix would silently resolve to the wrong release.
    expect(resolveVersionRange("^1.5.0", available, "1.6.0")).toBe("1.6.0");
    expect(resolveVersionRange("~1.5.1", available, "1.6.0")).toBe("1.5.4");
    expect(resolveVersionRange("1.5.x", available, "1.6.0")).toBe("1.5.4");
  });

  it("never crosses a major boundary for a caret range", () => {
    const across = ["1.9.0", "2.0.0", "2.1.0"];
    expect(resolveVersionRange("^1.0.0", across, "2.1.0")).toBe("1.9.0");
  });

  it("ignores releases older than the pin", () => {
    expect(resolveVersionRange("~1.5.2", available, "1.6.0")).toBe("1.5.4");
    expect(resolveVersionRange("^1.7.0", available, "1.6.0")).toBe("1.6.0");
  });

  it("prefers a stable release over a pre-release inside a range", () => {
    expect(resolveVersionRange("^1.6.0", available, "1.6.0")).toBe("1.6.0");
  });

  it("falls back to latest rather than blocking on an unknown form", () => {
    expect(resolveVersionRange(">=1.2 <2", available, "1.6.0")).toBe("1.6.0");
  });

  it("still answers when the registry publishes no dist-tag", () => {
    expect(resolveVersionRange("latest", available, undefined)).toBe("1.6.0");
  });
});
