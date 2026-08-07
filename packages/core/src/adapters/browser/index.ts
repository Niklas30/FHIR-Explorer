/**
 * Browser implementations of the core ports: IndexedDB, localStorage, `fetch`
 * and Web Workers. The Next.js app wires itself up from here; the VS Code
 * extension will ship an `adapters/vscode` sibling instead.
 */
export { fetchHttpClient } from "@fhir-explorer/core/adapters/browser/fetch-http-client";
export { IdbPackageStore } from "@fhir-explorer/core/adapters/browser/idb-package-store";
export {
  idbProjectResourceStore,
  loadProjectResources,
  saveProjectResources,
  clearProjectResources,
} from "@fhir-explorer/core/adapters/browser/idb-project-resource-store";
export {
  localDatasetResourceStore,
  loadDatasetResources,
  saveDatasetResources,
  upsertDatasetResource,
  removeDatasetResource,
  clearDatasetResources,
  clearAllDatasetResources,
} from "@fhir-explorer/core/adapters/browser/local-dataset-resource-store";
export {
  loadDatasets,
  saveDatasets,
  upsertDataset,
  removeDataset,
  removeDatasetsForProject,
  clearDatasets,
} from "@fhir-explorer/core/adapters/browser/local-dataset-registry";
export {
  loadProjects,
  saveProjects,
  getProject,
  upsertProject,
  removeProject,
  clearProjects,
} from "@fhir-explorer/core/adapters/browser/local-project-registry";
export {
  getTerminologyServerUrl,
  setTerminologyServerUrl,
  subscribeTerminologyServerUrl,
} from "@fhir-explorer/core/adapters/browser/local-settings";
export {
  migrateLegacyLocalStorage,
  migrateLegacyStorageKeys,
} from "@fhir-explorer/core/adapters/browser/legacy-migration";
export {
  workerPackageParser,
  inlinePackageParser,
} from "@fhir-explorer/core/adapters/browser/worker-package-parser";
