import { describe, expect, it } from "vitest";
import {
  getCurrentTargetKey,
  isProjectSelectableForDatasets,
  isTargetImportInProgress,
} from "@/lib/fhir-importer/target-status";
import { buildPackageKey } from "@/lib/fhir-importer/utils";

const createInput = (overrides?: {
  packageKeys?: string[];
  currentTarget?: { id: string; version: string };
  missingCount?: number;
  conflictCount?: number;
}) => ({
  packages: (overrides?.packageKeys ?? []).map((key) => ({ key })),
  state: { currentTarget: overrides?.currentTarget },
  dependencyState: {
    missing: new Array(overrides?.missingCount ?? 0).fill({}),
    conflicts: new Array(overrides?.conflictCount ?? 0).fill({}),
  },
});

describe("target status helpers", () => {
  it("returns null target key when no target is active", () => {
    expect(getCurrentTargetKey({ currentTarget: undefined })).toBeNull();
  });

  it("detects in-progress import while target package is missing", () => {
    const input = createInput({
      currentTarget: { id: "example.target", version: "1.0.1" },
      packageKeys: [buildPackageKey("example.target", "1.0.0")],
    });

    expect(isTargetImportInProgress(input)).toBe(true);
    expect(isProjectSelectableForDatasets(buildPackageKey("example.target", "1.0.1"), input)).toBe(false);
    expect(isProjectSelectableForDatasets(buildPackageKey("example.target", "1.0.0"), input)).toBe(true);
  });

  it("blocks target datasets until missing/conflicting dependencies are resolved", () => {
    const targetKey = buildPackageKey("example.target", "1.0.1");
    const input = createInput({
      currentTarget: { id: "example.target", version: "1.0.1" },
      packageKeys: [targetKey],
      missingCount: 1,
      conflictCount: 1,
    });

    expect(isTargetImportInProgress(input)).toBe(false);
    expect(isProjectSelectableForDatasets(targetKey, input)).toBe(false);
  });

  it("allows selecting target datasets once dependencies are resolved", () => {
    const targetKey = buildPackageKey("example.target", "1.0.1");
    const input = createInput({
      currentTarget: { id: "example.target", version: "1.0.1" },
      packageKeys: [targetKey],
      missingCount: 0,
      conflictCount: 0,
    });

    expect(isTargetImportInProgress(input)).toBe(false);
    expect(isProjectSelectableForDatasets(targetKey, input)).toBe(true);
  });
});
