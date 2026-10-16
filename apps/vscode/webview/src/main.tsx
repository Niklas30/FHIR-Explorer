import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "@webview/App";
import "@webview/theme.css";

const container = document.getElementById("root");
if (!container) throw new Error("Webview root element is missing.");

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>
);
