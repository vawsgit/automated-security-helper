---
title: Extension Host
sidebar_position: 3
---

# Extension Host

The extension host is the Node.js-side code in `vsix/src/`. It registers VS Code contribution points, manages providers, handles commands, and brokers communication between native UI and WebView contexts.

## Module Structure

```
vsix/src/
  extension.ts              # Entry point: activate() / deactivate()
  commands/
    index.ts                # Registers all commands
    scanCommands.ts         # startScan, cancelScan stubs
  providers/
    sidebarWebviewProvider.ts   # WebviewViewProvider (sidebar)
    findingsPanelManager.ts     # WebviewPanel manager (editor area)
    scanTreeProvider.ts         # TreeDataProvider (scan history)
    webviewHtml.ts              # Shared HTML/CSP generator
  models/
    types.ts                # Data model types
    messages.ts             # Message protocol types
  mock/
    data.ts                 # Static mock data and accessor functions
```

## Entry Point

`extension.ts` exports `activate()` which wires all components:

1. Registers commands via `commands/index.ts`
2. Creates `ScanTreeProvider` and registers it for the `ashWorkbench.scanHistory` view
3. Creates `FindingsPanelManager` (editor-area WebView panels)
4. Creates `SidebarWebviewProvider`, injects the panel manager, and registers it for `ashWorkbench.mainView`
5. Registers the `ashWorkbench.selectScan` and `ashWorkbench.openWorkbench` commands inline

## Contribution Points

Declared in `vsix/package.json` under `contributes`:

### View container and views

```json
"viewsContainers": {
  "activitybar": [{
    "id": "ashWorkbench",
    "title": "ASH Workbench",
    "icon": "resources/icon.svg"
  }]
},
"views": {
  "ashWorkbench": [
    { "type": "webview", "id": "ashWorkbench.mainView", "name": "Workbench" },
    { "id": "ashWorkbench.scanHistory", "name": "Scan History" }
  ]
}
```

The `ashWorkbench` container appears as a shield icon in the activity bar. It holds two views:
- **Workbench** (`type: "webview"`) -- rendered by `SidebarWebviewProvider`
- **Scan History** -- rendered by `ScanTreeProvider`

### Activation

The extension activates on `onView:ashWorkbench.mainView` -- when the user first clicks the activity bar icon.

### Commands

| Command ID | Title | Behavior |
|---|---|---|
| `ashWorkbench.startScan` | ASH: Start Scan | Shows info message (mock) |
| `ashWorkbench.cancelScan` | ASH: Cancel Scan | Shows info message (mock) |
| `ashWorkbench.openWorkbench` | ASH: Open Workbench | Opens findings panel for default scan |
| `ashWorkbench.selectScan` | *(internal)* | Selects scan in tree + opens findings panel |

## Providers

### ScanTreeProvider

`TreeDataProvider` that renders mock scan history in the sidebar.

- `getChildren()` returns `ScanTreeItem` instances from mock data
- Each tree item shows: date label, finding count description, status icon (`ThemeIcon`)
- Status icons: `check` (completed), `error` (failed), `circle-slash` (cancelled), `sync~spin` (running)
- Clicking a tree item fires `ashWorkbench.selectScan` with the scan ID

### SidebarWebviewProvider

`WebviewViewProvider` for the compact sidebar dashboard.

- Registered for view ID `ashWorkbench.mainView`
- In `resolveWebviewView()`: sets webview options, generates HTML, registers message handler
- Responds to `requestState` with `init` (context: sidebar) + `stateUpdate` (scans and summary)
- Responds to `startScan` with an info message
- Responds to `openFindings` by delegating to `FindingsPanelManager`

### FindingsPanelManager

Manages a single `WebviewPanel` in the editor area for the findings table and detail views.

- `showFindings(scanId)` creates or reveals the panel
- Reuse pattern: stores `this.panel` reference; if panel exists, calls `reveal()` + re-sends `init`; on dispose, clears the reference
- Responds to `requestState` with `init` (context: editorPanel) + `findingsUpdate`
- Responds to `selectFinding` with `findingDetail`
- Responds to `setDisposition` by updating in-memory mock data and sending `dispositionUpdated`
- Responds to `navigateToCode` by calling `vscode.window.showTextDocument` (or showing info message if file doesn't exist)

### webviewHtml.ts

Shared function `getWebviewHtml(webview, extensionUri)` used by both providers. Generates a complete HTML document with:

- Nonce-based Content Security Policy
- References to `webview-dist/assets/index.js` and `index.css` resolved via `webview.asWebviewUri()`
- A `<div id="root">` mount point for the React app

## Data Model

Defined in `vsix/src/models/types.ts`:

| Type | Values |
|---|---|
| `ScanStatus` | `RUNNING`, `COMPLETED`, `FAILED`, `CANCELLED` |
| `Severity` | `CRITICAL`, `HIGH`, `MEDIUM`, `LOW`, `INFO` |
| `Disposition` | `PENDING`, `FIX`, `SUPPRESS`, `DEFER` |

Key interfaces: `Project`, `ScanSummary`, `FindingRow`, `DispositionSummary`. These types are shared with the WebView (copied to `webview/src/types/`).

## Mock Data

`vsix/src/mock/data.ts` provides static data and accessor functions:

- 1 project, 4 scans (2 completed, 1 failed, 1 running)
- 18 findings across all severities, scanners (bandit, semgrep, checkov, npm-audit, grype, detect-secrets), and dispositions
- `getMockScans()`, `getMockFindings(scanId)`, `getMockFindingDetail(findingId)`, `getMockSummary()`
- `updateDisposition(findingId, disposition)` -- mutates in-memory state (resets on extension reload)

## Extending / Maintaining

### Adding a new command

1. Add the command object to `vsix/package.json` `contributes.commands`
2. Implement the handler in `vsix/src/commands/scanCommands.ts`
3. Register it in `vsix/src/commands/index.ts`

### Adding a new view

1. Add the view to `vsix/package.json` `contributes.views.ashWorkbench`
2. Create a provider in `vsix/src/providers/`
3. Register the provider in `vsix/src/extension.ts`

### Replacing mock data with real data

The mock data module has the same interface that a real data service would expose. Replace the imports in providers from `../mock/data` to a real service module. The message protocol and WebView code remain unchanged.
