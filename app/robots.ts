import type { MetadataRoute } from "next";

import { site } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Interne bzw. nutzer-spezifische Routen nicht crawlen. Die Dataset-Route
      // `/[dataset-id]` liegt auf oberster Ebene und kann hier nicht sauber von
      // `/importer` getrennt werden – sie ist zusätzlich per Page-Metadaten auf
      // `noindex` gesetzt.
      disallow: ["/devmode", "/project/"],
    },
    sitemap: new URL("/sitemap.xml", site.url).toString(),
    host: new URL(site.url).host,
  };
}
