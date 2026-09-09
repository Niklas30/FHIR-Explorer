import { describe, expect, it } from "vitest";

import { extractImportedDatasetPayload } from "@/components/overview/actions";

describe("dataset import payload extraction", () => {
  const patient = { resourceType: "Patient", id: "patient-1" };
  const observation = { resourceType: "Observation", id: "observation-1" };

  it("imports a plain resource list", () => {
    expect(extractImportedDatasetPayload([patient, observation])).toEqual({
      resources: [patient, observation],
    });
  });

  it.each(["collection", "batch", "transaction", "history", "searchset"])(
    "imports resources from a %s FHIR Bundle",
    (type) => {
      expect(
        extractImportedDatasetPayload({
          resourceType: "Bundle",
          type,
          entry: [{ fullUrl: "Patient/patient-1", resource: patient }, { request: {}, resource: observation }],
        })
      ).toEqual({ resources: [patient, observation] });
    }
  );

  it("imports the resources and metadata from a dataset export", () => {
    expect(
      extractImportedDatasetPayload({ id: "dataset-1", name: "My dataset", resources: [patient] })
    ).toEqual({ id: "dataset-1", name: "My dataset", resources: [patient] });
  });

  it("imports a single FHIR resource as a dataset", () => {
    expect(extractImportedDatasetPayload(patient)).toEqual({ resources: [patient] });
  });
});
