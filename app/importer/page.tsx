import type { Metadata } from "next";
import { Suspense } from "react";

import { ImporterLoadingFallback } from "@/components/importer/ImporterLoadingFallback";
import { ImportWizard } from "@/components/importer/ImportWizard";

export const metadata: Metadata = {
  title: "FHIR Compose",
};

export default function ImporterPage() {
  return (
    <Suspense fallback={<ImporterLoadingFallback />}>
      <ImportWizard />
    </Suspense>
  );
}
