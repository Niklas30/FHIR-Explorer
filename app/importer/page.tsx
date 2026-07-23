import type { Metadata } from "next";
import { Suspense } from "react";

import { ImporterLoadingFallback } from "@/components/importer/ImporterLoadingFallback";
import { ImportWizard } from "@/components/importer/ImportWizard";

export const metadata: Metadata = {
  title: "Importer",
  description:
    "FHIR-Packages inklusive Abhängigkeiten in den Browser importieren und als Projekt anlegen.",
  alternates: { canonical: "/importer" },
};

export default function ImporterPage() {
  return (
    <Suspense fallback={<ImporterLoadingFallback />}>
      <ImportWizard />
    </Suspense>
  );
}
