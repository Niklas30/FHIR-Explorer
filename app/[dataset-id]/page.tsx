import { DatasetEditor } from "@/components/editor/DatasetEditor";

export default async function DatasetEditorPage({
  params,
}: {
  params: Promise<{ "dataset-id": string }>;
}) {
  const resolvedParams = await params;
  return <DatasetEditor datasetId={resolvedParams["dataset-id"]} />;
}
