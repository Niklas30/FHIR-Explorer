import { StrictMode, useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { Button } from "@fhir-explorer/ui/ui/button";
import { Input } from "@fhir-explorer/ui/ui/input";
import { Label } from "@fhir-explorer/ui/ui/label";
import { fill, projectFormText, webviewLocale } from "@webview/text";
import "@webview/theme.css";

/**
 * Creating a project as one form instead of a chain of prompts.
 *
 * A QuickPick sequence hides the shape of what is being made: you answer four
 * questions blind, cannot go back, and never see the result until it exists.
 * A manifest has a handful of related fields — showing them together is what
 * lets someone check the canonical against the id before committing.
 */

type WorkspaceFolder = { name: string; uri: string };
type InstalledPackage = { key: string; id: string; version: string; title?: string };

/** The package this project is built on, when there is one. */
type Basis = {
  key: string;
  id: string;
  version: string;
  title?: string;
  fhirVersion?: string;
  dependencies: Record<string, string>;
};

/** Present when the form was opened on a project that already exists. */
type Editing = {
  name: string;
  version: string;
  title?: string;
  description?: string;
  canonical?: string;
  fhirVersion?: string;
  dependencies: Record<string, string>;
  manifestFile?: string;
  root: string;
};

/** Present when forking an imported package into an editable project. */
type Cloning = {
  sourceKey: string;
  sourceId: string;
  sourceVersion: string;
  sourceTitle?: string;
  defaults: {
    title?: string;
    description?: string;
    canonical?: string;
    fhirVersion?: string;
    dependencies: Record<string, string>;
  };
};

type InitMessage = {
  type: "init";
  folders: WorkspaceFolder[];
  installed: InstalledPackage[];
  preset?: { basedOn?: Basis; canonicalHint?: string };
  editing?: Editing;
  cloning?: Cloning;
};

type VsCodeApi = { postMessage: (message: unknown) => void };
declare function acquireVsCodeApi(): VsCodeApi;
const vscode = acquireVsCodeApi();

const PACKAGE_ID = /^[a-z0-9]+(\.[a-z0-9-]+)+$/;
const FHIR_VERSIONS = ["4.0.1", "4.3.0", "5.0.0"];
const text = projectFormText(webviewLocale());

const Field = ({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) => (
  <div className="mb-4">
    <Label className="mb-1 block text-sm font-medium">{label}</Label>
    {children}
    {error ? (
      <p className="mt-1 text-xs text-[var(--vscode-inputValidation-errorForeground,#f14c4c)]">
        {error}
      </p>
    ) : hint ? (
      <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
    ) : null}
  </div>
);

const App = () => {
  const [init, setInit] = useState<InitMessage | null>(null);
  const [name, setName] = useState("");
  const [version, setVersion] = useState("0.1.0");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [canonical, setCanonical] = useState("");
  const [fhirVersion, setFhirVersion] = useState("4.0.1");
  const [folder, setFolder] = useState("");
  const [dependencies, setDependencies] = useState<string[]>([]);
  const [submitted, setSubmitted] = useState(false);
  // Once the user edits the canonical — or the project already has one — it is
  // never derived from the id again.
  const [canonicalTouched, setCanonicalTouched] = useState(false);

  useEffect(() => {
    const listener = (event: MessageEvent<InitMessage>) => {
      if (event.data?.type !== "init") return;
      setInit(event.data);
      setFolder(event.data.folders[0]?.uri ?? "");

      const existing = event.data.editing;
      if (existing) {
        setName(existing.name);
        setVersion(existing.version);
        setTitle(existing.title ?? "");
        setDescription(existing.description ?? "");
        setCanonical(existing.canonical ?? "");
        setCanonicalTouched(true); // never derive over what the project already has
        if (existing.fhirVersion) setFhirVersion(existing.fhirVersion);
        setDependencies(
          Object.entries(existing.dependencies).map(([id, v]) => `${id}@${v}`)
        );
        return;
      }

      const clone = event.data.cloning;
      if (clone) {
        setName(`${clone.sourceId}.copy`);
        setVersion("0.1.0");
        setTitle(clone.defaults.title ? `${clone.defaults.title} (copy)` : "");
        setDescription(clone.defaults.description ?? "");
        setCanonical(clone.defaults.canonical ?? "");
        setCanonicalTouched(true);
        if (clone.defaults.fhirVersion) setFhirVersion(clone.defaults.fhirVersion);
        // The clone holds the source's resources, so it inherits what the
        // source needed — not the source itself.
        setDependencies(
          Object.entries(clone.defaults.dependencies).map(([id, v]) => `${id}@${v}`)
        );
        return;
      }

      const basis = event.data.preset?.basedOn;
      // With a basis, everything it needs is already implied; without one the
      // project still needs a core to validate against.
      setDependencies(basis ? [] : ["hl7.fhir.r4.core@4.0.1"]);
      if (basis?.fhirVersion) setFhirVersion(basis.fhirVersion);
    };
    window.addEventListener("message", listener);
    vscode.postMessage({ type: "ready" });
    return () => window.removeEventListener("message", listener);
  }, []);

  // The canonical follows the id unless the user takes it over, which is what
  // people do by hand anyway and gets it wrong half the time.
  useEffect(() => {
    if (canonicalTouched || !name) return;
    const base = init?.preset?.canonicalHint ?? "http://example.org/fhir";
    setCanonical(`${base.replace(/\/+$/, "")}/${name}`);
  }, [name, canonicalTouched, init]);

  const errors = useMemo(() => {
    const found: Record<string, string> = {};
    if (!PACKAGE_ID.test(name)) {
      found.name = text.errorName;
    }
    if (!/^\d+\.\d+\.\d+/.test(version)) found.version = text.errorVersion;
    if (canonical && !/^https?:\/\//.test(canonical)) {
      found.canonical = text.errorCanonical;
    }
    if (!folder) found.folder = text.errorFolder;
    return found;
  }, [name, version, canonical, folder]);

  const valid = Object.keys(errors).length === 0;
  const show = (key: string) => (submitted ? errors[key] : undefined);

  if (!init) return <div className="p-6 text-sm text-muted-foreground">{text.loading}</div>;

  const basis = init.preset?.basedOn;
  const editing = init.editing;
  const cloning = init.cloning;

  const submit = () => {
    setSubmitted(true);
    if (!valid) return;
    const shared = {
      version,
      title: title || undefined,
      description: description || undefined,
      canonical: canonical || undefined,
      fhirVersion,
      dependencies,
    };
    vscode.postMessage(
      editing
        ? { type: "save", value: shared }
        : { type: "create", value: { ...shared, folder, name } }
    );
  };

  return (
    <div className="mx-auto max-w-2xl p-6">
      <h1 className="mb-1 text-lg font-semibold">
        {editing
          ? editing.name
          : cloning
            ? fill(text.cloneTitle, { id: cloning.sourceId })
            : text.newTitle}
      </h1>
      <p className="mb-6 text-sm text-muted-foreground">
        {editing ? (
          fill(text.editingIntro, {
            file: <code>{editing.manifestFile ?? text.theManifest}</code>,
            root: <code>{editing.root}</code>,
          })
        ) : cloning ? (
          fill(text.cloningIntro, {
            package: (
              <code>
                {cloning.sourceId}@{cloning.sourceVersion}
              </code>
            ),
          })
        ) : (
          fill(text.newIntro, { file: <code>package.json</code> })
        )}
      </p>

      {basis ? (
        <div className="mb-6 rounded-md border border-input p-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {text.builtOn}
          </p>
          <p className="mt-1 text-sm font-medium">
            {basis.title ?? basis.id}{" "}
            <span className="text-muted-foreground">{basis.version}</span>
          </p>
          {Object.keys(basis.dependencies).length > 0 ? (
            <p className="mt-2 text-xs text-muted-foreground">
              {fill(text.brings, {
                list: Object.entries(basis.dependencies)
                  .map(([id, dependencyVersion]) => `${id} ${dependencyVersion}`)
                  .join(", "),
              })}
            </p>
          ) : null}
        </div>
      ) : null}

      {!editing && init.folders.length > 1 && (
        <Field label={text.workspaceFolder} error={show("folder")}>
          <select
            className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
            value={folder}
            onChange={(event) => setFolder(event.target.value)}
          >
            {init.folders.map((entry) => (
              <option key={entry.uri} value={entry.uri}>
                {entry.name}
              </option>
            ))}
          </select>
        </Field>
      )}

      <div className="grid grid-cols-[2fr_1fr] gap-4">
        <Field
          label={text.packageId}
          hint={
            editing
              ? text.packageIdEditingHint
              : text.packageIdHint
          }
          error={show("name")}
        >
          <Input
            value={name}
            placeholder="de.example.project"
            onChange={(event) => setName(event.target.value.trim())}
            disabled={Boolean(editing)}
            autoFocus={!editing}
          />
        </Field>
        <Field label={text.version} error={show("version")}>
          <Input value={version} onChange={(event) => setVersion(event.target.value)} />
        </Field>
      </div>

      <Field label={text.title} hint={text.titleHint}>
        <Input
          value={title}
          placeholder={text.titlePlaceholder}
          onChange={(event) => setTitle(event.target.value)}
        />
      </Field>

      <Field label={text.description} hint={text.optional}>
        <Input
          value={description}
          onChange={(event) => setDescription(event.target.value)}
        />
      </Field>

      <div className="grid grid-cols-[2fr_1fr] gap-4">
        <Field
          label={text.canonical}
          hint={text.canonicalHint}
          error={show("canonical")}
        >
          <Input
            value={canonical}
            onChange={(event) => {
              setCanonicalTouched(true);
              setCanonical(event.target.value.trim());
            }}
          />
        </Field>
        <Field label={text.fhirVersion}>
          <select
            className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
            value={fhirVersion}
            onChange={(event) => setFhirVersion(event.target.value)}
          >
            {FHIR_VERSIONS.map((entry) => (
              <option key={entry} value={entry}>
                {entry}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <Label className="mb-1 mt-2 block text-sm font-medium">
        {basis ? text.additionalDependencies : text.dependencies}
      </Label>
      <p className="mb-2 text-xs text-muted-foreground">
        {basis
          ? text.basisDependenciesHint
          : editing
            ? text.editingDependenciesHint
            : text.newDependenciesHint}
      </p>
      <div className="mb-6 rounded-md border border-input">
        {init.installed.length === 0 && dependencies.length === 0 ? (
          <p className="p-3 text-sm text-muted-foreground">
            {text.nothingImported}
          </p>
        ) : null}
        {[
          ...new Set([
            ...dependencies,
            ...init.installed.map((entry) => `${entry.id}@${entry.version}`),
          ]),
        ]
          // The basis and what it declares are not choices — offering them as
          // checkboxes would imply they can be dropped, and they cannot.
          .filter((key) => key !== basis?.key)
          .filter((key) => !(basis && key.split("@")[0] in basis.dependencies))
          .map((key) => {
          const installed = init.installed.find(
            (entry) => `${entry.id}@${entry.version}` === key
          );
          return (
            <label
              key={key}
              className="flex cursor-pointer items-center gap-3 border-b border-input px-3 py-2 last:border-b-0"
            >
              <input
                type="checkbox"
                checked={dependencies.includes(key)}
                onChange={(event) =>
                  setDependencies((current) =>
                    event.target.checked
                      ? [...current, key]
                      : current.filter((entry) => entry !== key)
                  )
                }
              />
              <span className="text-sm">{installed?.title ?? key.split("@")[0]}</span>
              <span className="ml-auto text-xs text-muted-foreground">
                {key.split("@")[1]}
                {installed ? "" : text.willDownload}
              </span>
            </label>
          );
        })}
      </div>

      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={() => vscode.postMessage({ type: "cancel" })}>
          {text.cancel}
        </Button>
        <Button onClick={submit}>
          {editing ? text.save : cloning ? text.clone : text.create}
        </Button>
      </div>
    </div>
  );
};

const container = document.getElementById("root");
if (!container) throw new Error("Webview root element is missing.");

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>
);
