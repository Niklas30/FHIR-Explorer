"use client";

import { useMemo } from "react";
import { cn } from "@/lib/utils";
import type { DependencyGraph } from "@/lib/fhir-importer/dependency-graph";

export type GraphNodeKind = "target" | "package" | "missing";

export type DependencyGraphLabels = {
  target: string;
  resolved: string;
  missing: string;
  add: string;
  empty: string;
};

type LayoutNode = {
  key: string;
  kind: GraphNodeKind;
  title: string;
  subtitle: string;
  dependencyId?: string;
  requirement?: string;
  depth: number;
  x: number;
  y: number;
};

type LayoutEdge = {
  id: string;
  fromKey: string;
  toKey: string;
  label: string;
  resolved: boolean;
  path: string;
};

type Layout = {
  nodes: LayoutNode[];
  edges: LayoutEdge[];
  width: number;
  height: number;
};

const NODE_W = 220;
const NODE_H = 66;
const COL_GAP = 36;
const ROW_GAP = 128;
const PAD = 16;

const truncate = (value: string, max = 30) =>
  value.length > max ? `${value.slice(0, max - 1)}…` : value;

const buildLayout = (graph: DependencyGraph, rootKey: string | null): Layout | null => {
  if (!rootKey) return null;

  const nodes = new Map<string, LayoutNode>();
  const edges: LayoutEdge[] = [];

  const rootPkg = graph.byKey.get(rootKey);
  nodes.set(rootKey, {
    key: rootKey,
    kind: "target",
    title: rootPkg?.manifest.title ?? rootPkg?.manifest.name ?? rootPkg?.id ?? rootKey,
    subtitle: rootKey,
    depth: 0,
    x: 0,
    y: 0,
  });

  // BFS over resolved packages; missing dependencies become leaf nodes.
  const visited = new Set<string>();
  const queue = [rootKey];
  while (queue.length > 0) {
    const currentKey = queue.shift();
    if (!currentKey || visited.has(currentKey)) continue;
    visited.add(currentKey);
    const parent = nodes.get(currentKey);
    if (!parent) continue;

    const outgoing = [...(graph.adjacency.get(currentKey) ?? [])].sort((a, b) =>
      a.dependencyId.localeCompare(b.dependencyId)
    );

    for (const edge of outgoing) {
      const childKey = edge.toKey;
      const childPkg = edge.resolved ? graph.byKey.get(childKey) : undefined;
      const existing = nodes.get(childKey);
      const depth = parent.depth + 1;

      if (existing) {
        existing.depth = Math.max(existing.depth, depth);
      } else if (childPkg) {
        nodes.set(childKey, {
          key: childKey,
          kind: "package",
          title: childPkg.manifest.title ?? childPkg.manifest.name ?? childPkg.id,
          subtitle: childKey,
          depth,
          x: 0,
          y: 0,
        });
      } else {
        nodes.set(childKey, {
          key: childKey,
          kind: "missing",
          title: edge.dependencyId,
          subtitle: edge.requirement,
          dependencyId: edge.dependencyId,
          requirement: edge.requirement,
          depth,
          x: 0,
          y: 0,
        });
      }

      edges.push({
        id: `${currentKey}->${childKey}`,
        fromKey: currentKey,
        toKey: childKey,
        label: edge.requirement,
        resolved: edge.resolved,
        path: "",
      });

      if (childPkg && !visited.has(childKey)) queue.push(childKey);
    }
  }

  // Assign coordinates: one row per depth, nodes spread horizontally.
  const byDepth = new Map<number, LayoutNode[]>();
  for (const node of nodes.values()) {
    const list = byDepth.get(node.depth) ?? [];
    list.push(node);
    byDepth.set(node.depth, list);
  }
  const maxDepth = Math.max(...byDepth.keys());
  let maxRowWidth = 0;
  for (const list of byDepth.values()) {
    list.sort((a, b) => (a.kind === "missing" ? 1 : 0) - (b.kind === "missing" ? 1 : 0) || a.title.localeCompare(b.title));
    maxRowWidth = Math.max(maxRowWidth, list.length * NODE_W + (list.length - 1) * COL_GAP);
  }
  const width = maxRowWidth + PAD * 2;

  for (const [depth, list] of byDepth) {
    const rowWidth = list.length * NODE_W + (list.length - 1) * COL_GAP;
    const startX = PAD + (maxRowWidth - rowWidth) / 2;
    list.forEach((node, index) => {
      node.x = startX + index * (NODE_W + COL_GAP);
      node.y = PAD + depth * ROW_GAP;
    });
  }

  for (const edge of edges) {
    const from = nodes.get(edge.fromKey);
    const to = nodes.get(edge.toKey);
    if (!from || !to) continue;
    const x1 = from.x + NODE_W / 2;
    const y1 = from.y + NODE_H;
    const x2 = to.x + NODE_W / 2;
    const y2 = to.y;
    const midY = (y1 + y2) / 2;
    edge.path = `M ${x1} ${y1} C ${x1} ${midY}, ${x2} ${midY}, ${x2} ${y2}`;
  }

  return {
    nodes: Array.from(nodes.values()),
    edges,
    width,
    height: PAD * 2 + maxDepth * ROW_GAP + NODE_H,
  };
};

export type DependencyGraphViewProps = {
  graph: DependencyGraph;
  rootKey: string | null;
  labels: DependencyGraphLabels;
  onResolveMissing?: (dependencyId: string, requirement: string) => void;
  className?: string;
};

export const DependencyGraphView = ({
  graph,
  rootKey,
  labels,
  onResolveMissing,
  className,
}: DependencyGraphViewProps) => {
  const layout = useMemo(() => buildLayout(graph, rootKey), [graph, rootKey]);

  if (!layout) {
    return (
      <p className="rounded-lg border border-foreground/10 bg-muted/20 px-4 py-6 text-center text-sm text-muted-foreground">
        {labels.empty}
      </p>
    );
  }

  const kindEyebrow: Record<GraphNodeKind, string> = {
    target: labels.target,
    package: labels.resolved,
    missing: labels.missing,
  };

  return (
    <div className={cn("overflow-auto rounded-lg border border-foreground/10 bg-muted/20 p-3", className)}>
      <svg
        viewBox={`0 0 ${layout.width} ${layout.height}`}
        width={layout.width}
        height={layout.height}
        role="img"
        className="mx-auto block max-w-none"
      >
        <defs>
          <marker
            id="dep-graph-arrow"
            viewBox="0 0 10 10"
            refX="9"
            refY="5"
            markerWidth="7"
            markerHeight="7"
            orient="auto-start-reverse"
          >
            <path d="M 0 0 L 10 5 L 0 10 z" className="fill-muted-foreground" />
          </marker>
          <marker
            id="dep-graph-arrow-missing"
            viewBox="0 0 10 10"
            refX="9"
            refY="5"
            markerWidth="7"
            markerHeight="7"
            orient="auto-start-reverse"
          >
            <path d="M 0 0 L 10 5 L 0 10 z" className="fill-destructive" />
          </marker>
        </defs>

        <g fill="none">
          {layout.edges.map((edge) => (
            <path
              key={edge.id}
              d={edge.path}
              className={cn("stroke-[1.5]", edge.resolved ? "stroke-muted-foreground/60" : "stroke-destructive/60")}
              strokeDasharray={edge.resolved ? undefined : "5 4"}
              markerEnd={edge.resolved ? "url(#dep-graph-arrow)" : "url(#dep-graph-arrow-missing)"}
            />
          ))}
        </g>

        {layout.edges.map((edge) => {
          const from = layout.nodes.find((n) => n.key === edge.fromKey);
          const to = layout.nodes.find((n) => n.key === edge.toKey);
          if (!from || !to || !edge.label) return null;
          const lx = (from.x + NODE_W / 2 + to.x + NODE_W / 2) / 2;
          const ly = (from.y + NODE_H + to.y) / 2 + 4;
          return (
            <text
              key={`label-${edge.id}`}
              x={lx}
              y={ly}
              textAnchor="middle"
              className="fill-muted-foreground text-[11px] font-medium"
              style={{ paintOrder: "stroke", stroke: "var(--muted)", strokeWidth: 6 }}
            >
              {edge.label}
            </text>
          );
        })}

        {layout.nodes.map((node) => {
          const isMissing = node.kind === "missing";
          const isTarget = node.kind === "target";
          const interactive = isMissing && Boolean(onResolveMissing);
          return (
            <g
              key={node.key}
              transform={`translate(${node.x}, ${node.y})`}
              className={cn("group", interactive && "cursor-pointer")}
              role={interactive ? "button" : undefined}
              tabIndex={interactive ? 0 : undefined}
              aria-label={interactive ? `${labels.add}: ${node.dependencyId}@${node.requirement}` : undefined}
              onClick={
                interactive ? () => onResolveMissing?.(node.dependencyId!, node.requirement!) : undefined
              }
              onKeyDown={
                interactive
                  ? (event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        onResolveMissing?.(node.dependencyId!, node.requirement!);
                      }
                    }
                  : undefined
              }
            >
              <rect
                width={NODE_W}
                height={NODE_H}
                rx={12}
                className={cn(
                  "fill-background transition-colors",
                  isTarget && "stroke-primary",
                  node.kind === "package" && "stroke-foreground/25",
                  isMissing && "stroke-destructive group-hover:fill-destructive/5 group-focus-visible:fill-destructive/5"
                )}
                strokeWidth={isTarget ? 2 : 1.5}
              />
              <text
                x={16}
                y={25}
                className={cn(
                  "text-[10px] font-semibold uppercase tracking-wider",
                  isTarget && "fill-primary",
                  node.kind === "package" && "fill-muted-foreground",
                  isMissing && "fill-destructive"
                )}
              >
                {kindEyebrow[node.kind]}
              </text>
              <text x={16} y={45} className="fill-foreground text-[13px] font-semibold">
                {truncate(node.title, 26)}
              </text>
              <text x={16} y={59} className="fill-muted-foreground text-[10.5px]">
                {truncate(node.subtitle, 32)}
              </text>
              {interactive ? (
                <g transform={`translate(${NODE_W - 34}, 14)`}>
                  <circle cx={11} cy={11} r={11} className="fill-destructive/10" />
                  <path
                    d="M 11 6 L 11 16 M 6 11 L 16 11"
                    className="stroke-destructive"
                    strokeWidth={2}
                    strokeLinecap="round"
                  />
                </g>
              ) : null}
            </g>
          );
        })}
      </svg>
    </div>
  );
};
