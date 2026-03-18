# ASH Workbench — VS Code Extension Host

The extension host for ASH Workbench. Manages the ASH CLI lifecycle, persists scan results in an embedded PGLite database, and serves data to the React webview via a typed postMessage protocol.

## Contents

| File / Directory | Purpose |
|---|---|
| `src/extension.ts` | Entry point — `activate()` wires all services, providers, and commands |
| `src/services/database.ts` | `DatabaseService` — PGLite + Prisma initialization, raw SQL migration runner |
| `src/services/scanner.ts` | `ScannerService` — spawns ASH CLI, parses SARIF, stores findings |
| `src/services/findings.ts` | `FindingsService` — queries findings, scans, scan targets, dispositions |
| `src/services/sarif.ts` | SARIF parser — severity extraction, path normalization, deduplication |
| `src/services/project.ts` | `ensureProject()` — upserts a Project record for the workspace |
| `src/services/admin.ts` | `AdminService` — application info, reset (deletes PGLite data dir) |
| `src/providers/sidebarWebviewProvider.ts` | Sidebar webview — handles messages from the sidebar context |
| `src/providers/findingsPanelManager.ts` | Editor panel — manages the findings/dashboard webview panel |
| `src/providers/sinkPanelManager.ts` | Kitchen Sink panel — dev-only component showcase |
| `src/providers/scanTreeProvider.ts` | Tree view — scan history in the sidebar activity bar |
| `src/providers/webviewHtml.ts` | Generates the webview HTML with CSP, nonce, and asset URIs |
| `src/commands/scanCommands.ts` | `startScan`, `cancelScan`, `scanFolder` commands |
| `src/commands/index.ts` | `registerAllCommands()` — aggregates all command registrations |
| `src/models/types.ts` | Shared view-model types (must match `webview/src/types/types.ts`) |
| `src/models/messages.ts` | Message protocol types (must match `webview/src/types/messages.ts`) |
| `src/models/mappers.ts` | Prisma entity → view-model mappers |
| `src/types/sarif.ts` | SARIF v2.1.0 type definitions |
| `src/mock/data.ts` | Mock project, scans, and findings for development |
| `prisma/` | Prisma schema and raw SQL migrations |
| `webview-dist/` | Built webview assets (copied from `../webview/dist/` by `npm run build:webview`) |

## Commands

| Command ID | Title | Notes |
|---|---|---|
| `ashWorkbench.startScan` | ASH: Start Scan | Quick-pick target selector, opens findings panel |
| `ashWorkbench.cancelScan` | ASH: Cancel Scan | Kills the running ASH process |
| `ashWorkbench.scanFolder` | ASH: Scan Folder | Context menu on folders in Explorer |
| `ashWorkbench.selectScan` | (internal) | Tree item click → opens findings panel |
| `ashWorkbench.deleteScan` | ASH: Delete Scan | Confirmation dialog, cascades to findings |
| `ashWorkbench.resetApplication` | ASH: Reset Application | Deletes PGLite data dir, reloads window |
| `ashWorkbench.openWorkbench` | ASH: Open Workbench | Opens findings for the latest completed scan |
| `ashWorkbench.openKitchenSink` | ASH: Open Kitchen Sink | Dev mode only |

## Settings (`contributes.configuration`)

| Setting | Type | Default | Description |
|---|---|---|---|
| `ashWorkbench.ashPath` | string | `"ash"` | Path to the ASH CLI executable |
| `ashWorkbench.ashMode` | enum | `"local"` | `local` or `container` |
| `ashWorkbench.scanTimeout` | number | `600` | Scan timeout in seconds |
| `ashWorkbench.defaultSeverityThreshold` | enum | `"LOW"` | Minimum severity to report |
| `ashWorkbench.llm.provider` | enum | `"bedrock"` | LLM provider (not yet consumed) |
| `ashWorkbench.llm.region` | string | `"us-east-1"` | AWS region (not yet consumed) |
| `ashWorkbench.llm.modelId` | string | (anthropic model) | Model ID (not yet consumed) |

## Message Protocol

Discriminated union types in `src/models/messages.ts`. The webview and extension host communicate exclusively via `postMessage`.

**Extension → WebView (`ExtToWebviewMessage`):**

| Type | Payload | Purpose |
|---|---|---|
| `init` | `{ context: 'sidebar' \| 'editorPanel' \| 'sink' }` | Set rendering context |
| `stateUpdate` | `{ scans, summary, scanTargets }` | Dashboard/sidebar data |
| `findingsUpdate` | `{ scanId, findings }` | Finding list for a scan or scan target |
| `findingDetail` | `FindingRow` | Single finding detail |
| `dispositionUpdated` | `{ findingId, disposition }` | Confirms disposition change |
| `notesUpdated` | `{ findingId, notes }` | Confirms notes change |
| `scanStarted` | `{ scanId, targetPath }` | Scan kicked off |
| `scanProgress` | `{ scanId, elapsed, status }` | 1-second progress ticks |
| `applicationInfo` | `ApplicationInfo` | Version + DB stats |
| `applicationReset` | (none) | Reset completed |

**WebView → Extension (`WebviewToExtMessage`):**

| Type | Payload | Purpose |
|---|---|---|
| `requestState` | (none) | Sent on mount — triggers init + data |
| `selectScan` | `{ scanId }` | Load findings for a scan |
| `selectScanTarget` | `{ scanTargetId }` | Load findings for a scan target |
| `selectFinding` | `{ findingId }` | Request finding detail |
| `setDisposition` | `{ findingId, disposition }` | Triage a finding |
| `setNotes` | `{ findingId, notes }` | Update finding notes |
| `navigateToCode` | `{ filePath, startLine }` | Open file in editor |
| `startScan` | `{ targetPath }` | Start a scan from the webview |
| `cancelScan` | `{ scanId }` | Cancel running scan |
| `openFindings` | `{ scanId }` | Sidebar → open findings panel |
| `openDashboard` | (none) | Sidebar → open dashboard panel |
| `openSettings` | (none) | Open VS Code settings for `ashWorkbench` |
| `openSink` | (none) | Open Kitchen Sink |
| `applyFilters` | `{ scanId, filters }` | Filter findings |
| `deleteScan` | `{ scanId }` | Delete a scan |
| `requestApplicationInfo` | (none) | Request version + stats |
| `resetApplication` | (none) | Trigger application reset |

## Database

PGLite (WASM PostgreSQL) stored at `globalStorageUri/ash-workbench-pgdata/`. Prisma ORM for queries, but migrations are raw SQL applied by `DatabaseService.runMigrations()` (not `prisma migrate`). The `_ash_migrations` table tracks applied migrations.

**Entities:** Project → ScanTarget → Scan → Finding. Findings cascade-delete with their Scan. ScanTarget is unique per `(projectId, path)`.

## Build

```bash
npm run compile        # tsc → out/
npm run watch          # tsc --watch
npm run build:webview  # Build webview + copy to webview-dist/
npm run lint           # ESLint
npm run test           # Mocha via @vscode/test-cli
```

After any webview change, run `npm run build:webview` then reload the Extension Development Host (Cmd+R).

## Related

- See [CLAUDE.md](./CLAUDE.md) for conventions and gotchas.
