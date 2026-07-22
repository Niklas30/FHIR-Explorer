/**
 * Shared Mermaid configuration so every diagram in the app (project
 * relationship map, dependency tree, dataset diagram) renders with the same
 * clean, card-like style used elsewhere — white/slate nodes with rounded
 * corners, soft curved edges and haloed edge labels — instead of Mermaid's
 * boxy default. Theme-aware (light/dark).
 */

type MermaidConfigOptions = {
  nodeSpacing: number;
  rankSpacing: number;
};

const LIGHT = {
  nodeBg: "#ffffff",
  nodeBorder: "#cbd5e1", // slate-300
  text: "#1e293b", // slate-800
  line: "#94a3b8", // slate-400
  labelBg: "#ffffff",
  clusterBg: "#f8fafc", // slate-50
};

const DARK = {
  nodeBg: "#0f172a", // slate-900
  nodeBorder: "#334155", // slate-700
  text: "#e2e8f0", // slate-200
  line: "#64748b", // slate-500
  labelBg: "#0b1220",
  clusterBg: "#0b1220",
};

const isDark = () =>
  typeof document !== "undefined" && document.documentElement.classList.contains("dark");

export const buildMermaidConfig = ({ nodeSpacing, rankSpacing }: MermaidConfigOptions) => {
  const p = isDark() ? DARK : LIGHT;
  return {
    startOnLoad: false,
    securityLevel: "strict" as const,
    theme: "base" as const,
    fontFamily: "inherit",
    themeVariables: {
      fontFamily: "inherit",
      primaryColor: p.nodeBg,
      primaryBorderColor: p.nodeBorder,
      primaryTextColor: p.text,
      lineColor: p.line,
      edgeLabelBackground: p.labelBg,
      tertiaryColor: p.labelBg,
      clusterBkg: p.clusterBg,
      clusterBorder: p.nodeBorder,
    },
    flowchart: {
      htmlLabels: false,
      curve: "basis" as const,
      nodeSpacing,
      rankSpacing,
      padding: 16,
      useMaxWidth: false,
    },
    themeCSS: `
      .node rect, .node polygon, .cluster rect { rx: 12px; ry: 12px; }
      .node rect { filter: drop-shadow(0 1px 2px rgba(15, 23, 42, 0.06)); }
      .edgePaths path { stroke-width: 1.5px; }
      .flowchart-link { stroke-width: 1.5px; }
      .nodeLabel { font-weight: 600; }
      .edgeLabel, .edgeLabel p { font-size: 11.5px; font-weight: 500; }
      .edgeLabel .label rect { fill-opacity: 0.85; }
      marker path { fill: ${p.line}; }
    `,
  };
};
