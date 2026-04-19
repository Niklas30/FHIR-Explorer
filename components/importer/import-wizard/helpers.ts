import type { DependencyRequirement } from "@/lib/fhir-importer/types";

export const formatRequirement = (dependency: DependencyRequirement) => {
  if (dependency.exactVersion) {
    return dependency.exactVersion;
  }
  if (dependency.ranges.length === 1) {
    return dependency.ranges[0];
  }
  return dependency.ranges.join(", ");
};

export const parsePackageKey = (key: string) => {
  const index = key.lastIndexOf("@");
  if (index <= 0) return { id: key, version: "" };
  return { id: key.slice(0, index), version: key.slice(index + 1) };
};

