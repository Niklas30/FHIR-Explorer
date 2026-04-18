import type { PackageId, PackageVersion } from "./types";

export type RegistryStrategy = {
  name: string;
  buildDownloadUrl: (id: PackageId, version: PackageVersion) => string;
};

export class FhirPackageRegistry implements RegistryStrategy {
  name: string;
  private baseUrl: string;

  constructor(name: string, baseUrl: string) {
    this.name = name;
    this.baseUrl = baseUrl.replace(/\/$/, "");
  }

  buildDownloadUrl(id: PackageId, version: PackageVersion) {
    return `${this.baseUrl}/${encodeURIComponent(id)}/${encodeURIComponent(version)}`;
  }
}

// Default is HL7 terminology server per acceptance criteria.
export const DEFAULT_REGISTRY_BASE = "https://r4.terminology.hl7.org";
export const PACKAGES2_REGISTRY_BASE = "https://packages2.fhir.org/packages";

export const registryStrategies = {
  hl7: new FhirPackageRegistry("HL7 Terminology", DEFAULT_REGISTRY_BASE),
  packages2: new FhirPackageRegistry("FHIR Packages2", PACKAGES2_REGISTRY_BASE),
};

export const defaultRegistry = registryStrategies.packages2;
