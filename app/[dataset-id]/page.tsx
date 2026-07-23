import { DatasetEditor } from "@/components/editor/DatasetEditor";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Dataset-Editor",
  // Enthält lokale Nutzerdaten – nicht indexieren.
  robots: { index: false, follow: false },
};

export default async function DatasetEditorPage({
  params,
}: {
  params: Promise<{ "dataset-id": string }>;
}) {
  const resolvedParams = await params;
  return <DatasetEditor datasetId={resolvedParams["dataset-id"]} />;
}
