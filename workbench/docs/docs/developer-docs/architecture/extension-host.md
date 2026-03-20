---
title: Extension Host
sidebar_position: 3
---

# Extension Host

The extension host is the Node.js-side code in `vsix/src/`. It manages the database, runs scans, handles triage operations, orchestrates AI analysis, watches `.ash.yaml` for suppression changes, and brokers communication between native UI and WebView contexts.

## Module Structure

```
vsix/src/
  extension.ts                    # Entry point: activate() / deactivate()
  commands/
    index.ts                      # Registers all commands
    scanCommands.ts               # Scan execution commands
  services/
    database.ts                   # PGLite + Prisma initialization, migrations
    scanner.ts                    # ASH CLI spawn, output streaming, SARIF parsing
    findings.ts                   # Finding queries, triage, AI analysis persistence
    project.ts                    # Project record management
    sarif.ts                      # SARIF parsing and finding extraction
    scanRoot.ts                   # Scan root path resolution
    ashYaml.ts                    # .ash.yaml discovery, watching, suppression matching
    ashYamlCore.ts                # Pure functions for YAML parsing and matching
    ashYamlWrite.ts               # .ash.yaml mutation (add/edit/remove suppressions)
    ashYamlWriteCore.ts           # Pure functions for YAML serialization
    aiService.ts                  # AI analysis orchestration (single + batch)
    aiProvider.ts                 # AiProvider interface and event types
    claudeAgentProvider.ts        # Claude Agent SDK implementation
    claudeSettingsDetector.ts     # ~/.claude/settings.json detection
    mcpTools.ts                   # MCP server for finding-analysis tools
    admin.ts                      # Application info and reset
  providers/
    findingsPanelManager.ts       # Findings editor panel (WebviewPanel)
    sidebarWebviewProvider.ts     # Sidebar webview (WebviewViewProvider)
    scanTreeProvider.ts           # Scan history tree (TreeDataProvider)
    sinkPanelManager.ts           # Kitchen Sink panel (dev only)
    webviewHtml.ts                # Shared HTML/CSP generator
  models/
    types.ts                      # Shared TypeScript types
    messages.ts                   # Extension ↔ WebView message protocol
    mappers.ts                    # Prisma → UI type conversions
  types/
    sarif.ts                      # SARIF JSON schema types
```

## Activation Flow

`extension.ts` exports `activate()` which wires all components in sequence:

1. **Database initialization** — `DatabaseService.initialize(storagePath)` starts PGLite, runs migrations, returns Prisma client
2. **Project record** — `ensureProject()` upserts a project record for the current workspace
3. **Output channel** — Creates the ASH output channel for scan log streaming
4. **Scanner service** — `new ScannerService(db, projectId)` + recovery of stale scans (marks any RUNNING scans as FAILED)
5. **Service creation** — `ScanRootService`, `AshYamlService`, `AshYamlWriteService`, `FindingsService`, `AiService`
6. **Provider registration** — `ScanTreeProvider`, `FindingsPanelManager`, `SidebarWebviewProvider`, `SinkPanelManager` (dev only)
7. **Command registration** — Scan, delete, reset, suppress commands
8. **Config listeners** — Watches `ashWorkbench.scanRoot` and `.ash.yaml` changes
9. **Claude settings detection** — Reads `~/.claude/settings.json` to determine AI provider

## Contribution Points

Declared in `vsix/package.json` under `contributes`:

### View Container and Views

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
- **Workbench** (`type: "webview"`) — rendered by `SidebarWebviewProvider`
- **Scan History** — rendered by `ScanTreeProvider`

### Activation

The extension activates on `onView:ashWorkbench.mainView` — when the user first clicks the activity bar icon.

### Commands

| Command ID | Title | Behavior |
|---|---|---|
| `ashWorkbench.startScan` | ASH: Start Scan | Prompts for scan target, spawns ASH CLI |
| `ashWorkbench.cancelScan` | ASH: Cancel Scan | Kills running scan process |
| `ashWorkbench.openWorkbench` | ASH: Open Workbench | Opens findings panel |
| `ashWorkbench.resetApplication` | ASH: Reset Application | Deletes all data, reloads window |
| `ashWorkbench.openKitchenSink` | ASH: Open Kitchen Sink | Opens component showcase (dev mode only) |

## Providers

### ScanTreeProvider

`TreeDataProvider` that renders scan history in the sidebar.

- `getChildren()` returns `ScanTreeItem` instances from the database
- Each tree item shows: date label, finding count, status icon (`ThemeIcon`)
- Status icons: `check` (completed), `error` (failed), `circle-slash` (cancelled), `sync~spin` (running)
- Clicking a tree item fires `ashWorkbench.selectScan` with the scan ID
- `refresh()` fires tree change event (called after scans complete or are deleted)

### SidebarWebviewProvider

`WebviewViewProvider` for the compact sidebar dashboard.

- Registered for view ID `ashWorkbench.mainView`
- In `resolveWebviewView()`: sets webview options, generates HTML, registers message handler
- `queryStateAndPost()` queries scans, summary, targets, current findings and sends to webview
- Handles: `requestState`, `startScan`, `cancelScan`, `requestCurrentFindings`, `testAiConnection`, `openDashboard`, `openSettings`, `selectScanTarget`
- Receives push notifications: scan progress, `.ash.yaml` changes, AI test results

### FindingsPanelManager

Manages a single `WebviewPanel` in the editor area for the full finding workflow.

- `showFindings(scanId)` creates or reveals the panel
- `showDashboard()` opens the panel in dashboard view
- `showSuppressionManager()` opens the suppression management view
- Reuse pattern: stores `this.panel` reference; if panel exists, calls `reveal()` + re-sends `init`
- `currentScanId` instance variable tracks active scan (read by message handler on each call)
- Handles all message types: finding queries, triage, suppressions, AI analysis, scan management

### webviewHtml.ts

Shared function `getWebviewHtml(webview, extensionUri)` used by all providers. Generates a complete HTML document with:

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
| `RiskLevel` | `CRITICAL`, `HIGH`, `MEDIUM`, `LOW`, `NONE` |

Key interfaces:
- `FindingRow` — Full finding with AI analysis, suppression status, triage metadata
- `ScanSummary` — Lightweight scan view (id, status, findingCount, severityBreakdown)
- `ScanTarget` — Scan target with aggregated metrics
- `AiAnalysis` — Structured AI output (explanation, risk assessment, suggested fix, references)
- `AnalysisMetadata` — Cost, model, tools used, timestamp

`vsix/src/models/mappers.ts` converts between Prisma database types and UI types:
- `mapScanToSummary()`, `mapScanTargetToView()`, `mapFindingToRow()`, `generateYamlEntry()`

## Extending / Maintaining

### Adding a new command

1. Add the command object to `vsix/package.json` `contributes.commands`
2. Implement the handler in `vsix/src/commands/scanCommands.ts`
3. Register it in `vsix/src/commands/index.ts`

### Adding a new view

1. Add the view to `vsix/package.json` `contributes.views.ashWorkbench`
2. Create a provider in `vsix/src/providers/`
3. Register the provider in `vsix/src/extension.ts`

### Adding a new service

1. Create `vsix/src/services/<name>.ts`
2. Accept dependencies via constructor (Prisma client, other services)
3. Instantiate in `extension.ts` after database initialization
4. Pass to providers that need it

### Adding a new message type

See [Message Protocol](./message-protocol.md#extending--maintaining) for the 5-step process.

## Gotchas

1. **Type synchronization** — `vsix/src/models/messages.ts` and `webview/src/types/messages.ts` are manual copies. They must stay in sync. There is no build-time validation.
2. **Fixed Vite output filenames** — `webview/vite.config.ts` produces `assets/index.js` and `assets/index.css` without hashes. The extension host hardcodes these paths in `webviewHtml.ts`. Changing Vite output config without updating the HTML generator breaks the webview.
3. **PGLite ESM import** — PGLite is ESM-only. The extension uses dynamic `import()` at runtime because the extension host runs as CommonJS.
4. **Panel manager instance state** — `FindingsPanelManager` stores `currentScanId` as an instance variable. The single `handleMessage` listener reads this on every call. Adding a second scan context without updating this pattern will cause state bugs.
5. **Kitchen Sink dev-mode gate** — The `openKitchenSink` command is only registered when `extensionMode === Development`. It will not appear in production builds.
6. **Webview copy step** — After building the webview (`webview/dist/`), output must be copied to `vsix/webview-dist/` before the extension can use it. Forgetting this step means the extension loads stale webview code.

## References

- [Services](./services.md) — Service inventory, patterns, and key methods
- [Database](./database.md) — PGLite, Prisma, schema, migrations
- [Message Protocol](./message-protocol.md) — Complete protocol reference
- [AI Integration](./ai-integration.md) — Claude Agent SDK, MCP tools, analysis flow
- [Suppression System](./suppression-system.md) — `.ash.yaml` parsing, matching, writing
- [Build Pipeline](./build-pipeline.md) — npm scripts, Vite, copy bridge
