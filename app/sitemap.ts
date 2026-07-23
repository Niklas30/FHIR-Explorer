import type { MetadataRoute } from "next";

import { site } from "@/lib/site";

// Nur öffentlich indexierbare Einstiegsseiten. Dynamische Nutzer-Routen
// (Datasets, Projekte) und /devmode gehören nicht in die Sitemap.
const routes: { path: string; priority: number }[] = [
  { path: "/", priority: 1 },
  { path: "/importer", priority: 0.8 },
];

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  return routes.map(({ path, priority }) => ({
    url: new URL(path, site.url).toString(),
    lastModified: now,
    changeFrequency: "monthly",
    priority,
  }));
}
