/**
 * Just enough of the `vscode` module for the bundle to load and `activate()`
 * to run.
 *
 * This is not a simulation of VS Code — the real behaviour is only observable
 * in the Extension Development Host. It exists so a bundling or wiring
 * regression fails in CI instead of on a user's machine.
 */
export const createVscodeStub = () => {
  const registered: string[] = [];
  const disposable = { dispose() {} };

  const stub = {
    registeredCommands: registered,

    EventEmitter: class {
      event = () => disposable;
      fire() {}
      dispose() {}
    },
    Disposable: class {
      dispose() {}
    },
    TreeItem: class {
      constructor(
        public label: unknown,
        public collapsibleState?: unknown
      ) {}
    },
    TreeItemCollapsibleState: { None: 0, Collapsed: 1, Expanded: 2 },
    ThemeIcon: class {
      constructor(public id: string) {}
    },
    MarkdownString: class {
      value = "";
      appendMarkdown(text: string) {
        this.value += text;
        return this;
      }
    },
    Position: class {
      constructor(
        public line: number,
        public character: number
      ) {}
    },
    Range: class {
      constructor(...args: unknown[]) {
        void args;
      }
    },
    Location: class {
      constructor(
        public uri: unknown,
        public range: unknown
      ) {}
    },
    Diagnostic: class {
      source?: string;
      code?: string;
      constructor(
        public range: unknown,
        public message: string,
        public severity?: number
      ) {}
    },
    DiagnosticSeverity: { Error: 0, Warning: 1, Information: 2, Hint: 3 },
    CompletionItem: class {
      constructor(
        public label: string,
        public kind?: number
      ) {}
    },
    CompletionItemKind: { EnumMember: 19 },
    QuickPickItemKind: { Separator: -1, Default: 0 },
    ProgressLocation: { Notification: 15 },
    FileType: { Unknown: 0, File: 1, Directory: 2, SymbolicLink: 64 },
    RelativePattern: class {
      constructor(
        public base: unknown,
        public pattern: string
      ) {}
    },
    Uri: {
      joinPath: (base: unknown, ...parts: string[]) => ({ base, parts, path: "", toString: () => "" }),
      parse: (value: string) => ({ path: value, toString: () => value }),
      file: (value: string) => ({ path: value, fsPath: value, toString: () => value }),
    },
    StatusBarAlignment: { Left: 1, Right: 2 },
    window: {
      createStatusBarItem: () => ({
        text: "",
        tooltip: undefined as unknown,
        command: undefined as unknown,
        show: () => undefined,
        hide: () => undefined,
        dispose: () => undefined,
      }),
      createTreeView: () => disposable,
      showInformationMessage: async () => undefined,
      showWarningMessage: async () => undefined,
      showErrorMessage: async () => undefined,
      showQuickPick: async () => undefined,
      showInputBox: async () => undefined,
      showTextDocument: async () => undefined,
      showWorkspaceFolderPick: async () => undefined,
      withProgress: async () => undefined,
      registerCustomEditorProvider: () => disposable,
      visibleTextEditors: [] as unknown[],
      activeTextEditor: undefined as unknown,
    },
    env: { language: "en" },
    l10n: {
      // English is the source text; fill the {0} placeholders like VS Code does.
      t: (message: string, ...args: unknown[]) =>
        message.replace(/\{(\d+)\}/g, (match, index: string) =>
          index in args ? String(args[Number(index)]) : match
        ),
    },
    workspace: {
      fs: {
        readFile: async () => new Uint8Array(),
        readDirectory: async () => [],
        writeFile: async () => undefined,
        createDirectory: async () => undefined,
        delete: async () => undefined,
        stat: async () => ({ ctime: 0, mtime: 0, size: 0, type: 1 }),
      },
      workspaceFolders: [] as unknown[],
      textDocuments: [] as unknown[],
      getConfiguration: () => ({ get: () => undefined }),
      registerTextDocumentContentProvider: () => disposable,
      createFileSystemWatcher: () => ({
        onDidCreate: () => disposable,
        onDidChange: () => disposable,
        onDidDelete: () => disposable,
        dispose() {},
      }),
      findFiles: async () => [],
      openTextDocument: async () => undefined,
      asRelativePath: (value: unknown) => String(value),
      onDidChangeWorkspaceFolders: () => disposable,
      onDidOpenTextDocument: () => disposable,
      onDidChangeTextDocument: () => disposable,
      onDidCloseTextDocument: () => disposable,
    },
    languages: {
      createDiagnosticCollection: () => ({
        set() {},
        delete() {},
        clear() {},
        dispose() {},
      }),
      registerHoverProvider: () => disposable,
      registerDefinitionProvider: () => disposable,
      registerCompletionItemProvider: () => disposable,
    },
    commands: {
      registerCommand: (name: string) => {
        registered.push(name);
        return disposable;
      },
      executeCommand: async () => undefined,
    },
  };

  return stub;
};
