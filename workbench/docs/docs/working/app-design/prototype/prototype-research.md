---
title: Prototype Research - ASH Workbench UI Skeleton POC
---

# Prototype Research: ASH Workbench UI Skeleton POC

Comprehensive research examining the implications of implementing a POC that establishes the vsix structure, demonstrates VS Code extension UI/tree views with mock data, and demonstrates the React/ShadCN WebView UI. This document is the foundation for planning the prototype implementation.

## 1. Overview

### 1.1 Prototype Scope

The prototype is a **UI skeleton** -- a visual proof-of-concept that demonstrates the two UI rendering approaches used by the ASH Workbench extension:

1. **Native VS Code extension UI** -- Activity bar icon, sidebar view container, tree view (scan history), status bar item, commands
2. **React/ShadCN WebView UI** -- Rich web-based panel rendered in the sidebar or editor area, showing finding list, finding detail, and triage controls

The prototype uses **mock data** exclusively. No database, no ASH CLI integration, no real scanning. The goal is to validate the UI architecture, the two-package build system, the postMessage bridge, and the visual design before investing in backend services.

### 1.2 What the Prototype Proves

| Concern | What the Prototype Validates |
|---------|------------------------------|
| **Extension structure** | The `vsix/` module structure (commands, providers, models) supports the technical design's architecture |
| **View container** | A custom activity bar icon and sidebar view container work as designed |
| **Tree view** | `TreeDataProvider` renders scan history with status icons from mock data |
| **Sidebar WebView** | `WebviewViewProvider` correctly loads a Vite-built React app in the sidebar for compact summary |
| **Editor panel WebView** | `WebviewPanel` opens in the editor area with full-width Finding List and Detail screens |
| **Dual context** | The same React app renders different views based on its hosting context (sidebar vs. editor panel) |
| **Message bridge** | `postMessage` round-trips work between extension host and both WebView contexts |
| **React/ShadCN** | ShadCN components render correctly inside a VS Code WebView with proper theming |
| **Build system** | Two-package build (`tsc` for extension, Vite for WebView) works end-to-end |
| **Dev workflow** | F5 launch, watch mode, and hot-reload-like experience function correctly |

### 1.3 What the Prototype Does NOT Prove

- PGLite/Prisma database integration (deferred to Phase 1 spike per technical design)
- ASH CLI spawning, SARIF parsing, or finding storage
- Real data persistence across sessions
- Scan execution lifecycle
- Actual finding triage with database writes

---

## 2. Current State Analysis

### 2.1 Existing Codebase

The `vsix/` directory was scaffolded by the VS Code Extension Generator (`yo code`). It contains:

| File | State | Notes |
|------|-------|-------|
| `vsix/package.json` | Scaffold default | Single "Hello World" command, no views/containers |
| `vsix/src/extension.ts` | Scaffold default | Registers one command, shows info message |
| `vsix/src/test/extension.test.ts` | Scaffold default | Sample assertion test |
| `vsix/tsconfig.json` | Scaffold default | ES2022 target, Node16 modules, strict mode |
| `vsix/eslint.config.mjs` | Scaffold default | typescript-eslint flat config |
| `vsix/.vscode/launch.json` | Scaffold default | "Run Extension" launch config |
| `vsix/.vscode/tasks.json` | Scaffold default | npm watch as default build task |
| `vsix/.vscodeignore` | Scaffold default | Excludes source, config from VSIX package |

The `webview/` directory **does not exist**. It must be created from scratch.

**Environment:**
- Node.js v22.12.0, npm 10.9.0
- TypeScript 5.9.3
- VS Code engine `^1.110.0`
- Extension compiles cleanly with `tsc`

### 2.2 Design Documents Available

The design documents provide comprehensive specifications that the prototype must align with:

- **Functional Design** (`docs/docs/developer-docs/architecture/software-design-specification/functional-design.md`) -- Defines POC scope, user stories, data model, UI screens, interaction flows
- **Technical Design** (`docs/docs/developer-docs/architecture/software-design-specification/technical-design.md`) -- Defines architecture, module structure, database layer, WebView build system, message protocol
- **Project Synopsis** (`docs/docs/developer-docs/architecture/software-design-specification/README.md`) -- Concise overview for fast context

### 2.3 Gap Analysis: Scaffold vs. Design

| Design Requirement | Current State | Work Required |
|-------------------|---------------|---------------|
| Activity bar view container ("ASH Workbench") | Not declared | Add `viewsContainers.activitybar` to `package.json` |
| Sidebar WebView view | Not declared | Add `views` with `type: "webview"` to `package.json` |
| Sidebar tree view (scan history) | Not declared | Add `views` entry + implement `TreeDataProvider` |
| Commands (start scan, open workbench, cancel) | Only "Hello World" exists | Replace with real command definitions |
| Configuration settings | None | Add `contributes.configuration` block |
| Extension entry point | Single command registration | Full activation with providers, commands, mock services |
| Module structure (commands/, services/, providers/, models/) | Flat single file | Create directory structure per technical design |
| WebView React app | Directory doesn't exist | Create entire `webview/` package from scratch |
| Build integration | Only `tsc` | Add Vite build for WebView, coordinate builds |

---

## 3. VS Code Extension API Analysis

### 3.1 View Container and Views Declaration

The technical design specifies two views inside a custom view container. The `package.json` `contributes` section must declare:

```json
{
  "viewsContainers": {
    "activitybar": [{
      "id": "ashWorkbench",
      "title": "ASH Workbench",
      "icon": "resources/icon.svg"
    }]
  },
  "views": {
    "ashWorkbench": [
      {
        "type": "webview",
        "id": "ashWorkbench.mainView",
        "name": "Workbench"
      },
      {
        "id": "ashWorkbench.scanHistory",
        "name": "Scan History"
      }
    ]
  }
}
```

**Key implications:**
- A `type: "webview"` view uses `WebviewViewProvider` (not `TreeDataProvider`)
- A view without `type` defaults to tree view, using `TreeDataProvider`
- Both views appear in the same sidebar container under the ASH Workbench icon
- The WebView view appears **in the sidebar**, not in the editor area -- this constrains width and layout
- View ordering in the array determines display order

### 3.2 WebviewViewProvider API

From the VS Code type definitions (`@types/vscode/index.d.ts:10336`):

```typescript
export interface WebviewViewProvider {
  resolveWebviewView(
    webviewView: WebviewView,
    context: WebviewViewResolveContext,
    token: CancellationToken
  ): Thenable<void> | void;
}
```

**Registration** (`index.d.ts:11754`):

```typescript
window.registerWebviewViewProvider(
  viewId: string,
  provider: WebviewViewProvider,
  options?: { webviewOptions?: { retainContextWhenHidden?: boolean } }
): Disposable
```

**Critical implementation details:**
- `resolveWebviewView` is called when the view **first becomes visible** -- not at activation time
- The provider must set `webviewView.webview.html` to render content
- `webviewView.webview.options.enableScripts` must be `true` for React to work
- `webviewView.webview.options.localResourceRoots` must include the WebView dist directory
- For the prototype, `retainContextWhenHidden` is **not** used (per technical design)
- When the view is hidden and re-shown, `resolveWebviewView` is called again -- the React app must re-request state

**WebView interface** (`index.d.ts:9955`):
- `webview.html` -- set to the full HTML document
- `webview.postMessage(message)` -- send data to WebView
- `webview.onDidReceiveMessage` -- receive messages from WebView
- `webview.asWebviewUri(uri)` -- convert local file URI to webview-safe URI
- `webview.cspSource` -- the CSP source value for the webview

### 3.3 TreeDataProvider API

From `@types/vscode/index.d.ts:12238`:

```typescript
export interface TreeDataProvider<T> {
  onDidChangeTreeData?: Event<T | T[] | undefined | null | void>;
  getTreeItem(element: T): TreeItem | Thenable<TreeItem>;
  getChildren(element?: T): ProviderResult<T[]>;
  getParent?(element: T): ProviderResult<T>;
  resolveTreeItem?(item: TreeItem, element: T, token: CancellationToken): ProviderResult<TreeItem>;
}
```

**TreeItem properties** (`index.d.ts:12300`):
- `label` -- display text (string or `TreeItemLabel`)
- `id` -- unique identifier for state preservation
- `iconPath` -- file path or `ThemeIcon`
- `description` -- secondary text (rendered dimmer)
- `tooltip` -- hover text (string or `MarkdownString`)
- `command` -- executed when item is clicked
- `collapsibleState` -- `None`, `Collapsed`, or `Expanded`
- `contextValue` -- used for `when` clauses in context menus

**ThemeIcon** (`index.d.ts:945`) allows using VS Code's built-in icons:
- `new ThemeIcon('check')` -- green checkmark
- `new ThemeIcon('error')` -- red error
- `new ThemeIcon('circle-slash')` -- grey cancelled
- `new ThemeIcon('sync~spin')` -- animated spinner
- Color can be customized: `new ThemeIcon('check', new ThemeColor('testing.iconPassed'))`

**Registration:**
```typescript
window.registerTreeDataProvider('ashWorkbench.scanHistory', provider): Disposable
// OR for more control:
window.createTreeView('ashWorkbench.scanHistory', { treeDataProvider: provider }): TreeView<T>
```

**Refresh pattern:** Fire `onDidChangeTreeData` event with `undefined` to refresh the entire tree, or with a specific element to refresh that subtree.

### 3.4 Sidebar WebView Constraints

When a WebView is rendered in the sidebar (as opposed to an editor panel), there are important constraints:

1. **Width is limited** -- The sidebar is typically 200-400px wide. The React UI must be responsive to narrow widths.
2. **No tab bar** -- Sidebar views don't have editor tabs. Navigation must be handled within the WebView itself.
3. **Height varies** -- The WebView shares vertical space with the tree view below it. If both views are expanded, each gets roughly half the sidebar height.
4. **Scrolling** -- The WebView has its own scrollbar, independent of the sidebar scrollbar.

**Design implication:** The functional design's "Finding List" table with multiple columns (severity, description, file, scanner, disposition) may need to be redesigned as a card/list layout for sidebar width. Alternatively, the WebView could open in the **editor area** via `WebviewPanel` for wider content.

**Decision point for the prototype:** The technical design specifies a `type: "webview"` sidebar view. However, the functional design's Screen 2 (Finding List) and Screen 3 (Finding Detail) suggest content that needs more horizontal space. The prototype should implement the sidebar WebView first, then evaluate if an editor-area `WebviewPanel` is needed for detailed views.

---

## 4. WebView Package Architecture

### 4.1 Package Setup (`workbench/webview/`)

The `webview/` directory is created as a **sibling** of `vsix/` under `workbench/`, following the technical design's directory structure (Section 2). It is a completely separate npm package with its own `package.json`, `node_modules/`, and build pipeline. It has no npm dependency relationship to `vsix/` -- they share types by file copy, not by import.

**Filesystem location:**

```
workbench/                  # Repository root / VS Code workspace
  vsix/                     # VS Code extension package
    package.json
    src/
    out/
    webview-dist/            # COPIED from ../webview/dist/ (see Section 4.4)
  webview/                   # React WebView app -- SIBLING of vsix/
    package.json             # Separate package, separate node_modules
    vite.config.ts
    src/
    dist/                    # Vite build output (canonical location)
  docs/                      # Docusaurus site
```

**Why sibling, not nested:** The technical design (Section 2) specifies this layout. The two packages have fundamentally different build targets (Node.js vs. browser), different bundlers (`tsc` vs. Vite), and entirely different dependency trees. Placing them as siblings under `workbench/` makes this separation visible at the filesystem level. The cost is a copy step to bring built assets into the extension (detailed in Section 4.4).

**Required toolchain:**
- React 19
- Vite 6.x with `@vitejs/plugin-react`
- TypeScript 5.x
- Tailwind CSS 4.x
- ShadCN/ui components (installed individually via `npx shadcn@latest add`)

**Vite configuration requirements:**
- Fixed output filenames (no content hashes) so the extension HTML template can reference `assets/index.js` and `assets/index.css` by known paths
- Single entry point that produces one JS bundle and one CSS file
- Output to `webview/dist/` (the canonical build location)

### 4.2 ShadCN in VS Code WebView: Considerations

ShadCN/ui uses Tailwind CSS under the hood. Running Tailwind inside a VS Code WebView has specific implications:

**CSS isolation:** The WebView runs in an iframe. Tailwind's global reset (`@tailwind base`) only affects the iframe's document, not VS Code's own UI. This is desirable -- ShadCN styles won't leak into VS Code.

**VS Code theme integration:** The WebView can access VS Code's CSS custom properties for theming:
- `--vscode-editor-background`
- `--vscode-editor-foreground`
- `--vscode-button-background`
- `--vscode-badge-background`
- etc.

For the prototype, the approach should be:
1. Use ShadCN components with their default styling
2. Override ShadCN's CSS custom properties to map to VS Code theme variables where practical
3. Accept some visual divergence from VS Code's native theme (the technical design explicitly accepts this for POC)

**CSP requirements:** ShadCN/Tailwind injects styles at runtime. The CSP must include `'unsafe-inline'` for `style-src`. Scripts use nonce-gating. The technical design's CSP:

```
default-src 'none';
style-src ${webview.cspSource} 'unsafe-inline';
script-src 'nonce-${nonce}';
font-src ${webview.cspSource};
img-src ${webview.cspSource};
```

### 4.3 ShadCN Components for the Prototype

The functional design specifies these UI elements. For the prototype with mock data, the minimum ShadCN components needed:

| Component | Used For | ShadCN Component |
|-----------|----------|------------------|
| Scan list table | Dashboard screen | `Table` |
| Severity badges | Finding list, detail | `Badge` |
| Run Scan button | Dashboard | `Button` |
| Filter dropdowns | Finding list | `Select` or `DropdownMenu` |
| File search | Finding list filter | `Input` |
| Finding detail card | Detail panel | `Card` |
| Disposition buttons | Triage controls | `Button` group or `ToggleGroup` |
| Progress indicator | Active scan | `Progress` |
| Summary counts | Triage summary bar | Custom with `Badge` |

**Installation:** ShadCN components are copied into the project (not imported from a package). Install via:
```bash
npx shadcn@latest init   # initializes the project
npx shadcn@latest add table badge button select input card progress
```

### 4.4 Vite Build Integration with Extension (Sibling Copy Pattern)

Because `webview/` is a sibling of `vsix/`, the Vite build output at `webview/dist/` is **outside** the extension's root directory. The VS Code extension API resolves all resource paths relative to `context.extensionUri`, which points to `vsix/`. The extension cannot directly reference files in a sibling directory -- `localResourceRoots` and `asWebviewUri()` operate relative to the extension root.

**The solution is a copy step.** After Vite builds to `webview/dist/`, the output is copied into `vsix/webview-dist/`. The extension code references this copied location.

#### 4.4.1 Why Not Use `..` in URI Paths?

```typescript
// This is tempting but unreliable:
vscode.Uri.joinPath(this.extensionUri, '..', 'webview', 'dist')
```

This fails for two reasons:
1. `localResourceRoots` may not allow paths outside the extension directory, especially in a packaged VSIX where the extension runs from an extracted archive
2. `vsce package` only bundles files under the extension root -- sibling directories are excluded from the VSIX file entirely

The copy approach works in both development and packaged modes.

#### 4.4.2 Directory Layout with Copy Target

```
workbench/
  vsix/
    package.json
    src/
      providers/
        webviewProvider.ts          # References 'webview-dist/assets/index.js'
    webview-dist/                    # COPY TARGET -- populated by build script
      assets/
        index.js                    # Copied from ../webview/dist/assets/index.js
        index.css                   # Copied from ../webview/dist/assets/index.css
    out/                            # tsc output
  webview/
    package.json
    vite.config.ts
    src/                            # React source code
    dist/                           # CANONICAL BUILD OUTPUT -- Vite writes here
      assets/
        index.js
        index.css
```

Key distinctions:
- `webview/dist/` is the **canonical** Vite output. Vite always writes here.
- `vsix/webview-dist/` is a **copy** that the extension reads at runtime. It is gitignored.
- The copy step bridges the sibling gap. It runs after every Vite build.

#### 4.4.3 Extension Code: Asset Path Resolution

The WebView provider references the copied assets using `extensionUri`:

```typescript
// localResourceRoots -- allow the extension to serve files from webview-dist/
webviewView.webview.options = {
  enableScripts: true,
  localResourceRoots: [
    vscode.Uri.joinPath(this.extensionUri, 'webview-dist'),
  ],
};

// Script and style URIs -- resolved relative to extensionUri
const scriptUri = webview.asWebviewUri(
  vscode.Uri.joinPath(this.extensionUri, 'webview-dist', 'assets', 'index.js')
);
const styleUri = webview.asWebviewUri(
  vscode.Uri.joinPath(this.extensionUri, 'webview-dist', 'assets', 'index.css')
);
```

**Note:** The technical design's code examples use `'webview', 'dist'` in the path (two segments). The sibling layout uses `'webview-dist'` (one segment pointing to the copy target). This is a deliberate deviation from the technical design's code -- the directory structure takes precedence and the code adapts.

#### 4.4.4 The Copy Step

The copy can be implemented as an npm script in `vsix/package.json`:

```json
{
  "scripts": {
    "copy:webview": "cp -r ../webview/dist ./webview-dist",
    "build:webview": "cd ../webview && npm run build && cd ../vsix && npm run copy:webview",
    "compile": "tsc -p ./",
    "build": "npm run build:webview && npm run compile",
    "vscode:prepublish": "npm run build"
  }
}
```

For cross-platform compatibility, replace `cp -r` with a Node.js-based copy (e.g., `shx cp -r`, `cpy-cli`, or a small script using `fs.cpSync`). For the prototype on macOS, `cp -r` is sufficient.

#### 4.4.5 Gitignore

`vsix/webview-dist/` is a build artifact (a copy of another build artifact). It must be gitignored:

```gitignore
# In vsix/.gitignore or workbench/.gitignore
vsix/webview-dist/
```

#### 4.4.6 .vscodeignore

The `.vscodeignore` in `vsix/` must **include** the copied webview assets in the VSIX package but **exclude** source files:

```
# Include webview-dist/ (don't add it to ignore list)
# Exclude everything else that shouldn't ship:
.vscode/**
src/**
webview-dist/**/*.map
**/*.ts
**/tsconfig.json
```

Wait -- `webview-dist/` should NOT be in `.vscodeignore` (that would exclude it). By default, `vsce package` includes everything not in `.vscodeignore`. So `webview-dist/` is included automatically as long as it's not listed.

#### 4.4.7 Development Watch Mode

During development, the copy step must run whenever Vite rebuilds. The workflow:

**Terminal 1 -- Extension TypeScript watch:**
```bash
cd vsix && npm run watch
# Runs: tsc --watch -p ./
```

**Terminal 2 -- WebView Vite watch + auto-copy:**
```bash
cd webview && npm run build -- --watch
# Runs: vite build --watch
# Output: webview/dist/ is updated on every source change
```

**Terminal 3 -- Copy watcher (bridges the sibling gap):**
```bash
# Using chokidar-cli, fswatch, or a custom script:
# Watch ../webview/dist/ and copy to vsix/webview-dist/ on change

# Option A: Simple polling loop (good enough for prototype)
cd vsix && while true; do cp -r ../webview/dist ./webview-dist 2>/dev/null; sleep 2; done

# Option B: fswatch (macOS, event-driven)
fswatch -o ../webview/dist | while read; do cp -r ../webview/dist ./webview-dist; done

# Option C: npm script using nodemon
npx nodemon --watch ../webview/dist --exec "cp -r ../webview/dist ./webview-dist"
```

**Terminal 4 -- F5 in VS Code** launches the Extension Development Host.

After copying, reload the Extension Development Host window (Cmd+R in the dev host) to pick up the new WebView assets.

**Simplification for prototype:** During active WebView development, run Terminal 2 and Terminal 3. During extension-only development, they can be stopped. The copy only matters when WebView source changes.

**Future improvement:** A single script in `workbench/` (or in `vsix/package.json`) could combine the Vite watch and copy watcher into one process using `concurrently`:

```json
{
  "scripts": {
    "watch:all": "concurrently \"npm run watch\" \"cd ../webview && npm run build -- --watch\" \"nodemon --watch ../webview/dist --exec 'cp -r ../webview/dist ./webview-dist'\""
  }
}
```

This reduces three terminals to one, but adds `concurrently` as a dev dependency.

#### 4.4.8 Technical Design Note

The technical design (Section 3.5) writes `vscode.Uri.joinPath(this.extensionUri, 'webview', 'dist', 'assets', 'index.js')`. This path assumes `webview/` is nested inside the extension. Since we're using the sibling layout from Section 2 of the same design, the path must be `vscode.Uri.joinPath(this.extensionUri, 'webview-dist', 'assets', 'index.js')`. This is an intentional correction -- the Section 2 directory structure is authoritative, and the code adapts to match it.

---

## 5. Mock Data Design

### 5.1 Mock Data Strategy

The prototype needs realistic mock data that exercises all UI states. The mock data should:

1. **Live in a single TypeScript module** (`vsix/src/mock/data.ts`) so it's trivially removable later
2. **Use the same TypeScript types** that the real data model will use (defined in `vsix/src/models/types.ts`)
3. **Cover all visual states** -- running scan, completed scan, failed scan, cancelled scan; all severity levels; all disposition states
4. **Be static** -- no timers or simulations in the prototype. The UI renders pre-defined data.

### 5.2 Mock Data Schema

Based on the functional design's data model:

**Mock Project:**
- 1 project scoped to the workspace

**Mock Scans (4 entries covering all statuses):**

| Scan | Status | Findings | Started | Notes |
|------|--------|----------|---------|-------|
| Scan 1 | `COMPLETED` | 47 | 2 hours ago | Most recent, shown by default |
| Scan 2 | `COMPLETED` | 23 | Yesterday | Older scan, fewer findings |
| Scan 3 | `FAILED` | 0 | 3 days ago | Error message populated |
| Scan 4 | `RUNNING` | - | Now | Shows progress state |

**Mock Findings (~15-20 entries for Scan 1):**

Covering:
- All severity levels: CRITICAL (2), HIGH (5), MEDIUM (5), LOW (3), INFO (2)
- Multiple scanners: checkov (7), semgrep (4), cdk-nag (3), bandit (2), grype (1)
- Various file types: `.ts`, `.py`, `.yml`, `.json`, `.tf`
- All disposition states: PENDING (10), FIX (3), SUPPRESS (2), DEFER (2)
- Realistic rule IDs: `CKV_AWS_18`, `CKV_AWS_145`, `AwsSolutions-IAM4`, `javascript.lang.security.audit.xss`, etc.
- Code snippets with line numbers

### 5.3 Mock Data Types

These types serve double duty: used for mock data now, and will be the actual data model types later.

```typescript
// vsix/src/models/types.ts

export type ScanStatus = 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
export type Severity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO';
export type Disposition = 'PENDING' | 'FIX' | 'SUPPRESS' | 'DEFER';

export interface Project {
  id: string;
  name: string;
  rootPath: string;
  createdAt: string;
  updatedAt: string;
}

export interface ScanSummary {
  id: string;
  projectId: string;
  sourceDir: string;
  status: ScanStatus;
  severityThreshold: string;
  findingsCount: number;
  severityBreakdown: { critical: number; high: number; medium: number; low: number; info: number };
  startedAt: string;
  completedAt: string | null;
  errorMessage: string | null;
}

export interface FindingRow {
  id: string;
  scanId: string;
  projectId: string;
  ruleId: string;
  scanner: string;
  severity: Severity;
  file: string;
  startLine: number;
  endLine: number | null;
  title: string;
  description: string;
  snippet: string | null;
  disposition: Disposition;
}

export interface DispositionSummary {
  total: number;
  pending: number;
  fix: number;
  suppress: number;
  defer: number;
}
```

---

## 6. Extension Host Module Structure

### 6.1 Target Directory Structure (Prototype)

The technical design specifies a full module structure. For the prototype, a subset is needed:

```
vsix/src/
  extension.ts                # Entry point -- registers providers, commands
  commands/
    index.ts                  # Command registration
    scanCommands.ts           # Mock: start scan, cancel scan (show info messages)
    projectCommands.ts        # Mock: open workbench
  providers/
    scanTreeProvider.ts       # TreeDataProvider with mock scan data
    sidebarWebviewProvider.ts # WebviewViewProvider for sidebar summary
    findingsPanelManager.ts   # WebviewPanel manager for editor-area findings view
    webviewHtml.ts            # Shared HTML generation (CSP, nonce, asset URIs)
  models/
    types.ts                  # TypeScript types (shared between ext and webview)
    messages.ts               # Message protocol type definitions
  mock/
    data.ts                   # All mock data (scans, findings)
  test/
    extension.test.ts         # Updated from scaffold
```

**Deferred from prototype (built in later phases):**
- `services/database.ts` -- No database in prototype
- `services/scanner.ts` -- No ASH integration in prototype
- `services/sarif.ts` -- No SARIF parsing in prototype
- `prisma/` -- No Prisma schema in prototype

### 6.2 Extension Entry Point Changes

The current `extension.ts` registers a single "Hello World" command. The prototype must:

1. Register the `WebviewViewProvider` for `ashWorkbench.mainView`
2. Register the `TreeDataProvider` for `ashWorkbench.scanHistory`
3. Register commands: `ashWorkbench.startScan`, `ashWorkbench.openWorkbench`, `ashWorkbench.cancelScan`
4. Create a status bar item showing "ASH Workbench"

The activation event changes from command-triggered to view-triggered:
```json
"activationEvents": ["onView:ashWorkbench.mainView"]
```

### 6.3 Tree View Implementation

The `ScanTreeProvider` for the prototype:

- Returns mock scan data from `mock/data.ts`
- Renders each scan as a `TreeItem` with:
  - Label: scan date/time
  - Description: finding count and source directory
  - Icon: status-appropriate `ThemeIcon` (check, error, circle-slash, sync~spin)
  - Context value for potential context menu actions
- Implements `onDidChangeTreeData` event emitter (wired but only fires on manual refresh)
- Clicking a scan item sends a message to the WebView to show that scan's findings

### 6.4 WebView Provider Implementations

The prototype has **two WebView contexts** per the Option B decision (Section 11.1). Both load the same Vite-built React app from `vsix/webview-dist/` but initialize it with different context values.

#### 6.4.1 Sidebar WebView Provider (`WebviewViewProvider`)

The `SidebarWebviewProvider` for the sidebar:

1. In `resolveWebviewView`:
   - Set `enableScripts: true`
   - Set `localResourceRoots` to `[vscode.Uri.joinPath(extensionUri, 'webview-dist')]`
   - Build HTML with CSP, nonce, and references to assets at `webview-dist/assets/index.js` and `webview-dist/assets/index.css`
   - Set up the message handler
   - Send `{ type: 'init', payload: { context: 'sidebar' } }` after HTML is set
2. Message handler processes:
   - `requestState` -- responds with mock scan summaries and triage progress
   - `startScan` -- shows info message (mock only)
   - `openFindings` -- triggers the extension to create/reveal the editor panel (see 6.4.2)
3. The sidebar WebView is lightweight -- it displays summary data, not full finding lists

#### 6.4.2 Editor Panel WebView (`WebviewPanel`)

The `FindingsPanelManager` manages the editor-area panel:

1. **Created on demand** via `vscode.window.createWebviewPanel()` when:
   - User clicks a scan in the tree view
   - User clicks "View Findings" in the sidebar WebView
   - User runs the `ashWorkbench.openWorkbench` command
2. **Panel creation:**
   - Same `enableScripts`, `localResourceRoots`, CSP, and nonce pattern as sidebar
   - Same Vite-built assets (`webview-dist/assets/index.js`, `webview-dist/assets/index.css`)
   - Send `{ type: 'init', payload: { context: 'editorPanel', scanId: '...' } }` after creation
3. **Message handler processes:**
   - `requestState` -- responds with mock findings for the active scan
   - `selectFinding` -- responds with mock finding detail
   - `setDisposition` -- updates mock data in memory (not persisted)
   - `navigateToCode` -- calls `vscode.window.showTextDocument()` (works with real files if they exist)
4. **Lifecycle:**
   - Only one panel instance at a time (reuse pattern: `panel.reveal()` if already open)
   - `panel.onDidDispose()` cleans up the reference so a new panel can be created
   - Title updates to reflect the active scan: `"ASH: Scan 2024-03-12"`

#### 6.4.3 Shared HTML Generation

Both providers share a `getWebviewHtml(webview, extensionUri)` utility function that generates the HTML document. The function:
- Generates a nonce
- Resolves asset URIs via `webview.asWebviewUri()`
- Builds the CSP header
- Returns the complete HTML string

The only difference between sidebar and editor panel HTML is the `init` message sent after the HTML is set -- the HTML itself is identical.

**Path resolution reminder:** The extension references `webview-dist/` (the copy target inside `vsix/`), NOT `../webview/dist/` (the canonical Vite output). The copy step in Section 4.4 bridges the sibling gap.

---

## 7. WebView React App Architecture

### 7.1 Target Structure

The WebView React app lives at `workbench/webview/` -- a sibling of `workbench/vsix/`. It is a standalone npm package. Its build output (`dist/`) is copied into `vsix/webview-dist/` by the build process (see Section 4.4).

```
workbench/webview/              # Sibling of workbench/vsix/
  package.json                  # Separate npm package
  tsconfig.json
  vite.config.ts
  index.html
  components.json               # ShadCN configuration
  src/
    main.tsx                    # React entry point
    App.tsx                     # Root component, message bridge, state reducer
    globals.css                 # Tailwind directives + VS Code theme overrides
    lib/
      utils.ts                  # ShadCN utility (cn function)
    hooks/
      useVSCodeAPI.ts           # postMessage bridge hook
    components/
      ui/                       # ShadCN components (auto-generated)
        button.tsx
        badge.tsx
        table.tsx
        card.tsx
        select.tsx
        input.tsx
        progress.tsx
      Dashboard.tsx             # Scan list + summary + run scan button
      FindingList.tsx           # Finding table with filters and summary bar
      FindingDetail.tsx         # Finding detail with code, disposition controls
      ScanProgress.tsx          # Active scan progress indicator
      SeverityBadge.tsx         # Reusable severity badge component
      DispositionBadge.tsx      # Reusable disposition badge component
    types/
      messages.ts               # Message types (copied from vsix/src/models/)
  dist/                         # Vite output -- copied to vsix/webview-dist/ by build
    assets/
      index.js
      index.css
```

### 7.2 State Management

The React app uses `useReducer` for application state. Because the same Vite-built app is loaded in both the sidebar and editor panel (Section 11.1), the state includes a `context` discriminant that determines which view to render:

```typescript
interface AppState {
  context: 'sidebar' | 'editorPanel';
  view: 'dashboard' | 'findingList' | 'findingDetail';
  scans: ScanSummary[];
  findings: FindingRow[];
  selectedFinding: FindingDetail | null;
  filters: FilterState;
  scanProgress: { scanId: string; status: string; elapsed: number } | null;
  summary: DispositionSummary;
}
```

**Context initialization:** When the extension host creates or resolves a WebView, it sends an `init` message that sets the context:

```typescript
// Extension host sends immediately after setting webview HTML:
webview.postMessage({ type: 'init', payload: { context: 'sidebar' } });
// or
panel.webview.postMessage({ type: 'init', payload: { context: 'editorPanel', scanId: '...' } });
```

The React `App.tsx` root component uses `context` to choose between rendering `SidebarDashboard` or the editor panel screens (`FindingList`, `FindingDetail`).

All state comes from extension messages. The WebView sends `requestState` on mount and receives state pushes from the extension host. The extension host is the single source of truth -- both WebView contexts query the same mock data store.

### 7.3 Message Bridge Hook

```typescript
// hooks/useVSCodeAPI.ts
const vscode = acquireVsCodeApi();

function postMessage(message: WebviewToExtMessage): void {
  vscode.postMessage(message);
}

function useMessages(handler: (msg: ExtToWebviewMessage) => void): void {
  useEffect(() => {
    const listener = (event: MessageEvent) => handler(event.data);
    window.addEventListener('message', listener);
    return () => window.removeEventListener('message', listener);
  }, [handler]);
}
```

**Important:** `acquireVsCodeApi()` can only be called **once** per WebView lifecycle. It must be called at module scope or in a singleton pattern, not inside a React component.

### 7.4 VS Code Theme Integration

To make ShadCN components feel native to VS Code, the `globals.css` should map VS Code's CSS variables to Tailwind/ShadCN custom properties:

```css
:root {
  --background: var(--vscode-editor-background);
  --foreground: var(--vscode-editor-foreground);
  --card: var(--vscode-editor-background);
  --card-foreground: var(--vscode-editor-foreground);
  --primary: var(--vscode-button-background);
  --primary-foreground: var(--vscode-button-foreground);
  --muted: var(--vscode-input-background);
  --muted-foreground: var(--vscode-descriptionForeground);
  --border: var(--vscode-panel-border);
  /* ... etc */
}
```

This gives a reasonable VS Code-native feel without custom component development.

### 7.5 Screen Designs for Prototype

Screens are split across two WebView contexts per the Option B decision (Section 11.1).

#### Sidebar Screens (`WebviewViewProvider` -- narrow, always visible)

**Sidebar: Dashboard Summary**
- Project name header (from mock)
- "Run Scan" button (shows info message via postMessage)
- Active scan progress bar (if mock running scan is shown)
- Triage summary: compact disposition breakdown (e.g., "10 pending, 3 fix, 2 suppress, 2 defer")
- Severity summary: compact severity counts with color-coded badges
- "View Findings" link/button that opens the editor panel

This view is designed for ~250-400px width. No tables. Uses stacked cards, badges, and single-column layout.

#### Editor Panel Screens (`WebviewPanel` -- full-width tab)

**Screen 1: Finding List** (opens when a scan is selected from tree view or sidebar)
- Breadcrumb navigation: project name (links back to sidebar focus)
- Scan header: scan date, status, source directory
- Filter bar: severity chips (clickable to filter), scanner dropdown, disposition dropdown, file search input
- Summary bar: count by disposition
- Finding table: severity badge, title (truncated), file path, scanner name, disposition badge
- Click a row to navigate to Finding Detail (within the same panel)

**Screen 2: Finding Detail** (after clicking a finding in the table)
- Breadcrumb: Finding List > Finding Detail
- Header: severity badge, title, rule IDs, scanner
- Disposition control: button group (Pending / Fix / Suppress / Defer) with active state
- Code location: file path (clickable -- sends `navigateToCode` to extension host), line range, code snippet in a `<pre>` block
- Scanner description text
- Back button to return to Finding List

Both editor panel screens have full editor-area width (typically 800-1200px+), allowing proper table layouts and side-by-side information.

---

## 8. Build System and Developer Experience

### 8.1 Two-Package Build with Sibling Copy Step

The prototype has two independent packages with a copy step that bridges them:

```
workbench/
  vsix/                 # Package 1: VS Code extension
    package.json        # Build scripts live here (orchestrates everything)
    src/                # TypeScript source → tsc → out/
    out/                # tsc output (extension host JS)
    webview-dist/       # COPY of webview/dist/ (build artifact, gitignored)
  webview/              # Package 2: React WebView app
    package.json        # Has its own "build" script (vite build)
    src/                # React/TypeScript source → Vite → dist/
    dist/               # Vite output (canonical location)
```

**Build flow (production / CI):**

```
1. cd webview && npm run build       # Vite → webview/dist/
2. cd vsix && npm run copy:webview   # cp -r ../webview/dist → vsix/webview-dist/
3. cd vsix && npm run compile        # tsc → vsix/out/
```

Steps 1-2 can be combined into a single `build:webview` script in `vsix/package.json`. Step 3 is the standard `tsc` compile. The `vscode:prepublish` script chains all three, ensuring `vsce package` produces a complete VSIX.

**Complete `vsix/package.json` scripts:**

```json
{
  "scripts": {
    "compile": "tsc -p ./",
    "watch": "tsc --watch -p ./",
    "lint": "eslint src/",
    "pretest": "npm run compile && npm run lint",
    "test": "vscode-test",
    "copy:webview": "cp -r ../webview/dist ./webview-dist",
    "build:webview": "cd ../webview && npm run build && cd ../vsix && npm run copy:webview",
    "build": "npm run build:webview && npm run compile",
    "vscode:prepublish": "npm run build"
  }
}
```

**`webview/package.json` scripts (minimal):**

```json
{
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview"
  }
}
```

The webview package is self-contained. Its `build` script runs Vite. The vsix package is responsible for triggering the webview build and copying the output.

### 8.2 Development Watch Mode (Sibling Layout)

Development requires three processes running simultaneously, plus the F5 Extension Development Host. This is the cost of the sibling layout -- more moving parts than a nested package, but clear separation.

**Terminal 1 -- Extension TypeScript watch:**

```bash
cd vsix && npm run watch
# Runs: tsc --watch -p ./
# Recompiles vsix/src/ → vsix/out/ on change
```

**Terminal 2 -- WebView Vite watch:**

```bash
cd webview && npx vite build --watch
# Watches webview/src/ → webview/dist/ on change
```

**Terminal 3 -- Copy watcher (bridges sibling gap):**

```bash
# Watches webview/dist/ and copies to vsix/webview-dist/ on change
# Option A: fswatch (macOS, event-driven, recommended for dev)
cd vsix && fswatch -o ../webview/dist | while read; do cp -r ../webview/dist ./webview-dist; done

# Option B: Simple polling loop (no extra dependencies)
cd vsix && while true; do cp -r ../webview/dist ./webview-dist 2>/dev/null; sleep 2; done

# Option C: nodemon (cross-platform, requires npm install)
cd vsix && npx nodemon --watch ../webview/dist --exec "cp -r ../webview/dist ./webview-dist"
```

**Terminal 4 -- F5 in VS Code** launches the Extension Development Host.

After the copy watcher fires, reload the Extension Development Host window (`Cmd+R` in the dev host window) to pick up the new WebView assets. This is standard for VS Code WebView development -- there is no true hot reload for WebViews in the sidebar.

**Simplification with `concurrently`:** All three watch processes can be collapsed into a single `watch:all` script. This adds `concurrently` as a dev dependency in `vsix/`:

```json
{
  "scripts": {
    "watch:all": "concurrently -n ext,vite,copy \"npm run watch\" \"cd ../webview && npx vite build --watch\" \"fswatch -o ../webview/dist | while read; do cp -r ../webview/dist ./webview-dist; done\""
  }
}
```

For the prototype, three separate terminals is acceptable. The `concurrently` approach can be added as a quality-of-life improvement after the core build works.

### 8.3 Launch Configuration Changes

The current `vsix/.vscode/launch.json` has a single "Run Extension" config. For the prototype:

**Option A (recommended for prototype):** Keep the existing launch config as-is. Rely on watch mode being active in separate terminals. The `preLaunchTask` compiles only the extension TypeScript:

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Run Extension",
      "type": "extensionHost",
      "request": "launch",
      "args": ["--extensionDevelopmentPath=${workspaceFolder}/vsix"],
      "outFiles": ["${workspaceFolder}/vsix/out/**/*.js"],
      "preLaunchTask": "npm: compile - vsix"
    }
  ]
}
```

**Option B (full build on launch):** Change `preLaunchTask` to a compound task that builds the webview first:

```json
// .vscode/tasks.json
{
  "version": "2.0.0",
  "tasks": [
    {
      "label": "build:all",
      "dependsOn": ["build:webview", "compile:extension"],
      "dependsOrder": "sequence"
    },
    {
      "label": "build:webview",
      "type": "shell",
      "command": "cd vsix && npm run build:webview"
    },
    {
      "label": "compile:extension",
      "type": "shell",
      "command": "cd vsix && npm run compile"
    }
  ]
}
```

Option A is faster for iterative development (skips webview rebuild if already watching). Option B is safer for first-launch or after pulling changes.

### 8.4 VSIX Packaging

When packaging the extension with `vsce package`:

1. `vsce` runs `vscode:prepublish`, which triggers the full `build` script (webview build + copy + tsc)
2. `vsce` bundles everything in `vsix/` that is not in `.vscodeignore`
3. `vsix/webview-dist/` is included because it is NOT listed in `.vscodeignore`
4. `vsix/src/`, `vsix/node_modules/` test files, etc. are excluded by `.vscodeignore`

The sibling `webview/` directory is automatically excluded because `vsce` only packages from the extension root (`vsix/`). No special handling needed.

**Updated `.vscodeignore`:**

```
.vscode/**
src/**
out/test/**
**/*.ts
!webview-dist/**
**/tsconfig.json
**/.eslintrc*
**/eslint.config.*
**/*.map
```

The `!webview-dist/**` line ensures the copied WebView assets are explicitly included (defense against future additions to ignore patterns).

---

## 9. Risk Analysis for the Prototype

### 9.1 Sidebar WebView Width Constraints (Mitigated by Option B)

**Risk:** The functional design describes rich tables with 5-6 columns. A sidebar WebView is typically 250-400px wide. Tables won't fit.

**Mitigation:** Per the decision in Section 11.1 (Option B), the sidebar WebView shows only a compact summary/navigation view. The full-width Finding List and Finding Detail screens open in an editor-area `WebviewPanel` that has ample horizontal space for tables, filters, and code snippets. The sidebar only needs to display summary cards, progress indicators, and action buttons -- all of which fit comfortably in 250-400px.

### 9.2 ShadCN/Tailwind CSS Conflicts with VS Code

**Risk:** Tailwind's CSS reset may conflict with VS Code's WebView styling. ShadCN's default theme (light/dark) may clash with VS Code's theme.

**Mitigation:** Map ShadCN CSS variables to VS Code theme variables (Section 7.4). Test with both light and dark VS Code themes. Accept minor visual imperfections for the prototype.

### 9.3 Vite Build Output Stability

**Risk:** Vite may generate unexpected output filenames or chunk splits that break the extension's HTML template.

**Mitigation:** Lock output filenames in `vite.config.ts` with explicit `rollupOptions.output` (no content hashes). Disable code splitting for the prototype.

### 9.4 postMessage Type Safety

**Risk:** The message protocol between extension and WebView is untyped at runtime (`any` in the VS Code API). Type mismatches cause silent failures.

**Mitigation:** Define message types in `vsix/src/models/messages.ts` and copy to `webview/src/types/messages.ts`. Both sides compile against the same types. Runtime validation is deferred (YAGNI for prototype).

### 9.5 WebView State Loss

**Risk:** When the sidebar WebView is hidden (user collapses it or switches to another sidebar), the WebView document is destroyed. React state is lost.

**Mitigation:** On WebView creation, send `requestState` to get current data from the extension host. The extension host always holds the source of truth. For the prototype with mock data, this is trivial. For production, the pattern is the same but data comes from the database.

### 9.6 Icon/Resource Bundling

**Risk:** The activity bar requires an SVG icon (`resources/icon.svg`). If missing or malformed, the view container won't render.

**Mitigation:** Create a simple placeholder SVG icon. The icon must be a single-color SVG (VS Code themes it automatically). Keep it in `vsix/resources/`.

### 9.7 Sibling Copy Step Staleness

**Risk:** The copy step (`cp -r ../webview/dist ./webview-dist`) is a manual bridge between sibling packages. During development, a developer may forget to run it, leading to stale WebView assets in `vsix/webview-dist/` that don't reflect recent source changes. Debugging stale assets is confusing -- the developer edits React code, reloads the dev host, and sees no change.

**Mitigation (development):** Always use watch mode with an active copy watcher (Section 8.2, Terminal 3). If not using a watcher, run `npm run build:webview` in `vsix/` before reloading the dev host. The `build` script chains the copy automatically.

**Mitigation (CI/packaging):** The `vscode:prepublish` script runs the full build including the copy step. There is no path to a packaged VSIX with stale assets as long as `vsce package` is used (which always runs `vscode:prepublish`).

**Mitigation (awareness):** Document the copy requirement clearly in the project README and CLAUDE.md. Add a check in the launch config (`preLaunchTask`) that runs the copy step, or at minimum log a warning in the extension's `activate()` if `webview-dist/` is missing.

### 9.8 Type Definition Drift Between Packages

**Risk:** Message types are defined in `vsix/src/models/messages.ts` and manually copied to `webview/src/types/messages.ts`. If one is updated without the other, the postMessage protocol breaks silently at runtime.

**Mitigation:** For the prototype, keep types minimal and copy manually -- the surface area is small. For later phases, consider a shared types package or a copy script that runs as part of the build. The technical design acknowledges this tradeoff: "copied, not symlinked, to avoid build complications."

---

## 10. Patterns and Conventions

### 10.1 Message Protocol Convention

All messages use a discriminated union pattern:

```typescript
type Message = { type: string; payload?: unknown };
```

The `type` field is the discriminant. Extension-to-WebView messages push state. WebView-to-Extension messages are user actions. This is established in the technical design and must be followed by the prototype.

### 10.2 Extension Disposal Pattern

All VS Code registrations return `Disposable` objects. These must be pushed to `context.subscriptions` to ensure cleanup on deactivation:

```typescript
context.subscriptions.push(
  vscode.window.registerTreeDataProvider('id', provider),
  vscode.window.registerWebviewViewProvider('id', provider),
  vscode.commands.registerCommand('id', handler)
);
```

### 10.3 Nonce Generation for CSP

Each WebView render needs a unique nonce for the script tag:

```typescript
function getNonce(): string {
  let text = '';
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}
```

### 10.4 Type Sharing Between Packages

The technical design notes that types are "copied, not symlinked, to avoid build complications." For the prototype:

- Define canonical types in `vsix/src/models/types.ts` and `vsix/src/models/messages.ts`
- Copy to `webview/src/types/` manually or via a script
- Keep types minimal and focused on the message protocol and data shapes

---

## 11. Outstanding Questions (All Resolved)

### 11.1 Sidebar + Editor Panel for WebView (RESOLVED -- Option B)

**Decision:** Use the sidebar for compact navigation/summary and open a `WebviewPanel` in the **editor area** for detailed views (Finding List, Finding Detail).

**What this means architecturally:**

The prototype uses **two WebView contexts**, not one:

| Context | API | Location | Content |
|---------|-----|----------|---------|
| **Sidebar WebView** | `WebviewViewProvider` | Sidebar panel (under activity bar icon) | Compact dashboard: scan summary, triage progress bar, "Run Scan" button, quick-nav links |
| **Editor Panel WebView** | `WebviewPanel` | Editor area (full-width tab) | Full React app: Finding List with table/filters, Finding Detail with code snippet and disposition controls |

**Sidebar WebView (`WebviewViewProvider`):**
- Registered via `window.registerWebviewViewProvider('ashWorkbench.mainView', provider)`
- Always visible when the ASH Workbench sidebar is active
- Shows a compact, narrow-friendly summary (no tables with many columns)
- Clicking a scan in the tree view or a "View Findings" link in the sidebar triggers opening the editor panel

**Editor Panel WebView (`WebviewPanel`):**
- Created on demand via `vscode.window.createWebviewPanel('ashWorkbench.findingsPanel', 'ASH Findings', ...)`
- Opens in the editor area as a tab (full width, resizable)
- Hosts the full React/ShadCN UI: Finding List table, Finding Detail view, filters, disposition controls
- Can be closed by the user like any editor tab
- Destroyed when the tab is closed; reopened with fresh state on next request

**Both WebViews load the same Vite-built React app** from `vsix/webview-dist/`. The React app determines which view to render based on an initial message from the extension host (e.g., `{ type: 'init', payload: { view: 'sidebar' } }` vs `{ type: 'init', payload: { view: 'findingList', scanId: '...' } }`).

**Communication flow:**
1. User clicks a scan in the tree view (native VS Code)
2. Extension host receives the tree item click
3. Extension host creates/reveals the editor panel WebView
4. Extension host sends `{ type: 'showFindings', payload: { scanId, findings } }` to the editor panel
5. React app renders the Finding List
6. User clicks a finding -- React sends `{ type: 'selectFinding', payload: { findingId } }` back to extension host
7. Extension host responds with finding detail data
8. React renders Finding Detail in the same editor panel

**Implications for other sections:**
- Section 3.2 already covers `WebviewViewProvider`. A parallel analysis of `WebviewPanel` is needed (see below).
- Section 6.4 (WebView Provider) must cover both providers.
- Section 7.2 (State Management) adds a `context` discriminant so the React app knows if it's sidebar or editor panel.
- Section 7.5 (Screen Designs) assigns screens to contexts: Dashboard stays in sidebar; Finding List and Finding Detail move to editor panel.
- Section 12 (Implementation Plan) Phase 4 adds editor panel setup; Phase 5 splits screens by context.

**`WebviewPanel` API (for editor area):**

```typescript
const panel = vscode.window.createWebviewPanel(
  'ashWorkbench.findingsPanel',   // viewType identifier
  'ASH Findings',                  // Tab title
  vscode.ViewColumn.One,           // Editor column
  {
    enableScripts: true,
    localResourceRoots: [vscode.Uri.joinPath(extensionUri, 'webview-dist')],
    retainContextWhenHidden: false, // Destroy when tab is not visible (save memory)
  }
);

// Set HTML (same pattern as sidebar, same Vite assets)
panel.webview.html = getWebviewHtml(panel.webview, extensionUri);

// Message handling (same protocol)
panel.webview.onDidReceiveMessage(handler);
panel.webview.postMessage(message);

// Lifecycle
panel.onDidDispose(() => { /* cleanup */ });
```

**Key difference from sidebar:** `WebviewPanel` is created imperatively (not registered declaratively in `package.json`). It can be created, revealed, and disposed by extension code at any time. The sidebar `WebviewView` is declared in `package.json` and resolved by VS Code when the user opens the sidebar.

### 11.2 WebView Build Output Location (RESOLVED)

**Decision:** The sibling layout uses a copy step. Vite builds to `webview/dist/` (canonical output). The build process copies `webview/dist/` into `vsix/webview-dist/` (the copy target the extension reads at runtime). See Section 4.4 for the full copy pattern, Section 8.1 for the build scripts, and Section 8.4 for VSIX packaging implications. `vsix/webview-dist/` is gitignored as a build artifact.

### 11.3 Monorepo Package Management (RESOLVED -- Evaluate Yarn Workspaces)

**Decision:** Evaluate Yarn workspaces as the monorepo coordination tool.

Yarn workspaces are well-suited for the sibling layout. Here's what they provide and what to consider:

**What Yarn workspaces do:**

- **Single install:** `yarn install` at the root installs dependencies for all workspace packages (`vsix/`, `webview/`, `docs/`). No need to `cd` into each package and run separate installs.
- **Dependency hoisting:** Shared dev dependencies (TypeScript, ESLint) are installed once at the root `node_modules/` rather than duplicated in each package. Each package still has its own `package.json` declaring its deps.
- **Cross-package scripts:** `yarn workspace vsix build`, `yarn workspace webview build`, or `yarn workspaces foreach run build` to run scripts across packages.
- **Root-level scripts:** A root `package.json` can define `build:all`, `watch:all`, `clean:all` orchestration scripts.
- **No phantom deps:** Unlike npm workspaces, Yarn (especially v4/Berry with PnP) catches undeclared dependencies at compile time rather than silently resolving them from hoisted packages.

**Root `package.json` setup:**

```json
{
  "private": true,
  "workspaces": ["vsix", "webview", "docs"],
  "scripts": {
    "build": "yarn workspace webview build && yarn workspace vsix build",
    "watch:all": "concurrently \"yarn workspace vsix watch\" \"yarn workspace webview build --watch\"",
    "install:all": "yarn install"
  }
}
```

**Considerations:**
- The project currently uses npm (`package-lock.json` in `vsix/`). Switching to Yarn means replacing `package-lock.json` with `yarn.lock` and updating CI/CD scripts.
- Yarn Classic (v1) workspaces work similarly to npm workspaces. Yarn Berry (v4) adds Plug'n'Play (PnP) which is more strict but can conflict with VS Code extension tooling (`vsce`, `@vscode/test-cli`) that expects `node_modules/`. If using Berry, the `nodeLinker: node-modules` setting avoids PnP issues.
- VS Code extension tooling (`vsce package`) must run from the `vsix/` directory specifically. Yarn workspaces don't change this -- `vsce` still packages from the extension root.

**Recommendation for prototype:** Set up Yarn workspaces at the root level early. The benefits (single install, coordinated scripts, hoisted deps) improve developer experience immediately and the setup cost is low. Use Yarn Classic (v1) or Yarn Berry with `nodeLinker: node-modules` to avoid PnP complications with VS Code tooling. If Yarn introduces friction during prototype development, fall back to independent npm installs per package.

### 11.4 Tailwind v4 (RESOLVED -- Confirmed)

**Decision:** Use Tailwind CSS v4 as specified in the technical design. Tailwind v4 uses CSS-first configuration (no `tailwind.config.js`). ShadCN's current `init` command targets Tailwind v4. No compatibility concerns.

### 11.5 React 19 / Vite Project Setup (RESOLVED -- Manual Creation)

**Decision:** The Vite/React project at `workbench/webview/` will be manually created from the latest Vite version, not scaffolded by `create-vite` or auto-generated. This ensures full control over the project structure, configuration, and dependency versions.

The implementer will:
1. Create `webview/package.json` manually with exact dependency versions
2. Create `webview/vite.config.ts` with the required settings (fixed output filenames, no code splitting, React plugin)
3. Create `webview/tsconfig.json` targeting browser/ES2022
4. Add the ShadCN/Tailwind configuration manually
5. Create the React entry point (`main.tsx`, `App.tsx`) by hand

This avoids scaffold boilerplate (README templates, default assets, sample components) and produces a minimal, purpose-built package from the start.

### 11.6 Cross-Platform Copy Step

The `cp -r` command works on macOS and Linux but not on Windows. For the prototype (developed on macOS), this is fine. For broader contributor support, the copy step should use a cross-platform tool like `shx` (`shx cp -r`), `cpy-cli`, or a small Node.js script using `fs.cpSync()` (available in Node.js 16.7+). This is a future concern, not a prototype blocker.

---

## 12. Recommended Implementation Plan

### Phase 1: Extension Skeleton and View Container

1. **Restructure vsix/src** -- Create the directory structure (commands/, providers/, models/, mock/) per Section 6.1
2. **Define TypeScript types** -- Create `types.ts` and `messages.ts` with the data model and message protocol types
3. **Create mock data** -- Build `mock/data.ts` with realistic scan and finding data covering all visual states
4. **Update package.json** -- Add view container, views (sidebar webview + tree), commands, configuration, and activation events
5. **Create placeholder icon** -- Add `resources/icon.svg` for the activity bar
6. **Implement extension entry point** -- Rewrite `extension.ts` to register all providers and commands
7. **Verify the view container renders** -- The activity bar icon appears, clicking it shows the sidebar with empty views

### Phase 2: Tree View with Mock Data

1. **Implement ScanTreeProvider** -- `TreeDataProvider` that renders mock scan data as tree items with status icons
2. **Wire tree item click** -- Clicking a scan tree item stores selection and triggers the editor panel to open (Phase 4)
3. **Add context menu** -- Register "Delete Scan" context menu item on tree items (shows confirmation message only)
4. **Verify tree view** -- Scans appear in the sidebar with correct icons, labels, descriptions

### Phase 3: WebView Sibling Package Setup

The webview package at `workbench/webview/` will be **manually created** (not scaffolded by `create-vite`) to ensure a minimal, purpose-built structure.

1. **Evaluate Yarn workspaces** -- Optionally set up a root `workbench/package.json` with `"workspaces": ["vsix", "webview"]` (Section 11.3). If Yarn is adopted, run `yarn install` at the root to install both packages. If not, proceed with independent npm installs.
2. **Create `workbench/webview/` directory** -- Manually create `package.json` with exact dependency versions: React 19, ReactDOM, Vite 6.x, `@vitejs/plugin-react`, TypeScript 5.x
3. **Configure Vite** -- Manually create `vite.config.ts` with fixed output filenames (`rollupOptions.output` with no content hashes, no code splitting). Output to `webview/dist/`.
4. **Configure TypeScript** -- Create `tsconfig.json` targeting browser/ES2022 with strict mode
5. **Install and configure Tailwind v4** -- Set up CSS-first configuration in `globals.css` with VS Code theme variable mappings (Section 7.4)
6. **Initialize ShadCN** -- Run `npx shadcn@latest init`, install required components (Table, Badge, Button, Card, Select, Input, Progress)
7. **Create React entry point** -- `main.tsx`, `App.tsx` with context-aware root component and basic message bridge hook
8. **Copy message types** -- Duplicate `vsix/src/models/types.ts` and `vsix/src/models/messages.ts` to `webview/src/types/`
9. **Build and verify** -- Run `cd webview && npm run build` (or `yarn workspace webview build`). Confirm output at `webview/dist/assets/index.js` and `webview/dist/assets/index.css` with known, stable filenames.
10. **Set up copy step** -- Add `copy:webview` and `build:webview` scripts to `vsix/package.json` (Section 8.1). Run the build:webview script and confirm `vsix/webview-dist/assets/index.js` exists.
11. **Gitignore the copy target** -- Add `webview-dist/` to `vsix/.gitignore`

### Phase 4: Dual WebView Providers and Message Bridge

This phase implements both WebView contexts per the Option B decision (Section 11.1).

1. **Create shared HTML generator** -- Implement `webviewHtml.ts` with `getWebviewHtml(webview, extensionUri)` that generates CSP, nonce, and asset references from `webview-dist/` (Section 6.4.3)
2. **Implement sidebar `WebviewViewProvider`** -- `SidebarWebviewProvider` loads the React app, sends `{ type: 'init', payload: { context: 'sidebar' } }`, handles sidebar-specific messages (Section 6.4.1)
3. **Implement editor panel manager** -- `FindingsPanelManager` creates `WebviewPanel` on demand, sends `{ type: 'init', payload: { context: 'editorPanel', scanId } }`, handles finding-specific messages (Section 6.4.2)
4. **Wire tree view to editor panel** -- Clicking a scan in the tree view calls `FindingsPanelManager.showFindings(scanId)` which creates/reveals the panel and pushes finding data
5. **Wire sidebar to editor panel** -- "View Findings" action in the sidebar sends a message to extension host, which triggers `FindingsPanelManager`
6. **Wire postMessage in React** -- `useVSCodeAPI` hook, message listener in `App.tsx` that reads `context` from `init` message and dispatches to reducer
7. **Verify round-trip** -- Build webview, run copy step, F5 launch. Sidebar loads with summary. Click scan in tree view. Editor panel opens with "Hello from React" and correct context.

### Phase 5: WebView UI Screens

#### Sidebar screens:
1. **SidebarDashboard component** -- Compact summary: triage progress, severity counts, "Run Scan" button, "View Findings" link (Section 7.5)

#### Editor panel screens:
2. **FindingList component** -- Full-width finding table with severity badges, filter controls, disposition badges, scan header
3. **FindingDetail component** -- Finding header, disposition button group, code snippet, scanner info
4. **Panel navigation** -- Implement screen transitions within the editor panel (Finding List to Finding Detail and back) via React state
5. **Code navigation** -- "Navigate to code" action sends `navigateToCode` message to extension, which calls `vscode.window.showTextDocument`

### Phase 6: Build Integration and Polish

1. **Wire `vscode:prepublish`** -- Ensure `vsix/package.json` `"vscode:prepublish": "npm run build"` chains webview build + copy + tsc compile (Section 8.1)
2. **Set up development watch mode** -- Configure three-terminal watch workflow (Section 8.2): tsc watch, Vite watch, copy watcher. Optionally add `concurrently`-based `watch:all` script.
3. **Update launch configuration** -- Set `preLaunchTask` to build both packages, or document the watch-mode prerequisite (Section 8.3)
4. **Update `.vscodeignore`** -- Ensure `webview-dist/` is included in VSIX package, source files are excluded (Section 8.4)
5. **Test with VS Code themes** -- Verify rendering in light and dark themes, in both sidebar and editor panel contexts
6. **Verify all prototype exit criteria:**
   - Activity bar icon with ASH Workbench view container
   - Tree view with mock scans (all statuses, icons, descriptions)
   - Sidebar WebView with compact dashboard summary
   - Editor panel WebView opening from tree view click
   - Finding List with filters and severity/disposition badges in editor panel
   - Finding Detail with code snippet and disposition controls in editor panel
   - Screen navigation within editor panel (list to detail and back)
   - Disposition changes (in-memory, reflected in UI)
   - Code navigation (opens file in editor)
7. **Document the setup** -- Update project README and CLAUDE.md with build instructions covering the sibling layout, Yarn workspaces (if adopted), and the watch mode workflow
