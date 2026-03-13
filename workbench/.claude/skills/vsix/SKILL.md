---
name: vsix
description: "Develop features, fix bugs, and write code for the ASH Workbench VS Code extension (the vsix/ directory). Use this skill when the user asks to 'add a command', 'implement a feature', 'build the tree view', 'register a provider', 'add a setting', 'write extension code', 'work on the extension', 'implement the scan service', 'add a status bar item', 'create diagnostics', 'hook up the webview provider', or any request involving TypeScript code in vsix/src/. Also trigger when the user mentions 'extension host', 'package.json contributes', 'activation event', 'vscode API', or references specific vsix/ files. Do NOT use for the React WebView app (webview/ directory), Docusaurus docs site (docs/ directory), or documentation writing."
---

# ASH Workbench Extension Development

You are developing the extension host side of ASH Workbench -- a VS Code extension that provides a GUI for the Automated Security Helper (ASH) security scanning CLI. The extension runs ASH scans, parses SARIF output, stores findings in an embedded database, and lets users triage security findings from within VS Code.

## Project Context

ASH Workbench is a monorepo with two build targets sharing a root workspace:

- **`vsix/`** -- VS Code extension (TypeScript, Node.js) -- **this is your scope**
- **`webview/`** -- React WebView app (planned, not yet created) -- out of scope for this skill
- **`docs/`** -- Docusaurus documentation site -- out of scope

The extension is currently scaffolded (hello world). The planned architecture has:
- An **extension host** (Node.js) that owns all state, commands, services, and providers
- A **WebView** (React + ShadCN) that is a pure renderer communicating via typed `postMessage`
- A **sidebar tree view** (native VS Code TreeDataProvider) for scan history
- An **embedded database** (PGLite + Prisma, with SQLite as fallback) for persistence

## Current vsix/ Structure

```
vsix/
  package.json              # Extension manifest (contributes, scripts, dependencies)
  tsconfig.json             # strict: true, ES2022 target, Node16 modules
  eslint.config.mjs         # Flat config: typescript-eslint, camelCase/PascalCase imports
  src/
    extension.ts            # Entry point: activate() / deactivate()
    test/
      extension.test.ts     # Mocha tests (run in VS Code test electron)
  out/                      # Compiled JS + sourcemaps (gitignored)
  .vscode/
    launch.json             # "Run Extension" debug config (extensionHost)
    tasks.json              # Build tasks
```

## Planned Module Structure

When building features, organize code into this structure from the technical design:

```
vsix/src/
  extension.ts              # Entry point: init DB, register commands/providers
  commands/
    index.ts                # Command registration
    scanCommands.ts         # Start scan, cancel scan, delete scan
    projectCommands.ts      # Create project, open workbench
  services/
    database.ts             # PGLite + Prisma initialization, query helpers
    scanner.ts              # ASH CLI spawn, process lifecycle, finding storage
    sarif.ts                # SARIF JSON parsing -> Finding model mapping
  providers/
    scanTreeProvider.ts     # Sidebar tree view (scan history)
    webviewProvider.ts      # WebView panel creation and message handling
  models/
    types.ts                # Shared TypeScript types (Finding, Scan, Project, etc.)
    messages.ts             # WebView <-> Extension message type definitions
  test/
    extension.test.ts
    scanner.test.ts
    sarif.test.ts
    database.test.ts
```

Create directories and files as needed when implementing features. Don't create the entire structure upfront.

## Build & Development

```bash
cd vsix
npm run compile       # TypeScript compile to out/
npm run watch         # Compile in watch mode
npm run lint          # ESLint
npm run test          # Run tests via @vscode/test-cli
npm run pretest       # Compile + lint (runs before test)
```

**Debug:** Press F5 in VS Code (uses `.vscode/launch.json`) to launch an Extension Development Host window.

**Test framework:** Mocha, running in VS Code test electron via `@vscode/test-cli`. Test files go in `src/test/` and must match `*.test.ts`.

## Extension Manifest (`package.json`)

Current extension details:
- **ID:** `ash-workbench`
- **Engine:** `^1.110.0`
- **Main:** `./out/extension.js`
- **Activation:** auto-generated from contribution points (keep `activationEvents: []`)

All UI contributions are declared in `package.json` under `contributes`. This includes commands, views, view containers, menus, settings, task definitions, and walkthroughs. Never register UI elements purely in code without a corresponding `package.json` entry (commands are the exception -- they can exist code-only if not user-facing).

## Coding Conventions

- **TypeScript strict mode** -- all strict type-checking enabled
- **ESLint rules:** camelCase/PascalCase imports, curly braces required, strict equality (`===`), semicolons required, no throw literals
- **Disposables:** Push every disposable (commands, providers, watchers, channels) to `context.subscriptions`
- **Naming:** Command IDs use `ash-workbench.<verbNoun>` (e.g., `ash-workbench.startScan`). Setting keys use `ashWorkbench.<category>.<setting>` (e.g., `ashWorkbench.llm.region`)
- **No DOM access** -- extensions cannot touch the VS Code UI DOM. All UI through VS Code APIs or WebView HTML.

## Architecture Patterns

### Extension Entry Point

```typescript
export async function activate(context: vscode.ExtensionContext) {
  // 1. Initialize database
  const db = await DatabaseService.initialize(context.globalStorageUri);

  // 2. Ensure project exists for this workspace
  const project = await ensureProject(db, vscode.workspace.workspaceFolders);

  // 3. Register commands
  registerCommands(context, db, project);

  // 4. Register sidebar tree view
  const scanTree = new ScanTreeProvider(db, project);
  vscode.window.registerTreeDataProvider('ashWorkbench.scanHistory', scanTree);

  // 5. Register WebView provider
  const webviewProvider = new WorkbenchWebviewProvider(
    context.extensionUri, db, project, scanTree
  );
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider('ashWorkbench.mainView', webviewProvider)
  );
}
```

### Service Pattern

Services are classes that own a domain concern. They receive dependencies via constructor and expose async methods. The extension entry point creates and wires them together.

```typescript
class ScannerService {
  constructor(private db: PrismaClient, private project: Project) {}
  async startScan(params: { sourceDir: string; severityThreshold: string }): Promise<string>;
  async cancelScan(scanId: string): Promise<void>;
}
```

### Provider Pattern

Providers implement VS Code interfaces. The two main ones:

- **`TreeDataProvider<T>`** -- sidebar tree views (scan history). Uses `EventEmitter` + `onDidChangeTreeData` for refresh.
- **`WebviewViewProvider`** -- webview panels. Implements `resolveWebviewView()`. Handles message bridge.

### Message Protocol

The WebView is a pure renderer. All state lives in the extension host. Communication uses typed discriminated unions:

```typescript
// WebView -> Extension
type WebviewToExtMessage =
  | { type: 'startScan'; payload: { sourceDir: string; severityThreshold: string } }
  | { type: 'selectScan'; payload: { scanId: string } }
  | { type: 'setDisposition'; payload: { findingId: string; disposition: Disposition } }
  | { type: 'navigateToCode'; payload: { file: string; line: number } }
  | { type: 'requestState' }

// Extension -> WebView
type ExtToWebviewMessage =
  | { type: 'scanList'; payload: ScanSummary[] }
  | { type: 'findingList'; payload: FindingRow[] }
  | { type: 'findingDetail'; payload: FindingDetail }
  | { type: 'scanProgress'; payload: { scanId: string; status: string; elapsed: number } }
  | { type: 'summary'; payload: DispositionSummary }
```

### ASH CLI Integration

ASH is spawned as a child process. Key details:
- Command: `ash --source-dir <path> --output-dir <temp> --output-formats sarif --color false --progress`
- Exit code 0 = no findings, exit code 2 = findings detected, exit code 1 = error
- Output: SARIF 2.1.0 JSON at `<output-dir>/reports/ash.sarif`
- Cancel: send `SIGTERM` to the spawned process

### Data Model (3 entities)

- **Project** -- scoped to a workspace folder (1:1 with workspace)
- **Scan** -- one ASH CLI execution (status: running/completed/failed/cancelled)
- **Finding** -- one security issue (identified across scans by `ruleId + file` composite key)
- **Disposition** -- finding triage state: PENDING, FIX, SUPPRESS, DEFER

## VS Code API Reference

When implementing VS Code UI features, read these reference documents for patterns and UX rules:

- **Quick patterns:** Read `docs/docs/working/extension-guide/vscode-extension-cheat-sheet.md`
- **Full reference:** Read `docs/docs/developer-docs/reference/vscode-extension-reference.md`

These cover: commands, activity bar, tree views, webviews (CSP, message passing, theming, state), status bar, notifications/progress, quick picks, settings, context menus, panel, task provider, diagnostics/code actions, output channels, file decorations, file watchers, and storage.

**Critical VS Code constraints to always follow:**

1. **No DOM access** -- all UI via VS Code APIs (except within webviews)
2. **`package.json` is the manifest** -- declare all contribution points there
3. **Push disposables** to `context.subscriptions` for cleanup
4. **CSP required** on all webviews -- always include `Content-Security-Policy` meta tag
5. **`acquireVsCodeApi()`** can only be called ONCE in a webview
6. **Theme with CSS variables** -- webviews must use `--vscode-*` CSS variables, not custom colors
7. **Commands:** Title case, start with verb, include noun, use `category` for grouping
8. **Notifications:** Show only when truly necessary, include "Do not show again"
9. **Tree views:** Max 3 inline actions per item, use `viewItem` context values for per-type menus
10. **Settings:** Provide defaults on every setting, never create custom settings UI

## Design Documents

For detailed specifications, read these before implementing major features:

- **What the app does:** `docs/docs/developer-docs/architecture/design/functional-design.md` (user stories, data model, feature specs, UI screens)
- **How it's built:** `docs/docs/developer-docs/architecture/design/technical-design.md` (architecture, module structure, database layer, ASH integration, WebView architecture)
- **Quick overview:** `docs/docs/developer-docs/architecture/design/project-synopsis.md`

## Implementation Guidelines

1. **Read before writing.** Before implementing a feature, read the relevant sections of the functional and technical design docs. They contain specific implementation patterns, type definitions, and architectural decisions.

2. **Extension host owns state.** Never put business logic or data fetching in the WebView. The WebView sends user actions via `postMessage`, the extension host processes them and pushes state back.

3. **One scan at a time.** The architecture supports only one concurrent scan per project.

4. **Test with the Extension Development Host.** Use F5 to launch a test VS Code window. Test commands via the Command Palette (`Ctrl+Shift+P`).

5. **Check `package.json` first.** Before adding a command, view, setting, or menu item, check what's already declared in `package.json` under `contributes`. Update the manifest alongside the code.

6. **Database queries via Prisma.** Use the Prisma client for all database operations. The schema is in `vsix/prisma/schema.prisma`. Run `npx prisma generate` after schema changes.

7. **SARIF is the integration format.** ASH produces SARIF 2.1.0. The parser must handle ASH-specific severity in `result.properties` (check before falling back to SARIF `level` mapping).
