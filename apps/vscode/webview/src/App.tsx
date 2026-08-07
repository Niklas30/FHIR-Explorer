import { useCallback, useEffect, useMemo, useState } from "react";
import { buildRegistry } from "@fhir-explorer/core/fhir-editor/registry";
import { resolveProfileForResource } from "@fhir-explorer/core/fhir-editor/profiles/resolve";
import {
  buildSchemaTree,
  createSchemaContext,
} from "@fhir-explorer/core/fhir-editor/schema";
import type { DatasetResource } from "@fhir-explorer/core/datasets/content";
import type { Locale } from "@fhir-explorer/core/i18n/types";
import {
  I18nContextProvider,
  ResourceDetailPanel,
  TerminologyProvider,
} from "@fhir-explorer/ui";
import { hostHttpClient, onHostMessage, resolveExpansion, vscode } from "@webview/host";

type State = {
  ready: boolean;
  content: Record<string, unknown>;
  registryPayloads: Parameters<typeof buildRegistry>[0];
  locale: Locale;
  terminologyServerUrl: string | null;
  references: Set<string>;
  documentVersion: number;
  error: string | null;
};

const EMPTY: State = {
  ready: false,
  content: {},
  registryPayloads: [],
  locale: "en",
  terminologyServerUrl: null,
  references: new Set(),
  documentVersion: 0,
  error: null,
};

/**
 * Value equality, not reference equality.
 *
 * The host echoes every document change back — an edit made in a text editor
 * split has to reach the form. Without this check the form would also receive
 * its own edits as a freshly parsed object, remount the field the user is
 * typing in and steal the caret.
 */
const sameValue = (a: unknown, b: unknown): boolean => {
  if (a === b) return true;
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
    return a.every((entry, index) => sameValue(entry, b[index]));
  }
  if (a && b && typeof a === "object" && typeof b === "object") {
    const left = a as Record<string, unknown>;
    const right = b as Record<string, unknown>;
    const keys = new Set([...Object.keys(left), ...Object.keys(right)]);
    for (const key of keys) if (!sameValue(left[key], right[key])) return false;
    return true;
  }
  return false;
};

const parse = (text: string): Record<string, unknown> | null => {
  try {
    const value: unknown = JSON.parse(text);
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
};

export const App = () => {
  const [state, setState] = useState<State>(EMPTY);

  useEffect(() => {
    const dispose = onHostMessage((message) => {
      if (message.type === "init") {
        const content = parse(message.text);
        setState({
          ready: true,
          content: content ?? {},
          registryPayloads: message.payloads,
          locale: message.locale,
          terminologyServerUrl: message.terminologyServerUrl,
          references: new Set(message.references),
          documentVersion: message.documentVersion,
          error: content ? null : "This file is not valid JSON. Edit it as text to fix it.",
        });
        return;
      }

      if (message.type === "documentChanged") {
        setState((previous) => {
          const content = parse(message.text);
          if (content && sameValue(content, previous.content)) {
            // Our own edit coming back; keep the object we already hold.
            return { ...previous, documentVersion: message.documentVersion, error: null };
          }
          return {
            ...previous,
            documentVersion: message.documentVersion,
            content: content ?? previous.content,
            error: content
              ? null
              : "This file is not valid JSON. Edit it as text to fix it.",
          };
        });
        return;
      }

      if (message.type === "terminologyExpansion") {
        resolveExpansion(message.requestId, {
          body: message.body,
          error: message.error,
        });
      }
    });

    vscode.postMessage({ type: "ready" });
    return dispose;
  }, []);

  const registry = useMemo(
    () => buildRegistry(state.registryPayloads),
    [state.registryPayloads]
  );
  const ctx = useMemo(() => createSchemaContext(registry), [registry]);
  const tree = useMemo(() => {
    const profile = resolveProfileForResource(state.content, registry);
    return profile ? buildSchemaTree(profile, ctx) : null;
  }, [state.content, registry, ctx]);

  const resource = useMemo<DatasetResource>(
    () => ({
      id: typeof state.content.id === "string" ? state.content.id : "resource",
      resourceType:
        typeof state.content.resourceType === "string"
          ? state.content.resourceType
          : "Resource",
      content: state.content,
      createdAt: 0,
      updatedAt: state.documentVersion,
    }),
    [state.content, state.documentVersion]
  );

  const handleUpdate = useCallback(
    (next: DatasetResource) => {
      setState((previous) => ({ ...previous, content: next.content }));
      vscode.postMessage({
        type: "edit",
        content: next.content,
        documentVersion: state.documentVersion,
      });
    },
    [state.documentVersion]
  );

  const i18n = useMemo(
    () => ({
      locale: state.locale,
      localeMode: state.locale,
      setLocale: () => {},
      setLocaleMode: () => {},
    }),
    [state.locale]
  );

  const terminology = useMemo(
    () => ({ serverUrl: state.terminologyServerUrl, http: hostHttpClient }),
    [state.terminologyServerUrl]
  );

  if (!state.ready) {
    return <div className="p-4 text-sm text-muted-foreground">Loading resource…</div>;
  }

  if (state.error) {
    return <div className="p-4 text-sm text-destructive">{state.error}</div>;
  }

  if (!tree) {
    return (
      <div className="p-4 text-sm text-muted-foreground">
        No StructureDefinition found for{" "}
        <code>{String(state.content.resourceType ?? "this resource")}</code>. Import the
        package that defines it, then reopen this file.
      </div>
    );
  }

  return (
    <I18nContextProvider value={i18n}>
      <TerminologyProvider value={terminology}>
        <div className="h-screen overflow-hidden">
          <ResourceDetailPanel
            resource={resource}
            schemaTree={tree}
            schemaCtx={ctx}
            datasetResources={[resource]}
            onSelectResource={() => {}}
            onUpdateResource={handleUpdate}
            onRemoveResource={() => {}}
          />
        </div>
      </TerminologyProvider>
    </I18nContextProvider>
  );
};
