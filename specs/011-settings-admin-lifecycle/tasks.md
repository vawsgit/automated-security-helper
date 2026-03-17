# Tasks: Settings, Admin & Application Lifecycle

**Input**: Design documents from `/specs/011-settings-admin-lifecycle/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, quickstart.md

**Tests**: Included -- the plan specifies 6 test cases for AdminService and DatabaseService.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2)
- Include exact file paths in descriptions

## Phase 1: Foundational

**Purpose**: Shared types, message protocol sync, and `ApplicationInfo` type that US2, US3, and US4 depend on.

- [x] T001 [P] Add `ApplicationInfo` interface (`extensionVersion: string`, `schemaVersion: string`, `stats: { projectCount: number, scanCount: number, findingCount: number }`) to `vsix/src/models/types.ts`
- [x] T002 [P] Mirror `ApplicationInfo` interface in `webview/src/types/types.ts`
- [x] T003 [P] Add message types to `vsix/src/models/messages.ts`: `ExtToWebviewMessage` gets `| { type: 'applicationInfo'; payload: ApplicationInfo }` and `| { type: 'applicationReset' }`. `WebviewToExtMessage` gets `| { type: 'requestApplicationInfo' }` and `| { type: 'resetApplication' }`
- [x] T004 [P] Mirror message type additions in `webview/src/types/messages.ts`

**Checkpoint**: Shared types and message protocol synced across packages. All user stories can proceed.

---

## Phase 2: User Story 1 -- Extension Settings Configuration (Priority: P1)

**Goal**: All configuration properties visible and editable in VS Code Settings UI under "ASH Workbench".

**Independent Test**: Open Settings, filter by "ASH Workbench", verify all 7 settings appear with correct defaults, types, and descriptions.

### Implementation for User Story 1

- [x] T005 [US1] Add 4 new configuration properties to `contributes.configuration.properties` in `vsix/package.json`: `ashWorkbench.defaultSeverityThreshold` (enum: CRITICAL/HIGH/MEDIUM/LOW/INFO, default "LOW", description "Default severity threshold for filtering scan results"), `ashWorkbench.llm.provider` (enum: bedrock, default "bedrock", description "LLM provider for AI-assisted analysis"), `ashWorkbench.llm.region` (string, default "us-east-1", description "AWS region for LLM provider"), `ashWorkbench.llm.modelId` (string, default "anthropic.claude-sonnet-4-20250514", description "LLM model identifier")

**Checkpoint**: All 7 settings visible in VS Code Settings UI. Existing scanner behavior unchanged (ashPath, ashMode, scanTimeout already wired).

---

## Phase 3: User Story 4 -- Automatic Schema Migration on Activation (Priority: P2)

**Goal**: Schema version reporting and migration error handling with retry/reset recovery options.

**Independent Test**: Unit tests verify `getSchemaVersion()` returns correct migration name. Activation error handling verified by simulating migration failure.

### Implementation for User Story 4

- [x] T006 [US4] Add `static async getSchemaVersion(): Promise<string>` method to `DatabaseService` in `vsix/src/services/database.ts` that queries `SELECT name FROM _ash_migrations ORDER BY id DESC LIMIT 1` via the static `pgliteInstance`, returns the migration name or `'none'` if no migrations applied
- [x] T007 [US4] Add unit tests for `getSchemaVersion()` in `vsix/src/test/unit/database.test.ts`: (1) returns latest migration name after initialization, (2) returns correct value (not "none") since migrations are always applied during initialize
- [x] T008 [US4] Wrap `DatabaseService.initialize()` call in `vsix/src/extension.ts` with try/catch that shows `vscode.window.showErrorMessage` with "Retry" and "Reset Application" buttons. "Retry" re-calls `DatabaseService.initialize()`. "Reset" calls `AdminService.resetApplication()` then `vscode.commands.executeCommand('workbench.action.reloadWindow')`

**Checkpoint**: Schema version queryable. Migration failures show actionable error with retry/reset.

---

## Phase 4: User Story 2 -- Application Reset (Priority: P2)

**Goal**: Users can reset the application to a clean state via command palette or WebView.

**Independent Test**: Run a scan, invoke reset, confirm dialog, verify window reloads and data is gone.

### Implementation for User Story 2

- [x] T009 [US2] Create `vsix/src/services/admin.ts` with static `AdminService` class: `static async getApplicationInfo(db: PrismaClient, extensionVersion: string): Promise<ApplicationInfo>` that queries `db.project.count()`, `db.scan.count()`, `db.finding.count()`, and `DatabaseService.getSchemaVersion()`. `static async resetApplication(storagePath: string): Promise<void>` that calls `DatabaseService.close()`, then deletes the `ash-workbench-pgdata` directory under `storagePath` via `fs.promises.rm()`
- [x] T010 [US2] Add `ashWorkbench.resetApplication` command entry (`"title": "ASH: Reset Application"`) to `vsix/package.json` commands array
- [x] T011 [US2] Register `ashWorkbench.resetApplication` command in `vsix/src/extension.ts`: check `scanner.getCurrentScanId()` — if non-null, show warning "Cannot reset while a scan is running. Cancel the scan first." and return. Otherwise show `vscode.window.showWarningMessage` modal with "This will permanently delete all scans, findings, and triage data. This cannot be undone." and "Reset" button. On confirm, call `AdminService.resetApplication(context.globalStorageUri.fsPath)` then `vscode.commands.executeCommand('workbench.action.reloadWindow')`
- [x] T012 [US2] Add `case 'resetApplication'` handler in `handleMessage()` in `vsix/src/providers/sidebarWebviewProvider.ts`: check scanner running, show modal confirmation, call `AdminService.resetApplication()`, reload window (same logic as command)
- [x] T013 [US2] Add `case 'resetApplication'` handler in `handleMessage()` in `vsix/src/providers/findingsPanelManager.ts`: same logic as sidebar handler
- [x] T014 [US2] Add unit tests for `AdminService` in `vsix/src/test/unit/admin.test.ts`: (1) `resetApplication` deletes the data directory, (2) `resetApplication` calls `DatabaseService.close()` before deletion, (3) `getApplicationInfo` returns correct counts, (4) `getApplicationInfo` returns schema version from `DatabaseService.getSchemaVersion()`

**Checkpoint**: Reset works from command palette and WebView. Modal confirmation prevents accidental data loss. Running scan blocks reset.

---

## Phase 5: User Story 3 -- Application Info Display (Priority: P3)

**Goal**: Users can request application info and see extension version, schema version, and data counts.

**Independent Test**: Request app info from WebView, verify response contains correct version and matching counts.

### Implementation for User Story 3

- [x] T015 [US3] Add `case 'requestApplicationInfo'` handler in `handleMessage()` in `vsix/src/providers/sidebarWebviewProvider.ts`: call `AdminService.getApplicationInfo(db, extensionVersion)`, post `applicationInfo` message to WebView. Add `setAdminDeps(deps: { db: PrismaClient; extensionVersion: string; storagePath: string; scanner: ScannerService })` setter or extend existing setters to provide the `db`, `extensionVersion`, and `storagePath` needed by AdminService
- [x] T016 [US3] Add `case 'requestApplicationInfo'` handler in `handleMessage()` in `vsix/src/providers/findingsPanelManager.ts`: same logic as sidebar handler
- [x] T017 [US3] Wire admin dependencies in `vsix/src/extension.ts`: pass `db`, `context.extension.packageJSON.version` (or hardcoded from package.json), and `context.globalStorageUri.fsPath` to sidebar and findings panel providers via setters

**Checkpoint**: Application info returned on demand with accurate version, schema version, and counts.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Verify everything compiles, all tests pass, no regressions.

- [x] T018 Run `npm run compile` in `vsix/` and verify zero TypeScript errors
- [x] T019 Run `npm run test:unit` in `vsix/` and verify all tests pass (existing + new admin/database tests)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Foundational (Phase 1)**: No dependencies -- can start immediately. T001-T004 are all parallel (different files).
- **US1 (Phase 2)**: No dependency on Phase 1. T005 is a standalone package.json edit.
- **US4 (Phase 3)**: T006 is independent. T007 depends on T006. T008 depends on T006 and T009 (needs AdminService for reset button).
- **US2 (Phase 4)**: Depends on Phase 1 (needs `ApplicationInfo` type from T001) and T006 (needs `getSchemaVersion`). T009-T013 can partially parallelize. T014 depends on T009.
- **US3 (Phase 5)**: Depends on Phase 4 (needs AdminService from T009). T015 and T016 are parallel (different files). T017 depends on T015+T016.
- **Polish (Phase 6)**: Depends on all previous phases.

### User Story Dependencies

- **US1 (P1)**: Independent. Can start immediately.
- **US4 (P2)**: Depends on Phase 1 only.
- **US2 (P2)**: Depends on Phase 1 and US4 (T006).
- **US3 (P3)**: Depends on US2 (needs AdminService).

### Parallel Opportunities

Within Phase 1:
- T001, T002, T003, T004 can all run in parallel (different files in different packages)

Within Phase 4 (US2):
- T010, T012, T013 can run in parallel (different files: package.json, sidebarWebviewProvider, findingsPanelManager)

Within Phase 5 (US3):
- T015 and T016 can run in parallel (different provider files)

Across Phases:
- US1 (Phase 2) can run in parallel with Phase 1

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete T005 (add settings to package.json)
2. **STOP and VALIDATE**: Open VS Code Settings, verify all 7 settings visible with correct defaults.

### Incremental Delivery

1. T001-T005 → Types + message protocol + settings (Foundation + US1!)
2. T006-T008 → Schema version + migration error handling (US4!)
3. T009-T014 → AdminService + reset command + tests (US2!)
4. T015-T017 → App info handlers + wiring (US3!)
5. T018-T019 → Full compile + test verification

---

## Notes

- `vsix/package.json` already has 3 settings (`ashPath`, `ashMode`, `scanTimeout`) — we add 4 more, not replace
- `ScannerService.getConfig()` already reads settings via `vscode.workspace.getConfiguration` — no changes needed
- `DatabaseService` is static (class-level fields) — `getSchemaVersion()` accesses the existing `pgliteInstance`
- `AdminService` uses static methods to match `DatabaseService` pattern
- Reset uses `workbench.action.reloadWindow` to ensure all stale references are cleaned up
- T008 and T011 both modify `extension.ts` — execute T008 before T011 (US4 before US2)
- The `resetApplication` handlers in sidebar and findings panel share identical logic (check scanner, confirm, reset, reload)
