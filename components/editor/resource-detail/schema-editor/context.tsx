"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { DatasetResource } from "@/lib/datasets/content";
import type { SchemaContext, SchemaTree } from "@/lib/fhir-editor/schema";
import type { ValidationIssue } from "@/lib/fhir-editor/schema";

export type SchemaEditorContextValue = {
  ctx: SchemaContext;
  tree: SchemaTree;
  datasetResources: DatasetResource[];
  referenceIndex: Set<string>;
  validationIssues: ValidationIssue[];
  onSelectResource: (resourceId: string) => void;
};

const SchemaEditorReactContext = createContext<SchemaEditorContextValue | null>(null);

export const SchemaEditorProvider = ({
  value,
  children,
}: {
  value: SchemaEditorContextValue;
  children: ReactNode;
}) => (
  <SchemaEditorReactContext.Provider value={value}>
    {children}
  </SchemaEditorReactContext.Provider>
);

export const useSchemaEditor = () => {
  const value = useContext(SchemaEditorReactContext);
  if (!value) {
    throw new Error("useSchemaEditor must be used within a SchemaEditorProvider");
  }
  return value;
};

/** Maximum recursion depth before the editor falls back to raw JSON. */
export const MAX_EDITOR_DEPTH = 10;
