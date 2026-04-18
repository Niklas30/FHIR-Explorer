import type { Metadata } from "next";
import { Suspense } from "react";

import { ImportWizard } from "@/components/importer/ImportWizard";

export const metadata: Metadata = {
  title: "Importer",
};

export default function ImporterPage() {
  return (
    <Suspense
      fallback={<div className="px-6 py-8 text-sm text-muted-foreground">Loading importer…</div>}
    >
      <ImportWizard />
    </Suspense>
  );
}
