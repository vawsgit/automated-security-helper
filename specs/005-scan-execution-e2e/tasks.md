# Tasks: Scan Execution End-to-End

**Input**: Design documents from `/specs/005-scan-execution-e2e/`
**Prerequisites**: plan.md, spec.md, data-model.md, contracts/, research.md, quickstart.md

**Tests**: Not explicitly requested in the feature specification. No test tasks included.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Message Protocol & Mappers)

**Purpose**: Extend the message protocol and create the Prisma-to-view mapping layer. These are shared foundations that all user stories depend on.

- [x] T001 [P] Add `scanProgress` (Ext→WebView) and `cancelScan` (WebView→Ext) message types, and update `scanStarted` payload to include `scanId`, in `vsix/src/models/messages.ts` per contracts/message-protocol.md
- [x] T002 [P] Mirror the message type changes from T001 in `webview/src/types/messages.ts` — add `scanProgress`, `cancelScan`, update `scanStarted` payload to include `scanId`
- [x] T003 [P] Create `vsix/src/models/mappers.ts` with `mapScanToSummary(scan: Scan): ScanSummary` and `mapFindingToRow(finding: Finding): FindingRow` functions per data-model.md entity mappings. Import Prisma types and view types, handle field renames (`sourceDir`→`sourceDirectory`, `file`→`filePath`, `snippet`→`codeSnippet`, `findingsCount`→`findingCount`), default `disposition` to `'PENDING'`, `notes` to `''`, `aiAnalysis`/`suppression` to `null`

---

## Phase 2: Foundational (Provider Database Wiring)

**Purpose**: Replace mock data with real database queries in all three providers. MUST complete before user story phases that wire scan execution.

- [x] T004 Replace mock data in `vsix/src/providers/scanTreeProvider.ts`: remove `getMockScans` import, activate `db`/`project` constructor params (remove `_` prefix), change `getChildren()` to async returning `Promise<ScanTreeItem[]>`, query `db.scan.findMany({ where: { projectId: project.id }, orderBy: { startedAt: 'desc' } })` and map results with `mapScanToSummary()`
- [x] T005 Replace mock data in `vsix/src/providers/sidebarWebviewProvider.ts`: remove `getMockScans`/`getMockSummary` imports, activate `db`/`project` constructor params, replace `requestState` handler to query `db.scan.findMany()` + `mapScanToSummary()` for scans and compute `DispositionSummary` from `db.finding.count()` for summary (default all dispositions to PENDING count = total findings)
- [x] T006 Replace mock data in `vsix/src/providers/findingsPanelManager.ts`: remove `getMockFindings`/`getMockFindingDetail`/`updateDisposition` imports, activate `db`/`project` constructor params, replace `requestState` handler to query `db.finding.findMany({ where: { scanId } })` + `mapFindingToRow()`, replace `selectFinding` to use `db.finding.findUnique()` + `mapFindingToRow()`, replace `setDisposition` to use `db.finding.update()` (update disposition field directly if exists, else log warning), remove "(mock data — file does not exist)" from `navigateToCode` error message

**Checkpoint**: All three providers now use real database queries. Mock data module is no longer imported by any provider.

---

## Phase 3: User Story 1 — Run Scan from Command Palette (Priority: P1)

**Goal**: User runs "ASH: Start Scan" from command palette, selects a target, ASH CLI runs, findings panel opens immediately with progress, results appear on completion.

**Independent Test**: Trigger "ASH: Start Scan", select workspace root, verify findings panel opens with scanning state, then shows results after scan completes.

### Implementation for User Story 1

- [x] T007 [US1] Add `scanner: ScannerService` parameter to `FindingsPanelManager` constructor in `vsix/src/providers/findingsPanelManager.ts`. Add public methods: `showScanning(scanId: string, targetPath: string): void` (opens panel and sends `scanStarted` with `{ scanId, targetPath }`), `postProgress(scanId: string, elapsed: number, status: string): void` (sends `scanProgress` message), `postFindingsUpdate(scanId: string, findings: FindingRow[]): void` (sends `findingsUpdate` message)
- [x] T008 [US1] Rewrite `vsix/src/commands/scanCommands.ts`: change `registerScanCommands` signature to accept `scanner: ScannerService`, `db: PrismaClient`, `projectId: string`, `findingsPanelManager: FindingsPanelManager`, `sidebarWebviewProvider: SidebarWebviewProvider`, `scanTreeProvider: ScanTreeProvider`. Remove `setFindingsPanelManagerRef()` and module-level ref. Create private `executeScan()` async helper that: (a) calls `findingsPanelManager.showScanning()`, (b) calls `scanner.startScan({ targetPath }, onProgress)` where `onProgress` posts `scanProgress` to both findings panel and sidebar, (c) on success queries `db.finding.findMany({ where: { scanId: result.scanId } })` + maps to `FindingRow[]` and calls `findingsPanelManager.postFindingsUpdate()`, queries scans/summary and sends `stateUpdate` to sidebar, calls `scanTreeProvider.refresh()`, (d) catches "already in progress" errors as `showWarningMessage()`, other errors as `showErrorMessage()`
- [x] T009 [US1] Implement the `ashWorkbench.startScan` command in `vsix/src/commands/scanCommands.ts`: query `db.scanTarget.findMany({ where: { projectId } })` for existing targets, build `vscode.window.showQuickPick()` items with workspace root first, then DB targets (deduplicated), then separator and "Browse..." option. If "Browse..." selected, show `vscode.window.showOpenDialog({ canSelectFolders: true, canSelectFiles: false })`. On selection, call `executeScan()` with the chosen path
- [x] T010 [US1] Update `vsix/src/commands/index.ts`: change `registerAllCommands` to accept and pass through `scanner`, `db`, `projectId`, `findingsPanelManager`, `sidebarWebviewProvider`, `scanTreeProvider` to `registerScanCommands()`
- [x] T011 [US1] Update `vsix/src/extension.ts`: pass `scanner`, `db`, `project.id`, `findingsPanelManager`, `sidebarWebviewProvider`, `scanTreeProvider` to `registerAllCommands()`. Update `FindingsPanelManager` constructor call to pass `scanner`. Remove `setFindingsPanelManagerRef()` call

**Checkpoint**: Command palette scan works end-to-end with target picker, progress, and result display.

---

## Phase 4: User Story 2 — Run Scan from Explorer Context Menu (Priority: P1)

**Goal**: Right-click folder → "ASH: Run Security Scan" starts scan immediately for that folder.

**Independent Test**: Right-click a folder, select scan, verify scan runs against that specific folder path.

### Implementation for User Story 2

- [x] T012 [US2] Implement the `ashWorkbench.scanFolder` command in `vsix/src/commands/scanCommands.ts`: receive `folderUri: vscode.Uri`, extract `fsPath`, call `executeScan()` with that path (bypassing the target picker). The `executeScan()` helper from T008 handles all the progress/completion/error logic

**Checkpoint**: Context menu scan works. Same pipeline as command palette but skips target picker.

---

## Phase 5: User Story 3 — Scan Progress Visibility (Priority: P1)

**Goal**: During scan execution, both findings panel and sidebar show real-time elapsed time and status.

**Independent Test**: Start a scan, observe progress updates in both WebViews.

### Implementation for User Story 3

- [x] T013 [US3] Add `scanProgress` case to the MESSAGE handler in the reducer function in `webview/src/App.tsx`: update state with `scanElapsed: message.payload.elapsed` and `scanStatus: message.payload.status`, keep current view as `scanProgress` (the view is already set by `scanStarted` handler). Also update the `scanStarted` handler to use the new `scanId` field from the updated payload

**Checkpoint**: Progress updates are visible in the WebView during scan execution.

---

## Phase 6: User Story 4 — Cancel a Running Scan (Priority: P1)

**Goal**: User can cancel a running scan via command palette or WebView.

**Independent Test**: Start a scan, cancel it, verify process stops and UI shows cancelled state.

### Implementation for User Story 4

- [x] T014 [US4] Implement the `ashWorkbench.cancelScan` command in `vsix/src/commands/scanCommands.ts`: get current scan ID from `scanner` (needs access to `currentScanId` — add a public getter `getCurrentScanId(): string | null` to `ScannerService` in `vsix/src/services/scanner.ts`), call `scanner.cancelScan(scanId)` if a scan is running, show info message if no scan is running
- [x] T015 [US4] Add `cancelScan` message handler to `vsix/src/providers/findingsPanelManager.ts`: in `handleMessage()` switch, handle `'cancelScan'` by calling `scanner.cancelScan(message.payload.scanId)`

**Checkpoint**: Cancel works from both command palette and WebView.

---

## Phase 7: User Story 5 — Run Scan from Sidebar (Priority: P2)

**Goal**: "Scan Workspace" button in sidebar triggers a scan for the workspace root.

**Independent Test**: Click sidebar button, verify scan runs against workspace root.

### Implementation for User Story 5

- [x] T016 [US5] Add `scanner: ScannerService` parameter to `SidebarWebviewProvider` constructor in `vsix/src/providers/sidebarWebviewProvider.ts`. Add public methods: `postProgress(scanId: string, elapsed: number, status: string): void` (sends `scanProgress` to sidebar view), `postStateUpdate(scans: ScanSummary[], summary: DispositionSummary): void` (sends `stateUpdate` to sidebar view)
- [x] T017 [US5] Replace `startScan` message handler in `vsix/src/providers/sidebarWebviewProvider.ts`: instead of showing mock info message, get workspace root from `vscode.workspace.workspaceFolders?.[0]?.uri.fsPath`, call `executeScan()` or inline the scan execution flow (call `scanner.startScan({ targetPath: workspaceRoot }, onProgress)`, handle completion by querying DB for updated scans/summary and posting `stateUpdate`, open findings panel via `findingsPanelManager`). If no workspace folder, show warning
- [x] T018 [US5] Update `vsix/src/extension.ts`: pass `scanner` to `SidebarWebviewProvider` constructor

**Checkpoint**: Sidebar scan button works end-to-end.

---

## Phase 8: User Story 6 — Run Scan from Findings Panel (Priority: P2)

**Goal**: "Run Scan" button in findings panel triggers a scan for the currently active target.

**Independent Test**: Open findings panel, click "Run Scan", verify scan runs and panel updates with new results.

### Implementation for User Story 6

- [x] T019 [US6] Add `startScan` message handler to `vsix/src/providers/findingsPanelManager.ts`: in `handleMessage()` switch, handle `'startScan'` by extracting `targetPath` from `message.payload`, calling `scanner.startScan({ targetPath }, onProgress)` with progress callback that posts `scanProgress` to the panel, on completion query findings and send `findingsUpdate`, refresh scan tree and sidebar

**Checkpoint**: Findings panel rescan works end-to-end.

---

## Phase 9: Polish & Cross-Cutting Concerns

**Purpose**: Compile, lint, and verify all changes work together.

- [x] T020 Run `npm run compile` in `vsix/` and fix any TypeScript errors across all modified files
- [x] T021 Run `npm run lint` in `vsix/` and fix any ESLint errors in modified files
- [x] T022 Run `npm run compile` in `webview/` (or `npm run build`) and fix any TypeScript errors in `App.tsx` and `messages.ts`
- [x] T023 Run `npm run test:unit` in `vsix/` and verify existing tests still pass (sarif, project, scanner tests)
- [x] T024 Verify no remaining mock data imports in any provider or command file (search for `../mock/data` imports in `vsix/src/`)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately. T001, T002, T003 are all parallel.
- **Foundational (Phase 2)**: Depends on Phase 1 (mappers needed for DB queries). T004, T005, T006 are sequential due to shared patterns but can be parallelized if careful.
- **US1 (Phase 3)**: Depends on Phase 2 (providers must have real DB queries before wiring scan execution)
- **US2 (Phase 4)**: Depends on US1 (T008's `executeScan()` helper must exist)
- **US3 (Phase 5)**: Depends on Phase 1 (message types must include `scanProgress`). Can run in parallel with US1.
- **US4 (Phase 6)**: Depends on US1 (scan must be startable to test cancellation)
- **US5 (Phase 7)**: Depends on US1 (scan execution flow must work)
- **US6 (Phase 8)**: Depends on US1 and Phase 2 (findingsPanelManager must have both DB queries and scanner)
- **Polish (Phase 9)**: Depends on all previous phases

### User Story Dependencies

- **US1 (P1)**: Foundational → US1. Core scan execution pipeline.
- **US2 (P1)**: US1 → US2. Reuses `executeScan()` helper from US1.
- **US3 (P1)**: Phase 1 → US3. WebView reducer change is independent of extension wiring.
- **US4 (P1)**: US1 → US4. Needs scan running to test cancellation.
- **US5 (P2)**: US1 → US5. Sidebar scan uses same pipeline.
- **US6 (P2)**: US1 → US6. Findings panel scan uses same pipeline.

### Within Each User Story

- Shared infrastructure before story-specific code
- Command/provider handlers after helper functions
- extension.ts wiring after all consumers are ready

### Parallel Opportunities

- Phase 1: T001, T002, T003 are all parallel (different files)
- After US1 completes: US2, US4, US5, US6 can all proceed in parallel
- US3 can run in parallel with US1 (different package — webview vs vsix)

---

## Parallel Example: After US1 Completes

```bash
# These can all run in parallel after Phase 3:
Task: T012 [US2] "Implement scanFolder command"
Task: T014 [US4] "Implement cancelScan command"
Task: T016 [US5] "Add scanner to SidebarWebviewProvider"
Task: T019 [US6] "Add startScan handler to FindingsPanelManager"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (message types + mappers)
2. Complete Phase 2: Foundational (replace mock data in all providers)
3. Complete Phase 3: User Story 1 (command palette scan end-to-end)
4. **STOP and VALIDATE**: Run extension, trigger scan from command palette, verify pipeline works
5. Core product value delivered: scans run and results appear in UI

### Incremental Delivery

1. Setup + Foundational → Message types ready, mock data gone
2. US1 → Command palette scan works → **MVP!**
3. US2 → Context menu scan works (trivial — reuses US1 helper)
4. US3 → WebView shows progress (can be done in parallel with US1)
5. US4 → Cancel scan works
6. US5 → Sidebar scan works
7. US6 → Findings panel rescan works
8. Polish → All checks pass

---

## Notes

- [P] tasks = different files or independent changes, no dependencies
- [Story] label maps each task to its user story for traceability
- US2 is a single-task phase — its implementation is a thin wrapper around US1's `executeScan()` helper
- US3 is a webview-only change (App.tsx reducer) and can be done in parallel with vsix-side work
- The `executeScan()` helper in scanCommands.ts is the linchpin — it encapsulates the entire scan-to-completion flow and is reused by US1, US2, US5, and US6
- No test tasks included since tests were not explicitly requested in the specification
- All providers already accept `db`/`project` but don't use them — activation is a matter of removing `_` prefix and adding real queries
