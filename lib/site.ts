/**
 * Zentrale Site-/SEO-Konfiguration für den FHIR-Explorer-Editor.
 *
 * `name` ist der Marken-/Anzeigename in Titeln und Social-Previews. Der Editor
 * ist Teil des FHIR-Explorer-Produkts (Website: https://www.fhir-explorer.de);
 * das Tool selbst läuft unter `url`. Zum Umbenennen genügt es, `name` hier zu
 * ändern – alle Metadaten, robots, sitemap und das Manifest lesen von hier.
 */
export const site = {
  name: "FHIR-Explorer",
  description:
    "FHIR-Ressourcen direkt im Browser importieren, verwalten und bearbeiten – mit profilgesteuerten Formularen, Live-Validierung und Abhängigkeitsgraphen. Local-first, ganz ohne Backend.",
  // Produktions-URL des Editors (siehe fhir-compose/CLAUDE.md).
  // Per Env überschreibbar, damit Preview-/Staging-Deployments korrekte
  // absolute URLs (canonical, OG, sitemap) erzeugen.
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "https://editor.fhir-explorer.com",
  locale: "de_DE",
  keywords: [
    "FHIR",
    "HL7 FHIR",
    "FHIR Editor",
    "FHIR Explorer",
    "StructureDefinition",
    "FHIR Profile",
    "FHIR Ressourcen",
    "FHIR Package",
    "Interoperabilität",
    "Gesundheitswesen",
  ],
} as const;
