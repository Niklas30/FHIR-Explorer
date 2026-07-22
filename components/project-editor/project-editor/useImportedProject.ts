"use client";

import { useEffect, useMemo, useState } from "react";
import { importedResourceToAuthored } from "@/lib/projects/content";
import type { AuthoredProjectRecord, AuthoredResource } from "@/lib/projects/types";
import type { PackageRecord, ResourcePayload } from "@/lib/fhir-importer/types";

/**
 * Loads an imported package as a read-only project view: synthesizes an
 * {@link AuthoredProjectRecord} from the package manifest and maps its resource
 * payloads into authored-resource entries (never persisted).
 */
export const useImportedProject = ({
  packageRecord,
  getResourcePayloadsByPackageKeys,
}: {
  packageRecord: PackageRecord | null;
  getResourcePayloadsByPackageKeys: (keys: string[]) => Promise<ResourcePayload[]>;
}) => {
  const [resources, setResources] = useState<AuthoredResource[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!packageRecord) {
      setResources([]);
      setLoaded(true);
      return;
    }
    let active = true;
    setLoaded(false);
    getResourcePayloadsByPackageKeys([packageRecord.key])
      .then((payloads) => {
        if (!active) return;
        const now = Date.now();
        setResources(
          payloads.map((payload, index) =>
            importedResourceToAuthored(
              payload.content as Record<string, unknown>,
              now,
              index
            )
          )
        );
        setLoaded(true);
      })
      .catch(() => {
        if (!active) return;
        setResources([]);
        setLoaded(true);
      });
    return () => {
      active = false;
    };
  }, [packageRecord, getResourcePayloadsByPackageKeys]);

  const record = useMemo<AuthoredProjectRecord | null>(() => {
    if (!packageRecord) return null;
    return {
      key: packageRecord.key,
      id: packageRecord.id,
      version: packageRecord.version,
      manifest: packageRecord.manifest,
      createdAt: packageRecord.addedAt,
      updatedAt: packageRecord.addedAt,
    };
  }, [packageRecord]);

  return { record, resources, loaded };
};
