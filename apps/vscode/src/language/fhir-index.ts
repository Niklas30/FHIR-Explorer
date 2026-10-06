import * as vscode from "vscode";
import {
  buildRegistry,
  normalizeCanonical,
  type FhirRegistry,
} from "@fhir-explorer/core/fhir-editor/registry";
import { createSchemaContext, type SchemaContext } from "@fhir-explorer/core/fhir-editor/schema";
import type { ResourcePayload } from "@fhir-explorer/core/fhir-importer/types";
import type { ResourceStore } from "@fhir-explorer/core/ports";
import type { AuthoredResource } from "@fhir-explorer/core/projects/types";
import { GlobalPackageStore } from "@/adapters/global-package-store";
import type { WorkspaceProject } from "@/workspace/project-discovery";
import type { ProjectRegistry } from "@/workspace/project-registry";

/**
 * Everything the language features resolve against: the conformance resources
 * from the imported packages plus the ones the user is authoring right now.
 *
 * The two sources are cached separately on purpose. Package payloads are large
 * and change only on import; workspace resources are small and change on every
 * keystroke. Rebuilding the maps is cheap — re-reading a core IG from disk is
 * not, so that read has to survive an edit.
 */

export type WorkspaceDefinition = {
  canonical: string;
  uri: vscode.Uri;
  resourceType: string;
};

export type FhirIndexSnapshot = {
  registry: FhirRegistry;
  ctx: SchemaContext;
  projects: WorkspaceProject[];
  /** Canonicals defined by files in the workspace, for go-to-definition. */
  definitions: Map<string, WorkspaceDefinition>;
  /** `ResourceType/id` of every workspace instance, for reference checking. */
  references: Set<string>;
  /** Where a canonical came from — a package key, or the project it is authored in. */
  origins: Map<string, string>;
  /** `ResourceType/id` -> file, for jumping from a Reference to its target. */
  instances: Map<string, vscode.Uri>;
  /** Authored resources per project root, as read for this snapshot. */
  projectResources: Map<string, AuthoredResource[]>;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value && typeof value === "object" && !Array.isArray(value));

/** Authored resources enter the registry through the same shape as packages. */
const toPayload = (
  project: WorkspaceProject,
  resource: AuthoredResource
): ResourcePayload => ({
  key: `${project.key}:${resource.id}`,
  packageKey: project.key,
  resourceType: resource.resourceType,
  id: typeof resource.content.id === "string" ? resource.content.id : undefined,
  url: typeof resource.content.url === "string" ? resource.content.url : undefined,
  content: resource.content,
});

export class FhirIndex {
  private packagePayloads: Promise<ResourcePayload[]> | undefined;
  private snapshot: Promise<FhirIndexSnapshot> | undefined;

  private readonly changed = new vscode.EventEmitter<void>();
  /** Fires after an invalidation, so consumers can re-run their analysis. */
  readonly onDidChange = this.changed.event;

  constructor(
    private readonly packageStore: GlobalPackageStore,
    private readonly resourceStore: ResourceStore<AuthoredResource>,
    private readonly projects: ProjectRegistry
  ) {}

  /** Workspace content changed: keep the package payloads, drop the rest. */
  invalidateWorkspace(): void {
    this.snapshot = undefined;
    this.changed.fire();
  }

  /** A package was imported or removed: everything has to be re-read. */
  invalidatePackages(): void {
    this.packagePayloads = undefined;
    this.snapshot = undefined;
    this.changed.fire();
  }

  private loadPackagePayloads(): Promise<ResourcePayload[]> {
    this.packagePayloads ??= (async () => {
      const packages = await this.packageStore.listPackages();
      return await this.packageStore.listResourcePayloadsByPackageKeys(
        packages.map((entry) => entry.key)
      );
    })();
    return this.packagePayloads;
  }

  get(): Promise<FhirIndexSnapshot> {
    this.snapshot ??= this.build();
    return this.snapshot;
  }

  private async build(): Promise<FhirIndexSnapshot> {
    const [packagePayloads, projects] = await Promise.all([
      this.loadPackagePayloads(),
      this.projects.list(),
    ]);

    const definitions = new Map<string, WorkspaceDefinition>();
    const references = new Set<string>();
    const instances = new Map<string, vscode.Uri>();
    const origins = new Map<string, string>();
    const workspacePayloads: ResourcePayload[] = [];
    const projectResources = new Map<string, AuthoredResource[]>();

    for (const payload of packagePayloads) {
      if (payload.url) origins.set(normalizeCanonical(payload.url), payload.packageKey);
    }

    for (const project of projects) {
      const resources = await this.resourceStore.load(project.root.toString());
      projectResources.set(project.root.toString(), resources);
      for (const resource of resources) {
        workspacePayloads.push(toPayload(project, resource));

        const uri = vscode.Uri.joinPath(project.root, ...resource.id.split("/"));
        const url = resource.content.url;
        if (typeof url === "string") {
          definitions.set(normalizeCanonical(url), {
            canonical: normalizeCanonical(url),
            uri,
            resourceType: resource.resourceType,
          });
          origins.set(normalizeCanonical(url), project.key);
        }
        const id = resource.content.id;
        if (typeof id === "string" && id) {
          references.add(`${resource.resourceType}/${id}`);
          instances.set(`${resource.resourceType}/${id}`, uri);
        }
      }
    }

    // Workspace resources last so an authored profile shadows a packaged one
    // with the same canonical — the local edit is what the user is looking at.
    const registry = buildRegistry([...packagePayloads, ...workspacePayloads]);

    return {
      registry,
      ctx: createSchemaContext(registry),
      projects,
      definitions,
      references,
      origins,
      instances,
      projectResources,
    };
  }
}

/** Read a canonical url out of a resource, ignoring any `|version` suffix. */
export const canonicalOf = (content: unknown): string | undefined => {
  if (!isRecord(content)) return undefined;
  return typeof content.url === "string" ? normalizeCanonical(content.url) : undefined;
};
