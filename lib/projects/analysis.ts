import type { AuthoredResource, AuthoredResourceKind } from "@/lib/projects/types";
import type { PackageManifest } from "@/lib/fhir-importer/types";
import { resourceLabel } from "@/lib/projects/content";

export type ProjectNodeKind = AuthoredResourceKind | "external";

export type ProjectGraphNode = {
  id: string;
  kind: ProjectNodeKind;
  label: string;
  url?: string;
  resourceId?: string;
};

export type ProjectEdgeKind = "derives" | "conforms" | "binds" | "includes" | "extends";

export type ProjectEdge = { from: string; to: string; kind: ProjectEdgeKind };

export type IssueSeverity = "error" | "warning";

export type ProjectIssue = {
  severity: IssueSeverity;
  code: string;
  message: string;
  resourceId?: string;
};

export type ProjectAnalysis = {
  counts: Record<AuthoredResourceKind, number>;
  nodes: ProjectGraphNode[];
  edges: ProjectEdge[];
  issues: ProjectIssue[];
  /** resourceId → resourceIds of authored resources that reference it. */
  usedBy: Record<string, string[]>;
};

/** Callbacks that answer whether a canonical resolves in the imported registry. */
export type CanonicalResolvers = {
  hasStructureDefinition: (url: string) => boolean;
  hasValueSet: (url: string) => boolean;
  hasCore: boolean;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value && typeof value === "object" && !Array.isArray(value));

const stringUrl = (value: unknown): string | undefined =>
  typeof value === "string" && value.trim() ? value : undefined;

const canonicalTail = (url: string): string => {
  const seg = url.split("|")[0].split("/").filter(Boolean).pop();
  return seg ?? url;
};

const collectElements = (content: Record<string, unknown>): Record<string, unknown>[] => {
  const out: Record<string, unknown>[] = [];
  for (const key of ["differential", "snapshot"] as const) {
    const section = content[key];
    if (isRecord(section) && Array.isArray(section.element)) {
      for (const el of section.element) if (isRecord(el)) out.push(el);
    }
  }
  return out;
};

/** Mutable accumulator that the per-resource processors write into. */
class Accumulator {
  nodes = new Map<string, ProjectGraphNode>();
  edges: ProjectEdge[] = [];
  issues: ProjectIssue[] = [];
  usedBy: Record<string, string[]> = {};
  private edgeSet = new Set<string>();

  constructor(
    private readonly authoredByUrl: Map<string, AuthoredResource>,
    private readonly resolvers: CanonicalResolvers
  ) {}

  ensureNode(node: ProjectGraphNode) {
    if (!this.nodes.has(node.id)) this.nodes.set(node.id, node);
  }

  addEdge(from: string, to: string, kind: ProjectEdgeKind) {
    const sig = `${from}|${to}|${kind}`;
    if (this.edgeSet.has(sig)) return;
    this.edgeSet.add(sig);
    this.edges.push({ from, to, kind });
  }

  issue(severity: IssueSeverity, code: string, message: string, resourceId?: string) {
    this.issues.push({ severity, code, message, resourceId });
  }

  private recordUsedBy(targetResourceId: string, sourceResourceId: string) {
    const list = this.usedBy[targetResourceId] ?? [];
    if (!list.includes(sourceResourceId)) list.push(sourceResourceId);
    this.usedBy[targetResourceId] = list;
  }

  /** Resolve a referenced canonical to a node id + whether it is known. */
  link(from: AuthoredResource, url: string, kind: ProjectEdgeKind, nodeKind: ProjectNodeKind, resolveAs: "sd" | "vs") {
    const authored = this.authoredByUrl.get(url);
    const resolved = authored
      ? true
      : resolveAs === "sd"
        ? this.resolvers.hasStructureDefinition(url)
        : this.resolvers.hasValueSet(url);
    this.ensureNode({
      id: url,
      kind: authored ? nodeKind : "external",
      label: canonicalTail(url),
      url,
      resourceId: authored?.id,
    });
    this.addEdge(nodeIdFor(from), url, kind);
    if (authored) this.recordUsedBy(authored.id, from.id);
    return resolved;
  }
}

const nodeIdFor = (resource: AuthoredResource) =>
  stringUrl((resource.content as Record<string, unknown>).url) ?? `res:${resource.id}`;

const processProfileLike = (resource: AuthoredResource, acc: Accumulator) => {
  const content = resource.content as Record<string, unknown>;
  const baseDefinition = stringUrl(content.baseDefinition);
  if (baseDefinition) {
    const resolved = acc.link(resource, baseDefinition, "derives", resource.kind, "sd");
    if (!resolved) {
      acc.issue(
        "error",
        "base-unresolved",
        `${resourceLabel(resource)}: Basisdefinition ${canonicalTail(baseDefinition)} ist nicht auflösbar (fehlende Dependency?).`,
        resource.id
      );
    }
  }
  for (const el of collectElements(content)) {
    processElement(resource, el, acc);
  }
};

const processElement = (resource: AuthoredResource, el: Record<string, unknown>, acc: Accumulator) => {
  const binding = el.binding;
  if (isRecord(binding)) {
    const vs = stringUrl(binding.valueSet);
    if (vs) {
      const resolved = acc.link(resource, vs, "binds", "valueset", "vs");
      if (!resolved) {
        acc.issue(
          "warning",
          "binding-unresolved",
          `${resourceLabel(resource)}: gebundenes ValueSet ${canonicalTail(vs)} ist nicht auflösbar.`,
          resource.id
        );
      }
    }
  }
  const types = el.type;
  if (!Array.isArray(types)) return;
  for (const type of types) {
    if (!isRecord(type) || type.code !== "Extension" || !Array.isArray(type.profile)) continue;
    for (const extUrl of type.profile) {
      const s = stringUrl(extUrl);
      if (s) acc.link(resource, s, "extends", "extension", "sd");
    }
  }
};

const processValueSet = (resource: AuthoredResource, acc: Accumulator) => {
  const compose = (resource.content as Record<string, unknown>).compose;
  if (!isRecord(compose) || !Array.isArray(compose.include)) return;
  for (const include of compose.include) {
    if (!isRecord(include)) continue;
    const system = stringUrl(include.system);
    if (system) acc.link(resource, system, "includes", "codesystem", "sd");
  }
};

const processExample = (resource: AuthoredResource, acc: Accumulator) => {
  const meta = (resource.content as Record<string, unknown>).meta;
  const profile = isRecord(meta) && Array.isArray(meta.profile) ? stringUrl(meta.profile[0]) : undefined;
  if (!profile) return;
  const resolved = acc.link(resource, profile, "conforms", "profile", "sd");
  if (!resolved) {
    acc.issue(
      "warning",
      "example-profile-unresolved",
      `${resourceLabel(resource)}: Profil ${canonicalTail(profile)} ist nicht auflösbar.`,
      resource.id
    );
  }
};

/**
 * Static, side-effect-free analysis of a project's building blocks: graph nodes
 * and edges (derives / conforms / binds / includes / extends), consistency
 * issues, and a used-by index. Resolution against imported packages is provided
 * via {@link CanonicalResolvers} so this stays pure and unit-testable.
 */
export const analyzeProject = ({
  manifest,
  resources,
  resolvers,
}: {
  manifest: PackageManifest;
  resources: AuthoredResource[];
  resolvers: CanonicalResolvers;
}): ProjectAnalysis => {
  const counts: Record<AuthoredResourceKind, number> = {
    profile: 0,
    extension: 0,
    valueset: 0,
    codesystem: 0,
    example: 0,
  };

  const authoredByUrl = new Map<string, AuthoredResource>();
  for (const resource of resources) {
    const url = stringUrl((resource.content as Record<string, unknown>).url);
    if (url) authoredByUrl.set(url, resource);
  }

  const acc = new Accumulator(authoredByUrl, resolvers);
  const canonicalBase = manifest.canonical?.replace(/\/+$/, "");
  const seenUrls = new Map<string, number>();

  for (const resource of resources) {
    counts[resource.kind] += 1;
    const content = resource.content as Record<string, unknown>;
    const url = stringUrl(content.url);
    acc.ensureNode({
      id: nodeIdFor(resource),
      kind: resource.kind,
      label: resourceLabel(resource),
      url,
      resourceId: resource.id,
    });
    if (url) {
      seenUrls.set(url, (seenUrls.get(url) ?? 0) + 1);
      if (canonicalBase && !url.startsWith(canonicalBase)) {
        acc.issue(
          "warning",
          "canonical-mismatch",
          `${resourceLabel(resource)}: URL passt nicht zur Canonical-Basis (${canonicalBase}).`,
          resource.id
        );
      }
    }
  }

  for (const resource of resources) {
    if (resource.kind === "profile" || resource.kind === "extension") processProfileLike(resource, acc);
    else if (resource.kind === "valueset") processValueSet(resource, acc);
    else if (resource.kind === "example") processExample(resource, acc);
  }

  for (const [url, count] of seenUrls) {
    if (count > 1) {
      acc.issue("error", "duplicate-canonical", `Canonical-URL wird von ${count} Ressourcen verwendet: ${url}`);
    }
  }
  if (!resolvers.hasCore && resources.length > 0) {
    acc.issue(
      "warning",
      "missing-core",
      "hl7.fhir.r4.core ist nicht als Abhängigkeit importiert — Profile/Bindings können nicht vollständig validiert werden."
    );
  }

  return {
    counts,
    nodes: Array.from(acc.nodes.values()),
    edges: acc.edges,
    issues: acc.issues,
    usedBy: acc.usedBy,
  };
};
