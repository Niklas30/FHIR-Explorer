import * as vscode from "vscode";
import { ImporterClient } from "@fhir-explorer/core/fhir-importer/client";
import { FhirPackageRegistry } from "@fhir-explorer/core/fhir-importer/registry";
import { buildPackageKey } from "@fhir-explorer/core/fhir-importer/utils";
import type { ImportProgress } from "@fhir-explorer/core/fhir-importer/types";
import { GlobalPackageStore } from "@/adapters/global-package-store";
import { hostPackageParser } from "@/adapters/host-package-parser";
import { nodeHttpClient } from "@/adapters/node-http-client";
import {
  listCachedPackages,
  readCachedPackage,
  type CachedPackage,
} from "@/adapters/fhir-home-cache";

type QuickPickPackage = vscode.QuickPickItem & {
  cached?: CachedPackage;
};

const configuration = () => vscode.workspace.getConfiguration("fhirExplorer");

const buildClient = (store: GlobalPackageStore): ImporterClient => {
  const baseUrl =
    configuration().get<string>("registry.baseUrl") ??
    "https://packages2.fhir.org/packages";
  return new ImporterClient({
    store,
    parser: hostPackageParser,
    registry: new FhirPackageRegistry("Configured registry", baseUrl),
  });
};

/**
 * Offer whatever is already in `~/.fhir/packages` first — on a real FHIR
 * workstation that is most of what the user needs, and it makes the common
 * case instant and offline.
 */
const pickPackage = async (): Promise<
  { cached: CachedPackage } | { id: string; version: string } | undefined
> => {
  const useFhirHome = configuration().get<boolean>("packageCache.useFhirHome") ?? true;
  const cached = useFhirHome ? await listCachedPackages() : [];

  const items: QuickPickPackage[] = [
    {
      label: "$(cloud-download) Download from registry…",
      detail: "Enter a package id and version",
      alwaysShow: true,
    },
    ...(cached.length > 0
      ? [
          {
            label: "Local FHIR package cache",
            kind: vscode.QuickPickItemKind.Separator,
          } as QuickPickPackage,
        ]
      : []),
    ...cached.map((entry) => ({
      label: `$(package) ${entry.id}`,
      description: entry.version,
      detail: entry.folder.fsPath,
      cached: entry,
    })),
  ];

  const picked = await vscode.window.showQuickPick(items, {
    title: "Import FHIR Package",
    placeHolder: cached.length
      ? "Pick a cached package or download one"
      : "No packages in ~/.fhir/packages — download one",
    matchOnDescription: true,
  });
  if (!picked) return undefined;
  if (picked.cached) return { cached: picked.cached };

  const id = await vscode.window.showInputBox({
    title: "Import FHIR Package (1/2)",
    prompt: "Package id",
    placeHolder: "hl7.fhir.r4.core",
    ignoreFocusOut: true,
    validateInput: (value) =>
      value.trim().length === 0 ? "A package id is required" : undefined,
  });
  if (!id) return undefined;

  const version = await vscode.window.showInputBox({
    title: "Import FHIR Package (2/2)",
    prompt: `Version of ${id.trim()}`,
    placeHolder: "4.0.1",
    ignoreFocusOut: true,
    validateInput: (value) =>
      value.trim().length === 0 ? "A version is required" : undefined,
  });
  if (!version) return undefined;

  return { id: id.trim(), version: version.trim() };
};

const describe = (progress: ImportProgress): string => {
  const message = progress.message ?? progress.phase;
  return progress.percent === undefined
    ? message
    : `${message} (${Math.round(progress.percent * 100)}%)`;
};

export const importPackageCommand = async (
  context: vscode.ExtensionContext,
  onImported: () => void
): Promise<void> => {
  const selection = await pickPackage();
  if (!selection) return;

  const store = new GlobalPackageStore(context.globalStorageUri);
  const client = buildClient(store);

  const label =
    "cached" in selection
      ? `${selection.cached.id}@${selection.cached.version}`
      : buildPackageKey(selection.id, selection.version);

  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: `Importing ${label}`,
      cancellable: false,
    },
    async (progress) => {
      const report = (update: ImportProgress) =>
        progress.report({ message: describe(update) });

      try {
        const result =
          "cached" in selection
            ? await client.importParsed(
                await readCachedPackage(selection.cached, (percent) =>
                  progress.report({
                    message: `Reading local cache (${Math.round(percent * 100)}%)`,
                  })
                ),
                report
              )
            : await (async () => {
                const url = client.getDownloadUrl(selection.id, selection.version);
                progress.report({ message: `Downloading from ${url}` });
                const buffer = await nodeHttpClient.getArrayBuffer(url);
                return await client.importPackageBuffer(buffer, report);
              })();

        await client.addImportHistory(result.packageKey);
        onImported();

        const verb = result.status === "duplicate" ? "Already imported" : "Imported";
        const { missing } = (await client.loadSnapshot()).dependencyState;

        if (missing.length === 0) {
          vscode.window.showInformationMessage(`${verb} ${result.packageKey}.`);
          return;
        }

        // Dependencies are what makes an IG usable — surface them with the
        // next action attached instead of leaving the user to notice later.
        const answer = await vscode.window.showWarningMessage(
          `${verb} ${result.packageKey}. Missing ${missing.length} ${
            missing.length === 1 ? "dependency" : "dependencies"
          }: ${missing
            .map((entry) => `${entry.id}@${entry.exactVersion ?? entry.ranges.join("|")}`)
            .join(", ")}`,
          "Import dependency"
        );
        if (answer === "Import dependency") {
          await importPackageCommand(context, onImported);
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        vscode.window.showErrorMessage(`Import of ${label} failed: ${message}`);
      }
    }
  );
};
