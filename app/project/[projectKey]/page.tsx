import type { Metadata } from "next";
import { ProjectEditor } from "@/components/project-editor/ProjectEditor";

export const metadata: Metadata = {
  title: "FHIR-Explorer",
};

export default async function ProjectEditorPage({
  params,
}: {
  params: Promise<{ projectKey: string }>;
}) {
  const resolvedParams = await params;
  return <ProjectEditor projectKey={decodeURIComponent(resolvedParams.projectKey)} />;
}
