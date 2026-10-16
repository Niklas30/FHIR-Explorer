"use client";

import { useEffect, useMemo, useState } from "react";
import type { CodingOption } from "@fhir-explorer/core/fhir-editor/registry";
import type { SchemaNode } from "@fhir-explorer/core/fhir-editor/schema";
import { expandValueSet } from "@fhir-explorer/core/fhir-editor/terminology";
import { useSchemaEditor } from "@fhir-explorer/ui/editor/resource-detail/schema-editor/context";
import { getCodingOptionsForNode } from "@fhir-explorer/ui/editor/resource-detail/schema-editor/helpers";
import { useTerminology } from "@fhir-explorer/ui/terminology/context";

const NO_OPTIONS: CodingOption[] = [];

/**
 * Coding options for a node: locally resolvable options win; when the
 * imported packages cannot expand the bound ValueSet and a terminology
 * server is configured, its $expand result fills the gap asynchronously.
 */
export const useCodingOptions = (node: SchemaNode): CodingOption[] => {
  const { ctx } = useSchemaEditor();
  const terminology = useTerminology();
  const localOptions = useMemo(() => getCodingOptionsForNode(node, ctx), [node, ctx]);
  const [remoteOptions, setRemoteOptions] = useState<CodingOption[]>(NO_OPTIONS);

  const valueSet = node.binding?.valueSet;
  const serverUrl = terminology?.serverUrl ?? null;
  const http = terminology?.http;

  useEffect(() => {
    setRemoteOptions(NO_OPTIONS);
    if (localOptions.length > 0 || !valueSet) return;
    if (!serverUrl || !http) return;

    let active = true;
    expandValueSet(http, serverUrl, valueSet).then((options) => {
      if (active) setRemoteOptions(options);
    });
    return () => {
      active = false;
    };
  }, [localOptions, valueSet, serverUrl, http]);

  return localOptions.length > 0 ? localOptions : remoteOptions;
};
