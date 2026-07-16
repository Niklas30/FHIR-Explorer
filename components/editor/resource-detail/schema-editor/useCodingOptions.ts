"use client";

import { useEffect, useMemo, useState } from "react";
import type { CodingOption } from "@/lib/fhir-editor/registry";
import type { SchemaNode } from "@/lib/fhir-editor/schema";
import { expandValueSet, getTerminologyServerUrl } from "@/lib/fhir-editor/terminology";
import { useSchemaEditor } from "@/components/editor/resource-detail/schema-editor/context";
import { getCodingOptionsForNode } from "@/components/editor/resource-detail/schema-editor/helpers";

const NO_OPTIONS: CodingOption[] = [];

/**
 * Coding options for a node: locally resolvable options win; when the
 * imported packages cannot expand the bound ValueSet and a terminology
 * server is configured, its $expand result fills the gap asynchronously.
 */
export const useCodingOptions = (node: SchemaNode): CodingOption[] => {
  const { ctx } = useSchemaEditor();
  const localOptions = useMemo(() => getCodingOptionsForNode(node, ctx), [node, ctx]);
  const [remoteOptions, setRemoteOptions] = useState<CodingOption[]>(NO_OPTIONS);

  const valueSet = node.binding?.valueSet;

  useEffect(() => {
    setRemoteOptions(NO_OPTIONS);
    if (localOptions.length > 0 || !valueSet) return;
    const serverUrl = getTerminologyServerUrl();
    if (!serverUrl) return;

    let active = true;
    expandValueSet(serverUrl, valueSet).then((options) => {
      if (active) setRemoteOptions(options);
    });
    return () => {
      active = false;
    };
  }, [localOptions, valueSet]);

  return localOptions.length > 0 ? localOptions : remoteOptions;
};
