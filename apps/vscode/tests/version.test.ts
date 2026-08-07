import { describe, expect, it } from "vitest";
import {
  compareVersions,
  resolveVersionRange,
  sortVersionsForPicking,
} from "@/registry/version";

describe("compareVersions", () => {
  it("orders by numeric component, not lexically", () => {
    // The reason this exists at all: "10" < "9" as strings.
    expect(compareVersions("1.10.0", "1.9.0")).toBeGreaterThan(0);
    expect(compareVersions("4.0.1", "4.0.1")).toBe(0);
    expect(compareVersions("1.0.0", "1.0.1")).toBeLessThan(0);
  });

  it("treats missing components as zero", () => {
    expect(compareVersions("1.6", "1.6.0")).toBe(0);
    expect(compareVersions("2", "1.9.9")).toBeGreaterThan(0);
  });

  it("ranks a release above its own pre-releases", () => {
    expect(compareVersions("1.6.0", "1.6.0-ballot2")).toBeGreaterThan(0);
    expect(compareVersions("1.6.0-ballot", "1.6.0-ballot2")).toBeLessThan(0);
  });
});

describe("sortVersionsForPicking", () => {
  it("puts the newest release first and pre-releases last", () => {
    expect(
      sortVersionsForPicking(["1.5.1", "1.6.0-ballot2", "1.6.0", "1.5.4", "1.6.0-ballot"])
    ).toEqual(["1.6.0", "1.5.4", "1.5.1", "1.6.0-ballot2", "1.6.0-ballot"]);
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
