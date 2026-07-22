import { openDB, type IDBPDatabase } from "idb";
import { logger } from "@/lib/logger";
import type { AuthoredResource, AuthoredResourceKind } from "@/lib/projects/types";

const DB_NAME = "health-compose-projects";
const DB_VERSION = 1;
const STORE = "resources";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value && typeof value === "object" && !Array.isArray(value));

const openProjectDb = (): Promise<IDBPDatabase<unknown>> => {
  if (typeof indexedDB === "undefined") {
    throw new Error("IndexedDB is not available in this environment.");
  }
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE)) {
        // One entry per project key, value is the AuthoredResource[] array.
        db.createObjectStore(STORE);
      }
    },
  });
};

export const loadProjectResources = async (
  projectKey: string
): Promise<AuthoredResource[]> => {
  if (typeof indexedDB === "undefined") return [];
  try {
    const db = await openProjectDb();
    const value = (await db.get(STORE, projectKey)) as AuthoredResource[] | undefined;
    return Array.isArray(value) ? value : [];
  } catch (error) {
    logger.error("Failed to load project resources", { error, projectKey });
    return [];
  }
};

export const saveProjectResources = async (
  projectKey: string,
  resources: AuthoredResource[]
): Promise<void> => {
  if (typeof indexedDB === "undefined") return;
  try {
    const db = await openProjectDb();
    await db.put(STORE, resources, projectKey);
  } catch (error) {
    logger.error("Failed to save project resources", { error, projectKey });
  }
};

export const clearProjectResources = async (projectKey: string): Promise<void> => {
  if (typeof indexedDB === "undefined") return;
  try {
    const db = await openProjectDb();
    await db.delete(STORE, projectKey);
  } catch (error) {
    logger.error("Failed to clear project resources", { error, projectKey });
  }
};

// --- Pure helpers (side-effect free, unit-testable) ---------------------------

export const createAuthoredResourceId = () => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `authored-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 8)}`;
};

export const extractAuthoredTitle = (
  resource: Record<string, unknown>
): string | undefined => {
  const title = resource.title;
  if (typeof title === "string" && title.trim()) return title.trim();
  const name = resource.name;
  if (typeof name === "string" && name.trim()) return name.trim();
  return undefined;
};

/** Join a project canonical base with a resource type + name into a url. */
const buildCanonicalUrl = (
  canonicalBase: string | undefined,
  segment: string,
  name: string
): string => {
  const base = (canonicalBase ?? "http://example.org/fhir").replace(/\/+$/, "");
  return `${base}/${segment}/${name}`;
};

/**
 * Build a minimal but valid FHIR conformance-resource skeleton for the given
 * kind. `exampleResourceType`/`exampleProfile` only apply when kind is
 * "example". Pure — the caller wraps it into an {@link AuthoredResource}.
 */
export const buildConformanceSkeleton = (params: {
  kind: AuthoredResourceKind;
  name: string;
  canonicalBase?: string;
  exampleResourceType?: string;
  exampleProfile?: string;
}): { resourceType: string; content: Record<string, unknown> } => {
  const { kind, name, canonicalBase } = params;

  switch (kind) {
    case "valueset":
      return {
        resourceType: "ValueSet",
        content: {
          resourceType: "ValueSet",
          url: buildCanonicalUrl(canonicalBase, "ValueSet", name),
          name,
          status: "draft",
        },
      };
    case "codesystem":
      return {
        resourceType: "CodeSystem",
        content: {
          resourceType: "CodeSystem",
          url: buildCanonicalUrl(canonicalBase, "CodeSystem", name),
          name,
          status: "draft",
          content: "complete",
        },
      };
    case "extension":
      return {
        resourceType: "StructureDefinition",
        content: {
          resourceType: "StructureDefinition",
          url: buildCanonicalUrl(canonicalBase, "StructureDefinition", name),
          name,
          status: "draft",
          kind: "complex-type",
          abstract: false,
          type: "Extension",
          baseDefinition: "http://hl7.org/fhir/StructureDefinition/Extension",
          derivation: "constraint",
        },
      };
    case "profile":
      return {
        resourceType: "StructureDefinition",
        content: {
          resourceType: "StructureDefinition",
          url: buildCanonicalUrl(canonicalBase, "StructureDefinition", name),
          name,
          status: "draft",
          kind: "resource",
          abstract: false,
          type: "Resource",
          baseDefinition: "http://hl7.org/fhir/StructureDefinition/Resource",
          derivation: "constraint",
        },
      };
    case "example":
    default: {
      const resourceType = params.exampleResourceType ?? "Basic";
      const content: Record<string, unknown> = { resourceType };
      if (params.exampleProfile) {
        content.meta = { profile: [params.exampleProfile] };
      }
      return { resourceType, content };
    }
  }
};

/** Wrap a freshly built skeleton into a persisted-shape {@link AuthoredResource}. */
export const createAuthoredResource = (params: {
  kind: AuthoredResourceKind;
  name: string;
  canonicalBase?: string;
  exampleResourceType?: string;
  exampleProfile?: string;
  now: number;
}): AuthoredResource => {
  const { resourceType, content } = buildConformanceSkeleton(params);
  return {
    id: createAuthoredResourceId(),
    kind: params.kind,
    resourceType,
    profile: params.kind === "example" ? params.exampleProfile : undefined,
    title: extractAuthoredTitle(content),
    content,
    createdAt: params.now,
    updatedAt: params.now,
  };
};

/** Classify a FHIR resource into the project's building-block taxonomy. */
export const classifyResourceKind = (
  content: Record<string, unknown>
): AuthoredResourceKind => {
  const resourceType = content.resourceType;
  if (resourceType === "ValueSet") return "valueset";
  if (resourceType === "CodeSystem") return "codesystem";
  if (resourceType === "StructureDefinition") {
    return content.type === "Extension" ? "extension" : "profile";
  }
  return "example";
};

/**
 * Convert an arbitrary FHIR resource (e.g. from an imported package payload)
 * into an authored-resource entry. Pure and side-effect free.
 */
export const importedResourceToAuthored = (
  content: Record<string, unknown>,
  now: number,
  index: number
): AuthoredResource => {
  const resourceType =
    typeof content.resourceType === "string" ? content.resourceType : "Resource";
  const meta = content.meta;
  const profile =
    isRecord(meta) && Array.isArray(meta.profile)
      ? meta.profile.find((entry): entry is string => typeof entry === "string")
      : undefined;
  return {
    id:
      typeof content.id === "string" && content.id
        ? `${resourceType}-${content.id}`
        : `${resourceType}-${index}`,
    kind: classifyResourceKind(content),
    resourceType,
    profile,
    title: extractAuthoredTitle(content),
    content,
    createdAt: now,
    updatedAt: now,
  };
};

/**
 * A safe display label for a resource. Guards against FHIR fields like `name`
 * being complex objects (e.g. HumanName) rather than strings.
 */
export const resourceLabel = (resource: AuthoredResource): string => {
  if (resource.title && resource.title.trim()) return resource.title;
  const name = resource.content.name;
  if (typeof name === "string" && name.trim()) return name;
  const id = resource.content.id;
  if (typeof id === "string" && id.trim()) return id;
  return resource.resourceType;
};

/** Clone authored resources with fresh ids and timestamps for duplication. */
export const cloneAuthoredResources = (
  resources: AuthoredResource[],
  now: number
): AuthoredResource[] =>
  resources.map((resource) => ({
    ...resource,
    id: createAuthoredResourceId(),
    content: JSON.parse(JSON.stringify(resource.content)) as Record<string, unknown>,
    createdAt: now,
    updatedAt: now,
    lastSelectedAt: undefined,
  }));

export const isAuthoredResource = (value: unknown): value is AuthoredResource =>
  isRecord(value) &&
  typeof value.id === "string" &&
  typeof value.kind === "string" &&
  typeof value.resourceType === "string" &&
  isRecord(value.content);
