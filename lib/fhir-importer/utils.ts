import type { PackageId, PackageKey, PackageVersion } from "./types";

export const buildPackageKey = (id: PackageId, version: PackageVersion): PackageKey =>
  `${id}@${version}`;

export const isExactVersion = (spec: string): boolean => {
  if (!spec) return false;
  // Treat as a range if it contains typical semver operators or whitespace.
  return !/[<>=^~*xX|\s]/.test(spec.trim());
};

export const unique = <T,>(values: T[]): T[] => Array.from(new Set(values));
