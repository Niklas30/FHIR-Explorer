import type {
  ProjectAnalysis,
  ProjectEdgeKind,
  ProjectNodeKind,
} from "@/lib/projects/analysis";

export type ProjectMermaidText = {
  empty: string;
  edgeDerives: string;
  edgeConforms: string;
  edgeBinds: string;
  edgeIncludes: string;
  edgeExtends: string;
};

const sanitizeLabel = (value: string) =>
  value.replace(/"/g, "'").replace(/\\n/g, " ").replace(/\\r/g, " ");

const NODE_CLASS: Record<ProjectNodeKind, string> = {
  profile: "profile",
  extension: "extension",
  valueset: "valueset",
  codesystem: "codesystem",
  example: "example",
  external: "external",
};

const edgeLabel = (kind: ProjectEdgeKind, text: ProjectMermaidText): string => {
  switch (kind) {
    case "derives":
      return text.edgeDerives;
    case "conforms":
      return text.edgeConforms;
    case "binds":
      return text.edgeBinds;
    case "includes":
      return text.edgeIncludes;
    case "extends":
      return text.edgeExtends;
    default:
      return "";
  }
};

/**
 * Builds a Mermaid `flowchart` of a project's building blocks and their
 * relationships from {@link analyzeProject} output. Node classes are styled per
 * kind (imported/external targets distinctly). Mirrors the style of
 * `buildDependencyMermaid`.
 */
export const buildProjectMermaid = (
  analysis: ProjectAnalysis,
  text: ProjectMermaidText
): string => {
  if (analysis.nodes.length === 0) {
    return `flowchart LR\n  empty["${sanitizeLabel(text.empty)}"]:::note`;
  }

  const nodeIds = new Map<string, string>();
  const nodeLines: string[] = [];
  const classLines: string[] = [];

  for (const node of analysis.nodes) {
    const nodeId = `n${nodeIds.size}`;
    nodeIds.set(node.id, nodeId);
    nodeLines.push(`  ${nodeId}["${sanitizeLabel(node.label)}"]`);
    classLines.push(`  class ${nodeId} ${NODE_CLASS[node.kind]};`);
  }

  const edgeLines: string[] = [];
  for (const edge of analysis.edges) {
    const from = nodeIds.get(edge.from);
    const to = nodeIds.get(edge.to);
    if (!from || !to) continue;
    const label = edgeLabel(edge.kind, text);
    edgeLines.push(label ? `  ${from} -->|${sanitizeLabel(label)}| ${to}` : `  ${from} --> ${to}`);
  }

  return [
    "flowchart LR",
    "  classDef profile fill:#eff6ff,stroke:#2563eb,color:#1e3a8a;",
    "  classDef extension fill:#f5f3ff,stroke:#7c3aed,color:#4c1d95;",
    "  classDef valueset fill:#ecfdf5,stroke:#059669,color:#064e3b;",
    "  classDef codesystem fill:#fefce8,stroke:#ca8a04,color:#713f12;",
    "  classDef example fill:#f8fafc,stroke:#334155,color:#0f172a;",
    "  classDef external fill:#f1f5f9,stroke:#94a3b8,color:#475569,stroke-dasharray:4 3;",
    "  classDef note fill:#fffbeb,stroke:#f59e0b,color:#78350f;",
    ...nodeLines,
    ...edgeLines,
    ...classLines,
  ].join("\n");
};
