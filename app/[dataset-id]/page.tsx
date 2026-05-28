import { DatasetEditor } from "@/components/editor/DatasetEditor";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "FHIR Explorer",
};

export default async function DatasetEditorPage({
  params,
}: {
  params: Promise<{ "dataset-id": string }>;
}) {
  const resolvedParams = await params;
  return <DatasetEditor datasetId={resolvedParams["dataset-id"]} />;
}
