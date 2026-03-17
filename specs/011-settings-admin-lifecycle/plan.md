# Implementation Plan: Settings, Admin & Application Lifecycle

**Feature Branch**: `011-settings-admin-lifecycle`
**Spec**: [spec.md](./spec.md)
**Research**: [research.md](./research.md)
**Data Model**: [data-model.md](./data-model.md)

## Technical Context

| Aspect | Value |
|--------|-------|
| Language | TypeScript (strict mode, ES2022) |
| Runtime | VS Code Extension Host (Node.js) + React 19 WebView |
| Database | PGLite (WASM PostgreSQL) + Prisma ORM |
| Testing | Mocha + sinon (unit), @vscode/test-electron (integration) |
| Build | tsc (vsix), Vite 8 (webview) |

## Constitution Check

| Principle | Status | Notes |
|-----------|--------|-------|
| I. VS Code Native | PASS | Settings via `contributes.configuration` in package.json. Reset via command palette. All contribution points declared. |
| II. Extension Host Owns State | PASS | AdminService lives in extension host. WebView sends `requestApplicationInfo` / `resetApplication` messages, receives state pushes back. |
| III. Ship Fast / Simplicity First | PASS | Static AdminService methods, window reload for reset (simplest correct approach). No abstractions for hypothetical needs. |
| IV. Typed Contracts at Boundaries | PASS | New message types added to discriminated unions. `ApplicationInfo` type defined in both packages. |
| V. Theme Integration | N/A | No new UI components in this spec. |
| VI. Security by Default | PASS | No command injection risk (settings read via VS Code API, not user-supplied strings in spawn args). Reset requires explicit modal confirmation. |

## Design Decisions

### DD-001: Extend Existing Settings (Not Replace)

Three settings already exist (`ashPath`, `ashMode`, `scanTimeout`) and are actively used by ScannerService. We ADD four new settings to the existing `contributes.configuration` block. No changes to existing settings.

### DD-002: Window Reload After Reset

After deleting the database directory, call `vscode.commands.executeCommand('workbench.action.reloadWindow')`. This re-runs `activate()` from scratch, ensuring fresh DB initialization, project creation, and empty UI. This avoids the complexity of manually reinitializing all services that hold stale `db` references.

### DD-003: AdminService as Static Methods

`AdminService` holds no state. It orchestrates between `DatabaseService` (static) and filesystem operations. Static methods match the `DatabaseService` pattern and avoid unnecessary wiring.

### DD-004: Schema Version via DatabaseService

Add `static async getSchemaVersion(): Promise<string>` to `DatabaseService`. This queries the `_ash_migrations` raw table (owned by DatabaseService) and returns the latest migration name. The PGLite instance is already held as a static field.

### DD-005: Migration Error Handling in activate()

Wrap `DatabaseService.initialize()` in a try/catch in `extension.ts`. On failure, show `vscode.window.showErrorMessage` with "Retry" and "Reset" buttons. "Retry" re-calls initialize. "Reset" calls AdminService.resetApplication then reloads.

### DD-006: Reset Guard Against Running Scans

Before reset, check `scanner.getCurrentScanId()`. If non-null, show a warning and abort. This is checked both in the command handler and in the WebView message handler.

## Files to Modify

### Existing Files

| File | Changes | Story |
|------|---------|-------|
| `vsix/package.json` | Add 4 new settings to `contributes.configuration.properties`, add `ashWorkbench.resetApplication` command | US1, US2 |
| `vsix/src/services/database.ts` | Add static `getSchemaVersion()` method | US3, US4 |
| `vsix/src/models/messages.ts` | Add `applicationInfo`, `requestApplicationInfo`, `resetApplication` message types | US2, US3 |
| `vsix/src/models/types.ts` | Add `ApplicationInfo` interface | US3 |
| `webview/src/types/messages.ts` | Mirror new message types | US2, US3 |
| `webview/src/types/types.ts` | Mirror `ApplicationInfo` interface | US3 |
| `vsix/src/extension.ts` | Migration error handling with retry/reset, register resetApplication command, AdminService wiring | US2, US4 |
| `vsix/src/providers/sidebarWebviewProvider.ts` | Handle `requestApplicationInfo` and `resetApplication` messages | US2, US3 |
| `vsix/src/providers/findingsPanelManager.ts` | Handle `requestApplicationInfo` and `resetApplication` messages | US2, US3 |

### New Files

| File | Purpose | Story |
|------|---------|-------|
| `vsix/src/services/admin.ts` | `AdminService` with static `getApplicationInfo()` and `resetApplication()` methods | US2, US3 |

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│ VS Code Settings UI (contributes.configuration)         │
│  ashPath, ashMode, scanTimeout, defaultSeverityThreshold│
│  llm.provider, llm.region, llm.modelId                  │
└───────────────────────────┬─────────────────────────────┘
                            │ vscode.workspace.getConfiguration()
                            ▼
┌─────────────────────────────────────────────────────────┐
│ ScannerService.getConfig()  (reads at scan start)       │
│ Future services read their settings similarly            │
└─────────────────────────────────────────────────────────┘

┌──────────────┐   requestApplicationInfo   ┌───────────────┐
│   WebView    │ ─────────────────────────▶ │  Extension    │
│  (sidebar)   │                            │    Host       │
│              │ ◀───────────────────────── │               │
│              │   applicationInfo          │  AdminService │
│              │                            │  .getAppInfo()│
│              │   resetApplication         │               │
│              │ ─────────────────────────▶ │  AdminService │
│              │                            │  .reset()     │
└──────────────┘                            │  → reload     │
                                            └───────────────┘

┌─────────────────────────────────────────────────────────┐
│ activate()                                              │
│  try {                                                  │
│    db = await DatabaseService.initialize(storagePath)   │
│  } catch {                                              │
│    showErrorMessage("Migration failed", "Retry","Reset")│
│    if Retry → reinitialize                              │
│    if Reset → AdminService.reset() → reload             │
│  }                                                      │
└─────────────────────────────────────────────────────────┘
```

## Test Strategy

| Test | Type | What it verifies |
|------|------|-----------------|
| AdminService.getApplicationInfo returns correct stats | Unit | Counts match actual DB data |
| AdminService.getApplicationInfo returns schema version | Unit | Version matches latest migration name |
| AdminService.resetApplication deletes data directory | Unit | Directory removed after reset |
| AdminService.resetApplication closes DB first | Unit | DatabaseService.close() called before deletion |
| DatabaseService.getSchemaVersion returns latest migration | Unit | Correct migration name returned |
| DatabaseService.getSchemaVersion returns "none" for empty DB | Unit | Handles no-migrations case |
