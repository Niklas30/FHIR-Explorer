import { Suspense } from "react";
import { ImportWizard } from "@/components/importer/ImportWizard";

export default function ImporterPage() {
  return (
    <Suspense fallback={null}>
      <ImportWizard />
    </Suspense>
  );
}
