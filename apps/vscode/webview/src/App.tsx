import { useCallback, useEffect, useMemo, useState } from "react";
import {
  buildRegistry,
  getStructureDefinitionByCanonical,
} from "@fhir-explorer/core/fhir-editor/registry";
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
import { ProfileConstraintsPanel } from "@fhir-explorer/ui/editor/ProfileConstraintsPanel";
import { cn } from "@fhir-explorer/ui/lib/utils";
import { hostHttpClient, onHostMessage, resolveExpansion, vscode } from "@webview/host";

type State = {
  ready: boolean;
  content: Record<string, unknown>;
  registryPayloads: Parameters<typeof buildRegistry>[0];
  locale: Locale;
  terminologyServerUrl: string | null;
  references: Set<string>;
  valueSetOptions: { url: string; label: string }[];
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
  valueSetOptions: [],
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

type View = "constraints" | "form";

/** Same rule as the host: a StructureDefinition that constrains a base. */
const isConstraintProfile = (content: Record<string, unknown>): boolean =>
  content.resourceType === "StructureDefinition" &&
  content.derivation !== "specialization" &&
  typeof content.baseDefinition === "string";

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
  // A profile opens on its constraints: that is what authoring one means.
  // The form stays one click away for metadata like name, status and url.
  const [view, setView] = useState<View>("constraints");

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
          valueSetOptions: message.valueSetOptions,
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

  const handleContentChange = useCallback(
    (content: Record<string, unknown>) => {
      setState((previous) => ({ ...previous, content }));
      vscode.postMessage({
        type: "edit",
        content,
        documentVersion: state.documentVersion,
      });
    },
    [state.documentVersion]
  );

  const handleUpdate = useCallback(
    (next: DatasetResource) => handleContentChange(next.content),
    [handleContentChange]
  );

  const resolveStructureDefinition = useCallback(
    (canonical: string) => getStructureDefinitionByCanonical(registry, canonical) ?? null,
    [registry]
  );

  const isProfile = isConstraintProfile(state.content);

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

  const constraints = (
    <ProfileConstraintsPanel
      content={state.content}
      readOnly={false}
      schemaCtx={ctx}
      resolveStructureDefinition={resolveStructureDefinition}
      valueSetOptions={state.valueSetOptions}
      onContentChange={handleContentChange}
    />
  );

  const form = tree ? (
    <ResourceDetailPanel
      resource={resource}
      schemaTree={tree}
      schemaCtx={ctx}
      datasetResources={[resource]}
      onSelectResource={() => {}}
      onUpdateResource={handleUpdate}
      onRemoveResource={() => {}}
    />
  ) : null;

  // Without core's StructureDefinition for StructureDefinition there is no
  // form for the profile's own metadata, but its constraints still edit.
  if (isProfile && !form) {
    return (
      <I18nContextProvider value={i18n}>
        <div className="h-screen overflow-hidden">{constraints}</div>
      </I18nContextProvider>
    );
  }

  if (isProfile) {
    return (
      <I18nContextProvider value={i18n}>
        <TerminologyProvider value={terminology}>
          <div className="flex h-screen flex-col overflow-hidden">
            <div role="tablist" className="flex shrink-0 gap-1 border-b border-border px-3 pt-2">
              {(["constraints", "form"] as const).map((entry) => (
                <button
                  key={entry}
                  type="button"
                  role="tab"
                  aria-selected={view === entry}
                  onClick={() => setView(entry)}
                  className={cn(
                    "-mb-px border-b-2 px-3 py-1.5 text-sm",
                    view === entry
                      ? "border-primary text-foreground"
                      : "border-transparent text-muted-foreground hover:text-foreground"
                  )}
                >
                  {entry === "constraints" ? "Constraints" : "Form"}
                </button>
              ))}
            </div>
            <div className="min-h-0 flex-1">
              {view === "constraints" ? constraints : form}
            </div>
          </div>
        </TerminologyProvider>
      </I18nContextProvider>
    );
  }

  if (!form) {
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
        <div className="h-screen overflow-hidden">{form}</div>
      </TerminologyProvider>
    </I18nContextProvider>
  );
};
