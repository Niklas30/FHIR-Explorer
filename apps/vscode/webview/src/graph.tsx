import { StrictMode, useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { buildDependencyGraph } from "@fhir-explorer/core/fhir-importer/dependency-graph";
import type { PackageRecord } from "@fhir-explorer/core/fhir-importer/types";
import { DependencyGraphView } from "@fhir-explorer/ui/graph/DependencyGraphView";
import { graphText, webviewLocale } from "@webview/text";
import "@webview/theme.css";

/**
 * The dependency closure, drawn.
 *
 * The view itself is the component the web app uses — plain SVG, no diagram
 * library, so nothing extra ends up in the bundle. What the extension adds is
 * that the nodes do something: clicking one that is missing starts its install.
 */

type GraphMessage = {
  type: "graph";
  packages: PackageRecord[];
  rootKey: string | null;
  rootLabel: string;
};

type VsCodeApi = {
  postMessage: (message: {
    type: "ready" | "resolveMissing";
    dependencyId?: string;
    requirement?: string;
  }) => void;
};

declare function acquireVsCodeApi(): VsCodeApi;
const vscode = acquireVsCodeApi();

const text = graphText(webviewLocale());

const App = () => {
  const [state, setState] = useState<GraphMessage | null>(null);

  useEffect(() => {
    const listener = (event: MessageEvent<GraphMessage>) => {
      if (event.data?.type === "graph") setState(event.data);
    };
    window.addEventListener("message", listener);
    vscode.postMessage({ type: "ready" });
    return () => window.removeEventListener("message", listener);
  }, []);

  // Maps do not survive the message channel, so the graph is rebuilt here from
  // the plain records rather than sent across as a structure.
  const graph = useMemo(
    () => (state ? buildDependencyGraph(state.packages) : null),
    [state]
  );

  if (!state || !graph) {
    return <div className="p-4 text-sm text-muted-foreground">{text.loading}</div>;
  }

  return (
    <div className="p-4">
      <h1 className="mb-1 text-base font-semibold">{state.rootLabel}</h1>
      <p className="mb-4 text-sm text-muted-foreground">
        {text.intro}
      </p>
      <DependencyGraphView
        graph={graph}
        rootKey={state.rootKey}
        labels={text.labels}
        onResolveMissing={(dependencyId, requirement) =>
          vscode.postMessage({ type: "resolveMissing", dependencyId, requirement })
        }
      />
    </div>
  );
};

const container = document.getElementById("root");
if (!container) throw new Error("Webview root element is missing.");

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>
);
