---
title: VS Code Extension Cheat Sheet
---

# VS Code Extension Cheat Sheet

Quick reference for VS Code extension development. One pattern + key UX rules per surface area.

For full details, code variants, and supplemental APIs: [VS Code Extension Development Reference](../../developer-docs/reference/vscode-extension-reference.md)

---

## Critical Constraints

- **No DOM access** — all UI via VS Code APIs (except webviews)
- **`package.json`** is the declarative manifest for all contribution points
- Push every disposable to `context.subscriptions`
- Modern VS Code auto-generates activation events from contribution points

---

## Extension Lifecycle

```typescript
import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext) {
  const disposable = vscode.commands.registerCommand('myExt.hello', () => {
    vscode.window.showInformationMessage('Hello!');
  });
  context.subscriptions.push(disposable);
}

export function deactivate() {}
```

Key `context` properties: `subscriptions`, `extensionUri`, `workspaceState`, `globalState`, `secrets`

---

## Commands

```json
{ "contributes": { "commands": [
  { "command": "myExt.run", "title": "Run Scan", "category": "My Extension" }
]}}
```

```typescript
vscode.commands.registerCommand('myExt.run', () => { /* ... */ });
vscode.commands.executeCommand('setContext', 'myExt.isActive', true); // custom when-clause
```

**UX:** Title case. Start with verb. Include noun. Never say "command". Use `category` to group.

---

## Activity Bar + View Container

```json
{ "contributes": {
  "viewsContainers": { "activitybar": [
    { "id": "myContainer", "title": "My Extension", "icon": "resources/icon.svg" }
  ]},
  "views": { "myContainer": [
    { "id": "myView", "name": "Items" }
  ]}
}}
```

**UX:** One container per extension. 3-5 views max. Don't duplicate existing icons.

---

## Tree View

```typescript
class MyProvider implements vscode.TreeDataProvider<MyItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<MyItem | undefined>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  getChildren(el?: MyItem): MyItem[] { /* root or children */ }
  getTreeItem(el: MyItem): vscode.TreeItem { /* collapsibleState: None|Collapsed|Expanded */ }
  refresh(): void { this._onDidChangeTreeData.fire(undefined); }
}

vscode.window.registerTreeDataProvider('myView', new MyProvider());
```

Menu locations: `view/title`, `view/item/context` (use `viewItem` for per-type menus)

Welcome content:
```json
{ "contributes": { "viewsWelcome": [
  { "view": "myView", "contents": "No items.\n[Get Started](command:myExt.init)" }
]}}
```

**UX:** Use icons to differentiate types. Max 3 inline actions per item. Prefer tree views over webviews for data.

---

## Webview

```typescript
const panel = vscode.window.createWebviewPanel('viewType', 'Title', vscode.ViewColumn.One, {
  enableScripts: true,
  localResourceRoots: [vscode.Uri.joinPath(context.extensionUri, 'media')]
});
panel.webview.html = getHtml(panel.webview);
```

**Message passing:**
```typescript
// Extension to Webview
panel.webview.postMessage({ command: 'update', data: value });
// Webview to Extension (in webview JS: acquireVsCodeApi() called ONCE)
panel.webview.onDidReceiveMessage(msg => { /* handle */ });
```

**CSP required:**
```html
<meta http-equiv="Content-Security-Policy"
  content="default-src 'none'; script-src ${webview.cspSource}; style-src ${webview.cspSource};">
```

**Theming:** CSS vars `--vscode-editor-foreground`, `--vscode-editor-background`, etc. Body classes: `vscode-light`, `vscode-dark`, `vscode-high-contrast`.

**State:** `vscode.getState()`/`setState()` (survives hide), `registerWebviewPanelSerializer` (survives restart), `retainContextWhenHidden` (expensive).

**UX:** Only when native APIs are insufficient. Theme everything. No promotional content. No wizards.

---

## Status Bar

```typescript
const item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
item.text = '$(shield) Secure';
item.command = 'myExt.showStatus';
item.tooltip = 'Click for status';
item.show();
context.subscriptions.push(item);

// Spin animation
item.text = '$(sync~spin) Scanning...';

// Error background (use sparingly)
item.backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground');
```

**UX:** Concise text. Icons sparingly. Left = global, Right = contextual. No custom colors.

---

## Notifications + Progress

```typescript
vscode.window.showInformationMessage('Done.');
vscode.window.showErrorMessage('Failed.', 'Retry', 'Log');

// Progress notification (cancellable)
vscode.window.withProgress(
  { location: vscode.ProgressLocation.Notification, title: 'Scanning', cancellable: true },
  async (progress, token) => {
    token.onCancellationRequested(() => { /* cleanup */ });
    progress.report({ increment: 50, message: 'Analyzing...' });
  }
);

// Progress on status bar (subtle)
vscode.window.withProgress(
  { location: vscode.ProgressLocation.Window, title: 'Indexing' },
  async () => {}
);

// Progress on view (spinner)
vscode.window.withProgress({ location: { viewId: 'myView' } }, async () => {});
```

**UX:** Only when truly necessary. Include "Do not show again". Don't leave progress running indefinitely.

---

## Quick Pick + Input

```typescript
const pick = await vscode.window.showQuickPick(
  [{ label: '$(file) Option', description: 'info', detail: 'more' }],
  { placeHolder: 'Choose...', canPickMany: false }
);

const input = await vscode.window.showInputBox({
  prompt: 'Enter name',
  placeHolder: 'my-project',
  validateInput: t => t.length === 0 ? 'Required' : null
});
```

**UX:** Always include placeholders. Use titles for multi-step. Don't replicate existing features.

---

## Settings

```json
{ "contributes": { "configuration": { "title": "My Extension", "properties": {
  "myExt.enable": { "type": "boolean", "default": true, "description": "Enable extension." },
  "myExt.level": {
    "type": "string", "default": "normal", "enum": ["quiet", "normal", "verbose"],
    "enumDescriptions": ["Minimal", "Standard", "Detailed"], "description": "Output level."
  }
}}}}
```

```typescript
const config = vscode.workspace.getConfiguration('myExt');
const level = config.get<string>('level', 'normal');

vscode.workspace.onDidChangeConfiguration(e => {
  if (e.affectsConfiguration('myExt.level')) { /* react */ }
});
```

**UX:** Default on every setting. Clear descriptions. Never create custom settings UI.

---

## Context Menus

```json
{ "contributes": { "menus": {
  "editor/context": [
    { "command": "myExt.analyze", "when": "editorHasSelection", "group": "1_modification" }
  ],
  "explorer/context": [
    { "command": "myExt.scanFile", "when": "resourceScheme == file", "group": "navigation" }
  ]
}}}
```

Groups: `navigation` (top), `1_modification`, `9_cutcopypaste`. Use submenus for 3+ actions.

**UX:** Only show when relevant (`when` clauses). Group similar actions.

---

## Panel (Bottom Area)

```json
{ "contributes": {
  "viewsContainers": { "panel": [
    { "id": "myPanel", "title": "My Panel", "icon": "resources/icon.svg" }
  ]},
  "views": { "myPanel": [
    { "id": "myPanelView", "name": "Output" }
  ]}
}}
```

Same TreeDataProvider/WebviewViewProvider APIs as sidebar views.

**UX:** Use for horizontal content. Don't rely on constant visibility (users minimize panels).

---

## Task Provider

```json
{ "contributes": { "taskDefinitions": [
  { "type": "myTool", "required": ["command"],
    "properties": { "command": { "type": "string" } }, "when": "shellExecutionSupported" }
]}}
```

```typescript
vscode.tasks.registerTaskProvider('myTool', {
  provideTasks: () => [new vscode.Task(
    { type: 'myTool', command: 'scan' }, vscode.TaskScope.Workspace,
    'Scan', 'myTool', new vscode.ShellExecution('mytool scan')
  )],
  resolveTask: (task) => task
});
```

Execution types: `ShellExecution`, `ProcessExecution`, `CustomExecution` (Pseudoterminal)

---

## Diagnostics + Code Actions

```typescript
const diagCollection = vscode.languages.createDiagnosticCollection('myExt');
ctx.subscriptions.push(diagCollection);

// Create diagnostics
const diag = new vscode.Diagnostic(
  new vscode.Range(line, startCol, line, endCol), 'Issue found', vscode.DiagnosticSeverity.Warning
);
diag.source = 'My Extension';
diag.code = 'RULE-001';
diagCollection.set(uri, [diag]);

// Clear
diagCollection.delete(uri);  // one file
diagCollection.clear();      // all
```

Severity: `Error` (red), `Warning` (yellow), `Information` (blue), `Hint` (dots)

**Code Actions** (quick fixes):
```typescript
class MyFixer implements vscode.CodeActionProvider {
  provideCodeActions(doc, range, ctx): vscode.CodeAction[] {
    return ctx.diagnostics.filter(d => d.source === 'My Extension').map(d => {
      const fix = new vscode.CodeAction(`Fix: ${d.message}`, vscode.CodeActionKind.QuickFix);
      fix.diagnostics = [d];
      fix.edit = new vscode.WorkspaceEdit();
      fix.edit.replace(doc.uri, d.range, 'fixed');
      return fix;
    });
  }
}
vscode.languages.registerCodeActionsProvider({ scheme: 'file' }, new MyFixer());
```

---

## Quick API Reference

**Output Channel:**
```typescript
const out = vscode.window.createOutputChannel('My Ext');
out.appendLine('log'); out.show();
const log = vscode.window.createOutputChannel('My Ext', { log: true });
log.info('msg'); log.warn('msg'); log.error('msg');
```

**File Decorations:** `vscode.window.registerFileDecorationProvider()` — badges, colors, tooltips on Explorer files

**File Watcher:** `vscode.workspace.createFileSystemWatcher('**/*.json')` — `onDidCreate`, `onDidChange`, `onDidDelete`

**Storage:** `context.workspaceState` / `context.globalState` (`.get()`, `.update()`) + `context.secrets` (`.store()`, `.get()`)

**Codicons:** `$(shield)` `$(warning)` `$(error)` `$(info)` `$(check)` `$(sync~spin)` `$(play)` `$(debug-stop)` `$(refresh)` `$(trash)` `$(filter)` `$(list-tree)` `$(output)` `$(gear)` — [full list](https://code.visualstudio.com/api/references/icons-in-labels)
