import type { DependencyGraph } from "@/lib/fhir-importer/dependency-graph";

export type DependencyMermaidText = {
  noProjectSelected: string;
  noDependencies: string;
  projectNotImported: string;
};

const sanitizeLabel = (value: string) =>
  value.replace(/"/g, "'").replace(/\\n/g, " ").replace(/\\r/g, " ");

/**
 * Builds a Mermaid `flowchart` definition for the dependency closure rooted at
 * `rootProjectKey`. Resolved packages, the root, and still-missing dependencies
 * are styled distinctly. Shared by the inline importer graph and the full-screen
 * dependency tree dialog so both stay visually consistent.
 */
export const buildDependencyMermaid = (
  graph: DependencyGraph,
  rootProjectKey: string | null,
  text: DependencyMermaidText
): { diagram: string; rootLabel: string } => {
  if (!rootProjectKey) {
    return {
      diagram: `flowchart TD\n  empty["${sanitizeLabel(text.noProjectSelected)}"]:::note`,
      rootLabel: text.noProjectSelected,
    };
  }

  const rootProject = graph.byKey.get(rootProjectKey);
  if (!rootProject) {
    return {
      diagram: [
        "flowchart TD",
        "  classDef missing fill:#fef2f2,stroke:#ef4444,color:#7f1d1d;",
        `  root["${sanitizeLabel(rootProjectKey)}\\n${sanitizeLabel(text.projectNotImported)}"]:::missing`,
      ].join("\n"),
      rootLabel: rootProjectKey,
    };
  }

  const rootLabel =
    rootProject.manifest.title ??
    rootProject.manifest.name ??
    rootProject.id ??
    rootProject.key;

  const nodeIds = new Map<string, string>();
  const nodeClasses = new Map<string, "root" | "package" | "missing" | "note">();
  const nodeLabels: string[] = [];
  const edgeLines = new Set<string>();

  const ensureNode = (
    key: string,
    label: string,
    nodeClass: "root" | "package" | "missing" | "note"
  ) => {
    const existing = nodeIds.get(key);
    if (existing) return existing;
    const nodeId = `node_${nodeIds.size}`;
    nodeIds.set(key, nodeId);
    nodeClasses.set(nodeId, nodeClass);
    nodeLabels.push(`${nodeId}["${sanitizeLabel(label)}"]`);
    return nodeId;
  };

  const formatProjectLabel = (projectKey: string) => {
    const pkg = graph.byKey.get(projectKey);
    if (!pkg) return projectKey;
    const title = pkg.manifest.title ?? pkg.manifest.name ?? pkg.id;
    return `${title}\\n${pkg.key}`;
  };

  const rootNode = ensureNode(rootProjectKey, formatProjectLabel(rootProjectKey), "root");
  const visited = new Set<string>();
  const queue = [rootProjectKey];

  while (queue.length > 0) {
    const currentKey = queue.shift();
    if (!currentKey || visited.has(currentKey)) continue;
    visited.add(currentKey);

    const fromNode = nodeIds.get(currentKey);
    if (!fromNode) continue;

    const edges = [...(graph.adjacency.get(currentKey) ?? [])].sort((a, b) => {
      const idCompare = a.dependencyId.localeCompare(b.dependencyId);
      if (idCompare !== 0) return idCompare;
      return a.toKey.localeCompare(b.toKey);
    });

    for (const edge of edges) {
      const targetProject = edge.resolved ? graph.byKey.get(edge.toKey) : undefined;
      const targetLabel = targetProject
        ? formatProjectLabel(edge.toKey)
        : `${edge.dependencyId}@${edge.requirement}`;
      const targetNode = ensureNode(
        edge.toKey,
        targetLabel,
        targetProject ? "package" : "missing"
      );
      edgeLines.add(`${fromNode} -->|${sanitizeLabel(edge.requirement)}| ${targetNode}`);

      if (targetProject && !visited.has(edge.toKey)) {
        queue.push(edge.toKey);
      }
    }
  }

  if (edgeLines.size === 0) {
    const noteNode = ensureNode("note:empty", text.noDependencies, "note");
    edgeLines.add(`${rootNode} --> ${noteNode}`);
  }

  const classAssignments = Array.from(nodeClasses.entries()).map(
    ([nodeId, nodeClass]) => `  class ${nodeId} ${nodeClass};`
  );

  const diagram = [
    "flowchart TD",
    "  classDef root fill:#eff6ff,stroke:#2563eb,color:#1e3a8a;",
    "  classDef package fill:#f8fafc,stroke:#334155,color:#0f172a;",
    "  classDef missing fill:#fef2f2,stroke:#ef4444,color:#7f1d1d;",
    "  classDef note fill:#fffbeb,stroke:#f59e0b,color:#78350f;",
    ...nodeLabels.map((line) => `  ${line}`),
    ...Array.from(edgeLines).map((line) => `  ${line}`),
    ...classAssignments,
  ].join("\n");

  return { diagram, rootLabel };
};
