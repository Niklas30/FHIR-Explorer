import { StrictMode, useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { Button } from "@fhir-explorer/ui/ui/button";
import { Input } from "@fhir-explorer/ui/ui/input";
import { Label } from "@fhir-explorer/ui/ui/label";
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

type InitMessage = {
  type: "init";
  folders: WorkspaceFolder[];
  installed: InstalledPackage[];
  preset?: { basedOn?: Basis; canonicalHint?: string };
};

type VsCodeApi = { postMessage: (message: unknown) => void };
declare function acquireVsCodeApi(): VsCodeApi;
const vscode = acquireVsCodeApi();

const PACKAGE_ID = /^[a-z0-9]+(\.[a-z0-9-]+)+$/;
const FHIR_VERSIONS = ["4.0.1", "4.3.0", "5.0.0"];

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

  useEffect(() => {
    const listener = (event: MessageEvent<InitMessage>) => {
      if (event.data?.type !== "init") return;
      setInit(event.data);
      setFolder(event.data.folders[0]?.uri ?? "");
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
  const [canonicalTouched, setCanonicalTouched] = useState(false);
  useEffect(() => {
    if (canonicalTouched || !name) return;
    const base = init?.preset?.canonicalHint ?? "http://example.org/fhir";
    setCanonical(`${base.replace(/\/+$/, "")}/${name}`);
  }, [name, canonicalTouched, init]);

  const errors = useMemo(() => {
    const found: Record<string, string> = {};
    if (!PACKAGE_ID.test(name)) {
      found.name = "Lowercase, dot-separated, at least two segments (de.example.project)";
    }
    if (!/^\d+\.\d+\.\d+/.test(version)) found.version = "A semantic version, e.g. 0.1.0";
    if (canonical && !/^https?:\/\//.test(canonical)) {
      found.canonical = "Must be an http or https url";
    }
    if (!folder) found.folder = "Pick where the project folder is created";
    return found;
  }, [name, version, canonical, folder]);

  const valid = Object.keys(errors).length === 0;
  const show = (key: string) => (submitted ? errors[key] : undefined);

  if (!init) return <div className="p-6 text-sm text-muted-foreground">Loading…</div>;

  const basis = init.preset?.basedOn;

  const submit = () => {
    setSubmitted(true);
    if (!valid) return;
    vscode.postMessage({
      type: "create",
      value: {
        folder,
        name,
        version,
        title: title || undefined,
        description: description || undefined,
        canonical: canonical || undefined,
        fhirVersion,
        dependencies,
      },
    });
  };

  return (
    <div className="mx-auto max-w-2xl p-6">
      <h1 className="mb-1 text-lg font-semibold">New FHIR project</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        Creates a folder with a FHIR <code>package.json</code> and the IG Publisher
        input directories. Dependencies are installed right after.
      </p>

      {basis ? (
        <div className="mb-6 rounded-md border border-input p-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Built on
          </p>
          <p className="mt-1 text-sm font-medium">
            {basis.title ?? basis.id}{" "}
            <span className="text-muted-foreground">{basis.version}</span>
          </p>
          {Object.keys(basis.dependencies).length > 0 ? (
            <p className="mt-2 text-xs text-muted-foreground">
              Brings {Object.entries(basis.dependencies)
                .map(([id, dependencyVersion]) => `${id} ${dependencyVersion}`)
                .join(", ")}
              {" "}— installed with it, whether or not you add anything else.
            </p>
          ) : null}
        </div>
      ) : null}

      {init.folders.length > 1 && (
        <Field label="Workspace folder" error={show("folder")}>
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
          label="Package id"
          hint="Becomes the folder name and the published package name"
          error={show("name")}
        >
          <Input
            value={name}
            placeholder="de.example.project"
            onChange={(event) => setName(event.target.value.trim())}
            autoFocus
          />
        </Field>
        <Field label="Version" error={show("version")}>
          <Input value={version} onChange={(event) => setVersion(event.target.value)} />
        </Field>
      </div>

      <Field label="Title" hint="Human-readable name, optional">
        <Input
          value={title}
          placeholder="Example Implementation Guide"
          onChange={(event) => setTitle(event.target.value)}
        />
      </Field>

      <Field label="Description" hint="Optional">
        <Input
          value={description}
          onChange={(event) => setDescription(event.target.value)}
        />
      </Field>

      <div className="grid grid-cols-[2fr_1fr] gap-4">
        <Field
          label="Canonical URL"
          hint="Base for every canonical your resources define"
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
        <Field label="FHIR version">
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
        {basis ? "Additional dependencies" : "Dependencies"}
      </Label>
      <p className="mb-2 text-xs text-muted-foreground">
        {basis
          ? "Anything else this project should depend on, beyond what the package above already brings."
          : "Already-imported packages are listed. Anything not installed yet is fetched when the project is created."}
      </p>
      <div className="mb-6 rounded-md border border-input">
        {init.installed.length === 0 && dependencies.length === 0 ? (
          <p className="p-3 text-sm text-muted-foreground">
            Nothing imported yet — hl7.fhir.r4.core will be fetched.
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
                {installed ? "" : " · will be downloaded"}
              </span>
            </label>
          );
        })}
      </div>

      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={() => vscode.postMessage({ type: "cancel" })}>
          Cancel
        </Button>
        <Button onClick={submit}>Create project</Button>
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
