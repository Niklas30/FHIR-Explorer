/**
 * Persistence for the resources a user authors, keyed by their owning project
 * or dataset.
 *
 * The web app backs this with IndexedDB. In VS Code a collection is a folder
 * in the workspace and every entry is a `.json` file on disk, which is what
 * makes the git history, the file explorer and external FHIR tooling work
 * without any extra sync layer.
 */
export type ResourceStore<T> = {
  load: (collectionKey: string) => Promise<T[]>;
  save: (collectionKey: string, entries: T[]) => Promise<void>;
  clear: (collectionKey: string) => Promise<void>;
};
