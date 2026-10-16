import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "FHIR-Explorer",
    short_name: "FHIR-Explorer",
    description: "FHIR-Explorer for HL7 FHIR® projects, importing, and editing.",
    start_url: "/",
    display: "standalone",
    background_color: "#FFFFFF",
    theme_color: "#13161A",
    icons: [
      { src: "/brand/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/brand/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/brand/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
