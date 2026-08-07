"use client";

import { useEffect, useState } from "react";
import {
  evaluateInvariants,
  type SchemaTree,
  type ValidationIssue,
} from "@/lib/fhir-editor/schema";

const DEBOUNCE_MS = 400;

/**
 * Evaluates the profile's FHIRPath invariants against the current resource
 * content. Runs debounced and async because the fhirpath engine is loaded
 * lazily; results supplement the synchronous structural validation.
 */
export const useInvariantIssues = (
  content: Record<string, unknown> | null,
  tree: SchemaTree | null
): ValidationIssue[] => {
  const [issues, setIssues] = useState<ValidationIssue[]>([]);

  useEffect(() => {
    if (!content || !tree) {
      setIssues([]);
      return;
    }

    let active = true;
    const timer = window.setTimeout(() => {
      evaluateInvariants(content, tree).then((nextIssues) => {
        if (active) setIssues(nextIssues);
      });
    }, DEBOUNCE_MS);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [content, tree]);

  return issues;
};
