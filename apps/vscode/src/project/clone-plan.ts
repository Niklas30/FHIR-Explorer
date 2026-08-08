import { importedResourceToAuthored } from "@fhir-explorer/core/projects/content";
import type { ResourcePayload } from "@fhir-explorer/core/fhir-importer/types";
import {
  directoryForKind,
  fileNameForResource,
} from "@/workspace/layout";

/**
 * Deciding where each resource of a forked package lands.
 *
 * Kept free of any `vscode` import so it can be tested: two resources can
 * derive the same file name — the same id filed under different types, or none
 * at all — and a collision that silently overwrites would lose a resource with
 * nothing to show for it.
 */

export type ClonedFile = { path: string; content: Record<string, unknown> };

export type ClonePlan = {
  files: ClonedFile[];
  /** Payloads that carry no `resourceType` and are therefore not resources. */
  skipped: number;
};

export const planClone = (payloads: ResourcePayload[]): ClonePlan => {
  const files: ClonedFile[] = [];
  const used = new Set<string>();
  let skipped = 0;

  for (const [index, payload] of payloads.entries()) {
    const content = payload.content;
    if (!content || typeof content !== "object" || Array.isArray(content)) {
      skipped += 1;
      continue;
    }
    const record = content as Record<string, unknown>;
    if (typeof record.resourceType !== "string") {
      skipped += 1;
      continue;
    }

    const authored = importedResourceToAuthored(record, 0, index);
    const id = typeof record.id === "string" ? record.id : undefined;
    const base = `${directoryForKind(authored.kind)}/${fileNameForResource(
      authored.resourceType,
      id ?? authored.title
    )}`;

    let path = base;
    for (let attempt = 2; used.has(path); attempt += 1) {
      path = base.replace(/\.json$/, `-${attempt}.json`);
    }
    used.add(path);

    files.push({ path, content: record });
  }

  return { files, skipped };
};
