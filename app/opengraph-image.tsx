import { ImageResponse } from "next/og";

import { site } from "@/lib/site";

export const alt = `${site.name} – FHIR-Ressourcen im Browser bearbeiten`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "80px",
          background: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)",
          color: "#f8fafc",
          fontFamily: "sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "20px",
            fontSize: "34px",
            fontWeight: 600,
            color: "#38bdf8",
            letterSpacing: "-0.01em",
          }}
        >
          <div
            style={{
              width: "56px",
              height: "56px",
              borderRadius: "14px",
              background: "#38bdf8",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#0f172a",
              fontSize: "34px",
              fontWeight: 800,
            }}
          >
            F
          </div>
          {site.name}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              fontSize: "68px",
              fontWeight: 700,
              lineHeight: 1.1,
              letterSpacing: "-0.02em",
            }}
          >
            <span>FHIR-Ressourcen im Browser</span>
            <span>importieren, verwalten &amp; bearbeiten</span>
          </div>
          <div style={{ fontSize: "30px", color: "#94a3b8", lineHeight: 1.3 }}>
            Profilgesteuerte Formulare · Live-Validierung · Local-first
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
