---
title: VS Code Extension Development Reference
---

# VS Code Extension Development Reference

Compiled from official VS Code documentation (March 2026). Covers extension capabilities, implementation patterns, and UX conventions. Organized by UI surface area with merged technical guides and UX guidelines.

Sources: https://code.visualstudio.com/api/extension-guides/overview, https://code.visualstudio.com/api/ux-guidelines/overview

---

## 1. Critical Constraints

- **No DOM access.** Extensions cannot access the VS Code UI DOM.
- **No custom stylesheets.** Injecting CSS into the workbench is unsupported.
- **Extensions run in Node.js** (not the browser), with access to the full `vscode` API via `require('vscode')`.
- **`package.json`** is the declarative manifest for all contribution points (commands, views, menus, settings, etc.).
- All UI is built through VS Code's extension APIs, not direct HTML manipulation (except within webviews).

## 2. Extension Lifecycle

### Activation

Extensions activate on specific events declared in `package.json`. Modern VS Code auto-generates activation events from contribution points — explicit `activationEvents` are rarely needed.

Common activation triggers:
- `onCommand:myExtension.doSomething` — when a command is invoked
- `onView:myViewId` — when a view is opened (auto-generated)
- `onStartupFinished` — after VS Code startup completes
- `*` — activate on startup (avoid unless necessary)

### Entry Point Pattern

```typescript
import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext) {
  // Register commands, providers, listeners
  // Push disposables to context.subscriptions for cleanup
  const disposable = vscode.commands.registerCommand('myExtension.hello', () => {
    vscode.window.showInformationMessage('Hello!');
  });
  context.subscriptions.push(disposable);
}

export function deactivate() {
  // Optional cleanup
}
```

### Key `context` Properties

- `context.subscriptions` — array of disposables, cleaned up on deactivation
- `context.extensionUri` — URI to extension install directory
- `context.workspaceState` — per-workspace key-value storage
- `context.globalState` — global key-value storage
- `context.secrets` — secure secret storage

---

## 3. Commands

Commands expose functionality to users, bind to UI actions, and implement internal logic.

> **UX rules:** Title-case names. Start with action verbs. Include target nouns. Never include the word "command". Use a `category` prefix to group related commands (e.g., `"category": "My Extension"` produces "My Extension: Do Something" in the palette). Don't override existing keyboard shortcuts.

### Registration

```typescript
vscode.commands.registerCommand('myExtension.sayHello', () => {
  vscode.window.showInformationMessage('Hello!');
});
```

### package.json — Expose in Command Palette

```json
{
  "contributes": {
    "commands": [
      {
        "command": "myExtension.sayHello",
        "title": "Say Hello",
        "category": "My Extension"
      }
    ]
  }
}
```

### Conditional Display

Restrict when commands appear in the Command Palette:

```json
{
  "contributes": {
    "menus": {
      "commandPalette": [
        {
          "command": "myExtension.sayHello",
          "when": "editorLangId == markdown"
        }
      ]
    }
  }
}
```

### Custom Context Keys

Set custom context for `when` clauses:

```typescript
vscode.commands.executeCommand('setContext', 'myExtension.isActive', true);
```

### Programmatic Execution

```typescript
await vscode.commands.executeCommand('myExtension.sayHello');
// Some built-in commands return results:
const defs = await vscode.commands.executeCommand('vscode.executeDefinitionProvider', uri, pos);
```

### Command URIs

Invoke commands from markdown or webviews using `command:` URIs. Markdown strings containing command URIs must have `isTrusted` set to `true`.

---

## 4. Activity Bar and View Containers

View Containers appear as icons in the Activity Bar (sidebar) or Panel (bottom). They hold one or more Views.

> **UX rules:** Use an icon matching the Activity Bar aesthetic. One container per extension is typical. Don't duplicate existing icons. Don't use an Activity Bar item solely to launch a webview panel. Descriptive names. 3-5 views maximum.

### package.json — Activity Bar Container

```json
{
  "contributes": {
    "viewsContainers": {
      "activitybar": [
        {
          "id": "myContainer",
          "title": "My Container",
          "icon": "resources/icon.svg"
        }
      ]
    },
    "views": {
      "myContainer": [
        {
          "id": "myView",
          "name": "My View"
        }
      ]
    }
  }
}
```

Views can also be placed in built-in containers: `explorer`, `debug`, `scm`, `test`.

### Sidebar Toolbars

- **Multiple views:** A single `...` menu appears in the sidebar toolbar.
- **Single view:** All view actions render directly in the toolbar. Minimize actions to reduce clutter.

---

## 5. Tree Views

Tree Views display hierarchical data in the sidebar, conforming to built-in styling.

> **UX rules:** Use descriptive labels. Use product icons to differentiate item types. Don't use tree items as command buttons. Limit nesting depth. Restrict to 3 or fewer inline actions per item. Prefer Tree Views for data presentation over custom Webview Views.

### TreeDataProvider

```typescript
class MyTreeDataProvider implements vscode.TreeDataProvider<MyItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<MyItem | undefined>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  getChildren(element?: MyItem): MyItem[] {
    // Return child elements, or root elements if element is undefined
  }

  getTreeItem(element: MyItem): vscode.TreeItem {
    // Convert data to UI representation
    // Set collapsibleState: None, Collapsed, or Expanded
  }

  refresh(): void {
    this._onDidChangeTreeData.fire(undefined);
  }
}
```

### Registration

```typescript
// Basic:
vscode.window.registerTreeDataProvider('myView', provider);

// With programmatic access (reveal, selection, etc.):
const treeView = vscode.window.createTreeView('myView', {
  treeDataProvider: provider
});
```

### View Actions (Menus)

Three locations: view title bar, item context menu, item inline.

```json
{
  "contributes": {
    "menus": {
      "view/title": [
        {
          "command": "myExtension.refresh",
          "when": "view == myView",
          "group": "navigation"
        }
      ],
      "view/item/context": [
        {
          "command": "myExtension.editEntry",
          "when": "view == myView && viewItem == myItemType"
        }
      ]
    }
  }
}
```

Use `viewItem` context values to differentiate menu items per tree item type. Set via `TreeItem.contextValue`.

### Welcome Content

Shown when a view has no data:

```json
{
  "contributes": {
    "viewsWelcome": [
      {
        "view": "myView",
        "contents": "No items found.\n[Get Started](command:myExtension.init)"
      }
    ]
  }
}
```

> **Welcome View UX:** Prefer links over buttons. Reserve buttons for primary actions. Keep content concise. Don't use for promotional content.

### Views With Progress

```typescript
vscode.window.withProgress(
  { location: { viewId: 'myView' } },
  async (progress) => {
    // Perform work — progress spinner shows on the view
  }
);
```

---

## 6. Webviews

Webviews display custom HTML/CSS/JS content within VS Code. Think of them as iframes controlled by your extension.

> **UX rules:** Only use when native APIs are insufficient. Theme everything with VS Code CSS variables. No promotional content. No wizards. Don't launch on extension updates. Don't duplicate existing features (Welcome, Settings, etc.). Follow accessibility standards (contrast, ARIA labels, keyboard nav).

### When to Use

- Standalone panels: `createWebviewPanel`
- Sidebar/panel views: `WebviewView`
- Custom editors: `registerCustomEditorProvider`

**"Just because you can do something with webviews, doesn't mean you should."**

### Creating a Panel

```typescript
const panel = vscode.window.createWebviewPanel(
  'viewType',            // Identifier
  'Display Title',       // User-visible title
  vscode.ViewColumn.One, // Editor column
  {
    enableScripts: true,
    localResourceRoots: [vscode.Uri.joinPath(context.extensionUri, 'media')]
  }
);
panel.webview.html = getWebviewContent();
```

### Lifecycle Events

- `panel.onDidDispose` — panel closed by user or extension
- `panel.onDidChangeViewState` — visibility or column changed
- `panel.visible` — check current visibility
- `panel.reveal()` — bring panel to foreground

### Loading Local Resources

Webviews cannot directly access local files. Convert paths:

```typescript
const uri = vscode.Uri.joinPath(context.extensionUri, 'media', 'style.css');
const webviewUri = panel.webview.asWebviewUri(uri);
```

Restrict access via `localResourceRoots`. Empty array `[]` blocks all local resources.

### Theming

CSS classes on `<body>`: `vscode-light`, `vscode-dark`, `vscode-high-contrast`.

CSS variables with `--vscode-` prefix:

```css
code { color: var(--vscode-editor-foreground); }
body { background: var(--vscode-editor-background); }
```

Accessibility classes: `vscode-using-screen-reader`, `vscode-reduce-motion`.

### Message Passing

**Extension to Webview:**

```typescript
// Extension side
panel.webview.postMessage({ command: 'update', data: value });

// Webview side
window.addEventListener('message', event => {
  const message = event.data;
  switch (message.command) {
    case 'update': /* handle */ break;
  }
});
```

**Webview to Extension:**

```typescript
// Webview side — acquireVsCodeApi() can only be called ONCE
const vscode = acquireVsCodeApi();
vscode.postMessage({ command: 'save', text: 'data' });

// Extension side
panel.webview.onDidReceiveMessage(message => {
  switch (message.command) {
    case 'save': /* handle */ break;
  }
});
```

### Security — Content Security Policy

Always include a CSP in webview HTML:

```html
<meta http-equiv="Content-Security-Policy"
      content="default-src 'none'; img-src ${webview.cspSource} https:;
              script-src ${webview.cspSource}; style-src ${webview.cspSource};">
```

- Set `localResourceRoots` restrictively
- Sanitize all user input and workspace data
- Never leak the `vscode` API object to global scope
- Extract inline styles/scripts to external files

### State Persistence

**Option 1 — getState/setState (recommended):**

```typescript
const vscode = acquireVsCodeApi();
const prev = vscode.getState();
vscode.setState({ value: newValue });
```

**Option 2 — Serialization (survives VS Code restarts):**

```typescript
vscode.window.registerWebviewPanelSerializer('viewType', {
  async deserializeWebviewPanel(panel, state) {
    panel.webview.html = getWebviewContent();
  }
});
```

**Option 3 — `retainContextWhenHidden: true`** (high memory cost — use sparingly).

### Webview Context Menus

```json
{
  "contributes": {
    "menus": {
      "webview/context": [
        { "command": "myExtension.action", "when": "webviewId == 'myWebview'" }
      ]
    }
  }
}
```

Set context in HTML: `<div data-vscode-context='{"webviewSection": "main"}'>`.

---

## 7. Status Bar

The Status Bar displays workspace info and actions at the bottom of the workbench.

> **UX rules:** Concise text labels. Icons sparingly — only universally recognizable metaphors. Left side = global/workspace items. Right side = contextual/file items. No custom colors. Minimal items (shared space with other extensions).

### Standard Item

```typescript
const item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
item.text = '$(shield) Secure';
item.command = 'myExtension.showStatus';
item.tooltip = 'Click for security status';
item.show();
context.subscriptions.push(item);
```

### Progress (Spin Animation)

```typescript
item.text = '$(sync~spin) Scanning...';
```

### Error/Warning Background

```typescript
item.backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground');
item.text = '$(error) 3 Issues';
```

Reserve error/warning backgrounds for exceptional, blocking situations.

---

## 8. Notifications and Progress

> **UX rules:** Show notifications only when truly necessary. Include "Do not show again" on every notification. One notification at a time. Don't use for promotional content. Don't request feedback on first install. Don't leave progress running indefinitely.

### Decision Framework

- Multi-step input needed? Use a **Quick Pick**
- Single confirmation? Use a **modal dialog**
- Low-priority background progress? Use the **Status Bar**
- Multiple notifications? **Consolidate** into one
- Not essential? Show **nothing**

### Notification Types

```typescript
vscode.window.showInformationMessage('Scan complete.');
vscode.window.showWarningMessage('Configuration missing.');
vscode.window.showErrorMessage('Scan failed.', 'Retry', 'Show Log');
```

### Progress — Notification

```typescript
vscode.window.withProgress(
  {
    location: vscode.ProgressLocation.Notification,
    title: 'Running scan',
    cancellable: true
  },
  async (progress, token) => {
    token.onCancellationRequested(() => { /* cleanup */ });
    progress.report({ increment: 30, message: 'Analyzing files...' });
    // Do work
    progress.report({ increment: 70, message: 'Generating report...' });
  }
);
```

### Progress — Status Bar

```typescript
vscode.window.withProgress(
  { location: vscode.ProgressLocation.Window, title: 'Indexing...' },
  async () => { /* work */ }
);
```

### Progress — View

```typescript
vscode.window.withProgress(
  { location: { viewId: 'myView' } },
  async () => { /* work — spinner on view title */ }
);
```

### Modal Dialogs

```typescript
const result = await vscode.window.showWarningMessage(
  'Delete all scan results?',
  { modal: true },
  'Delete',
  'Cancel'
);
```

Provide "Always"/"Never" options to reduce repeated confirmations.

---

## 9. Quick Picks and Input

Quick Picks capture user input for selection, configuration, and filtering.

> **UX rules:** Always include placeholders. Use titles for multi-step picks. Icons should establish clear visual metaphors. Don't replicate existing functionality. Don't use for extended wizard-like flows.

### Simple Quick Pick

```typescript
const result = await vscode.window.showQuickPick(['option1', 'option2'], {
  placeHolder: 'Select an option',
  title: 'My Quick Pick'
});
```

### Rich Items

```typescript
const items: vscode.QuickPickItem[] = [
  { label: '$(file) Item 1', description: 'Current', detail: 'Additional context' },
  { label: '$(folder) Item 2', description: 'Default' }
];
const selected = await vscode.window.showQuickPick(items, { placeHolder: 'Choose...' });
```

### Multi-Step

```typescript
const quickPick = vscode.window.createQuickPick();
quickPick.title = 'Step 1 of 3';
quickPick.step = 1;
quickPick.totalSteps = 3;
quickPick.items = items;
quickPick.show();
```

### Multi-Select

```typescript
const selected = await vscode.window.showQuickPick(items, {
  canPickMany: true,
  placeHolder: 'Select multiple...'
});
```

### Separators

Use `QuickPickItemKind.Separator` to divide items into labeled groups.

### Input Box

```typescript
const value = await vscode.window.showInputBox({
  prompt: 'Enter project name',
  placeHolder: 'my-project',
  validateInput: (text) => text.length === 0 ? 'Name required' : null
});
```

---

## 10. Settings (Configuration)

> **UX rules:** Default values on every setting. Clear, concise descriptions. Link to documentation for complex settings. Never create custom settings pages or webviews.

### package.json — Configuration

```json
{
  "contributes": {
    "configuration": {
      "title": "My Extension",
      "properties": {
        "myExtension.enable": {
          "type": "boolean",
          "default": true,
          "description": "Enable the extension."
        },
        "myExtension.outputLevel": {
          "type": "string",
          "default": "normal",
          "enum": ["quiet", "normal", "verbose"],
          "enumDescriptions": [
            "Minimal output",
            "Standard output",
            "Detailed output with debug info"
          ],
          "description": "Controls output verbosity."
        },
        "myExtension.excludePaths": {
          "type": "array",
          "default": [],
          "items": { "type": "string" },
          "description": "Paths to exclude from scanning."
        }
      }
    }
  }
}
```

### Reading Settings

```typescript
const config = vscode.workspace.getConfiguration('myExtension');
const level = config.get<string>('outputLevel', 'normal');
```

### Listening for Changes

```typescript
vscode.workspace.onDidChangeConfiguration(e => {
  if (e.affectsConfiguration('myExtension.outputLevel')) {
    // React to change
  }
});
```

### Setting Types

Boolean, String, Number, Array, Object (key-value pairs), String with `enum` (dropdown).

### Linking to Settings

```typescript
vscode.window.showInformationMessage(
  'Configure output in [settings](command:workbench.action.openSettings?%22myExtension.outputLevel%22).'
);
```

---

## 11. Context Menus

> **UX rules:** Only show items when contextually relevant (use `when` clauses). Group similar actions. Use submenus for large action sets. Don't show actions on every file unconditionally.

### package.json — Menu Contributions

```json
{
  "contributes": {
    "menus": {
      "editor/context": [
        {
          "command": "myExtension.analyzeSelection",
          "when": "editorHasSelection",
          "group": "1_modification"
        }
      ],
      "explorer/context": [
        {
          "command": "myExtension.scanFile",
          "when": "resourceScheme == file",
          "group": "navigation"
        }
      ],
      "view/item/context": [
        {
          "command": "myExtension.openDetail",
          "when": "view == myView && viewItem == finding"
        }
      ]
    }
  }
}
```

### Standard Menu Groups

- `navigation` — top of the menu
- `1_modification` — modification commands
- `9_cutcopypaste` — cut/copy/paste area

### Submenus

```json
{
  "contributes": {
    "submenus": [
      { "id": "myExtension.submenu", "label": "My Extension" }
    ],
    "menus": {
      "editor/context": [
        { "submenu": "myExtension.submenu", "group": "navigation" }
      ],
      "myExtension.submenu": [
        { "command": "myExtension.action1" },
        { "command": "myExtension.action2" }
      ]
    }
  }
}
```

### All Menu Locations

`commandPalette`, `editor/context`, `editor/title`, `explorer/context`, `view/title`, `view/item/context`, `webview/context`, `scm/title`, `scm/resourceState/context`, `testing/item/context`

---

## 12. Panel

The Panel is the bottom area (Terminal, Problems, Output). Extensions can contribute View Containers and Views here.

> **UX rules:** Use for views benefiting from horizontal space. Don't place views that need constant visibility — users frequently minimize panels. Ensure webview content resizes properly. Don't add excessive toolbar buttons (use context menus). Use existing product icons.

### package.json — Panel Container

```json
{
  "contributes": {
    "viewsContainers": {
      "panel": [
        {
          "id": "myPanelContainer",
          "title": "My Panel",
          "icon": "resources/icon.svg"
        }
      ]
    },
    "views": {
      "myPanelContainer": [
        {
          "id": "myPanelView",
          "name": "My Panel View"
        }
      ]
    }
  }
}
```

Panel views use the same TreeDataProvider or WebviewViewProvider APIs as sidebar views.

---

## 13. Task Provider

Task Providers auto-detect and provide tasks to users without manual `tasks.json` definitions.

### package.json — Task Definition

```json
{
  "contributes": {
    "taskDefinitions": [
      {
        "type": "myTool",
        "required": ["command"],
        "properties": {
          "command": {
            "type": "string",
            "description": "The command to run"
          },
          "args": {
            "type": "array",
            "description": "Command arguments"
          }
        },
        "when": "shellExecutionSupported"
      }
    ]
  }
}
```

### Implementation

```typescript
vscode.tasks.registerTaskProvider('myTool', {
  provideTasks(): vscode.Task[] {
    // Return all available tasks
    return getMyTasks();
  },
  resolveTask(task: vscode.Task): vscode.Task | undefined {
    // Resolve a specific task (performance optimization)
    return task;
  }
});
```

### Execution Types

```typescript
// Shell — runs through OS shell
new vscode.ShellExecution('mytool scan --path .');

// Process — direct process invocation
new vscode.ProcessExecution('mytool', ['scan', '--path', '.']);

// Custom — full control via Pseudoterminal interface
new vscode.CustomExecution(async () => new MyPseudoterminal());
```

### Creating Task Objects

```typescript
const task = new vscode.Task(
  { type: 'myTool', command: 'scan' },  // definition
  vscode.TaskScope.Workspace,            // scope
  'Scan Workspace',                      // display name
  'myTool',                              // source
  new vscode.ShellExecution('mytool scan --path .')
);
```

---

## 14. Diagnostics and Code Actions

Diagnostics show issues as squiggly underlines in editors and in the Problems panel. No `package.json` contribution needed — purely programmatic.

### DiagnosticSeverity

- `DiagnosticSeverity.Error` (0) — red squiggly
- `DiagnosticSeverity.Warning` (1) — yellow squiggly
- `DiagnosticSeverity.Information` (2) — blue squiggly
- `DiagnosticSeverity.Hint` (3) — subtle dots

### Implementation

```typescript
let diagnosticCollection: vscode.DiagnosticCollection;

export function activate(ctx: vscode.ExtensionContext): void {
  diagnosticCollection = vscode.languages.createDiagnosticCollection('myExtension');
  ctx.subscriptions.push(diagnosticCollection);

  ctx.subscriptions.push(
    vscode.workspace.onDidSaveTextDocument(doc => updateDiagnostics(doc))
  );
  ctx.subscriptions.push(
    vscode.workspace.onDidOpenTextDocument(doc => updateDiagnostics(doc))
  );
}

function updateDiagnostics(document: vscode.TextDocument): void {
  const findings = analyzeDocument(document);
  const diagnostics: vscode.Diagnostic[] = findings.map(finding => {
    const range = new vscode.Range(
      finding.line - 1, finding.startColumn,
      finding.line - 1, finding.endColumn
    );
    const diagnostic = new vscode.Diagnostic(range, finding.message, finding.severity);
    diagnostic.source = 'My Extension';
    diagnostic.code = finding.ruleId;
    return diagnostic;
  });
  diagnosticCollection.set(document.uri, diagnostics);
}
```

### Diagnostic Properties

```typescript
diagnostic.source = 'Extension Name';     // shown in Problems panel
diagnostic.code = 'RULE-001';             // optional rule ID
diagnostic.code = {                        // or with a documentation link
  value: 'RULE-001',
  target: vscode.Uri.parse('https://docs.example.com/rules/001')
};
diagnostic.relatedInformation = [
  new vscode.DiagnosticRelatedInformation(
    new vscode.Location(otherUri, otherRange),
    'Related issue here'
  )
];
diagnostic.tags = [vscode.DiagnosticTag.Unnecessary]; // fade out code
```

### Managing Diagnostics

```typescript
diagnosticCollection.set(uri, diagnostics); // set for a file
diagnosticCollection.delete(uri);           // clear for a file
diagnosticCollection.clear();               // clear all
```

### Code Actions (Quick Fixes)

Provide corrective actions next to diagnostics. Light bulb icon appears when available.

```typescript
class MyCodeActionProvider implements vscode.CodeActionProvider {
  provideCodeActions(
    document: vscode.TextDocument,
    range: vscode.Range | vscode.Selection,
    context: vscode.CodeActionContext,
    token: vscode.CancellationToken
  ): vscode.CodeAction[] {
    return context.diagnostics
      .filter(d => d.source === 'My Extension')
      .map(diagnostic => {
        const fix = new vscode.CodeAction(
          `Fix: ${diagnostic.message}`,
          vscode.CodeActionKind.QuickFix
        );
        fix.diagnostics = [diagnostic];
        fix.edit = new vscode.WorkspaceEdit();
        fix.edit.replace(document.uri, diagnostic.range, 'corrected code');
        return fix;
      });
  }
}

// Register
context.subscriptions.push(
  vscode.languages.registerCodeActionsProvider(
    { scheme: 'file' },
    new MyCodeActionProvider()
  )
);
```

---

## 15. Supplemental Reference

Brief entries for features that may be needed. See full guides in `docs/docs/working/extension-guide/downloaded/` for details.

### Walkthroughs

Onboarding checklists via `contributes.walkthroughs`. Steps have titles, descriptions with command links, media (prefer SVGs with `--vscode-` CSS variables for theming), and `completionEvents`. Keep step count minimal. One walkthrough per extension.

### Workspace Trust

Declare in `package.json` via `capabilities.untrustedWorkspaces`: `supported: true | false | "limited"`. Use `restrictedConfigurations` to gate specific settings. API: `vscode.workspace.isTrusted`, `onDidGrantWorkspaceTrust`. Context key: `isWorkspaceTrusted`.

### Telemetry

Use `@vscode/extension-telemetry` npm package. Respect `vscode.env.isTelemetryEnabled`. Tag custom telemetry settings with `"tags": ["telemetry", "usesOnlineServices"]`. Never override user telemetry preferences.

### AI Chat Participants

Register via `contributes.chatParticipants` with `id`, `name` (lowercase), `fullName` (title case). Implement `ChatRequestHandler`. Define slash commands. One participant per extension. Use `@vscode/chat-extension-utils` for tool calling.

### Editor Actions

Add buttons to the editor toolbar via `menus.editor/title`. Use `when` clauses for contextual display. Use existing codicon icons. Assign secondary actions to the `...` overflow menu.

### Virtual Documents

`TextDocumentContentProvider` serves read-only content for custom URI schemes. Register with `vscode.workspace.registerTextDocumentContentProvider()`. Use `EventEmitter` for content updates. Verify `document.uri.scheme` before processing events.

### Testing API

`vscode.tests.createTestController()` with `TestItem` hierarchy. Create run profiles for Run/Debug/Coverage. Discovery via `resolveHandler` (lazy) or `onDidOpenTextDocument` (active). Report results with `run.passed()`, `run.failed()`. Use `WeakMap` for custom test metadata.

---

## 16. API Quick Reference

Common APIs not covered in depth above.

### Output Channel

```typescript
const output = vscode.window.createOutputChannel('My Extension');
output.appendLine('Starting scan...');
output.show(); // bring to front
context.subscriptions.push(output);

// Log channel (adds timestamps, supports log levels)
const log = vscode.window.createOutputChannel('My Extension', { log: true });
log.info('Scan started');
log.warn('Slow response');
log.error('Connection failed');
```

### File Decorations

Add badges, colors, and tooltips to files in the Explorer:

```typescript
class MyDecorationProvider implements vscode.FileDecorationProvider {
  private _onDidChangeFileDecorations = new vscode.EventEmitter<vscode.Uri | vscode.Uri[]>();
  readonly onDidChangeFileDecorations = this._onDidChangeFileDecorations.event;

  provideFileDecoration(uri: vscode.Uri): vscode.FileDecoration | undefined {
    if (hasFindings(uri)) {
      return {
        badge: '3',
        color: new vscode.ThemeColor('problemsWarningIcon.foreground'),
        tooltip: '3 security findings'
      };
    }
  }

  refresh(uri: vscode.Uri): void {
    this._onDidChangeFileDecorations.fire(uri);
  }
}

context.subscriptions.push(
  vscode.window.registerFileDecorationProvider(new MyDecorationProvider())
);
```

### File System Watcher

```typescript
const watcher = vscode.workspace.createFileSystemWatcher('**/*.json');
watcher.onDidCreate(uri => { /* file created */ });
watcher.onDidChange(uri => { /* file modified */ });
watcher.onDidDelete(uri => { /* file deleted */ });
context.subscriptions.push(watcher);
```

### Storage

```typescript
// Per-workspace storage
context.workspaceState.update('lastScan', Date.now());
const lastScan = context.workspaceState.get<number>('lastScan');

// Global storage (across workspaces)
context.globalState.update('totalScans', count);
const total = context.globalState.get<number>('totalScans', 0);

// Secure secrets
await context.secrets.store('apiKey', 'secret-value');
const key = await context.secrets.get('apiKey');
```

### Common Codicon Icons

Use in status bar, tree items, and quick picks with `$(iconName)` syntax:

`shield`, `warning`, `error`, `info`, `check`, `x`, `sync~spin`, `file`, `folder`, `search`, `gear`, `trash`, `refresh`, `play`, `debug-stop`, `eye`, `eye-closed`, `filter`, `list-tree`, `output`, `terminal`

Full list: https://code.visualstudio.com/api/references/icons-in-labels
