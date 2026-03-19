# Tasks: Scan Root Setting

**Input**: Design documents from `/specs/012-scan-root-setting/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: Not explicitly requested in the feature specification. Test tasks are omitted.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Setting definition, core service, and message protocol — the foundation all stories build on

- [X] T001 Update vsix/package.json: add `ashWorkbench.scanRoot` string setting (default `""`, resource scope) to contributes.configuration; remove `ashWorkbench.scanFolder` from contributes.commands and contributes.menus.explorer/context
- [X] T002 Create ScanRootService class in vsix/src/services/scanRoot.ts — constructor(workspaceRoot: string), refresh() reads `ashWorkbench.scanRoot` config and validates with fs.statSync (falls back to workspaceRoot with showWarningMessage on invalid), getEffectiveScanRoot() returns cached string, isInScope(targetPath) checks prefix match with path separator awareness, buildPathFilter() returns Prisma-compatible `{ OR: [{ path: root }, { path: { startsWith: root + sep } }] }`
- [X] T003 [P] Update message types in vsix/src/models/messages.ts — change `startScan` from `{ type: 'startScan'; payload: { targetPath: string } }` to `{ type: 'startScan' }`; add `scanRoot: string` to `stateUpdate` payload
- [X] T004 [P] Mirror message type changes in webview/src/types/messages.ts — same changes as T003 to keep both files in sync

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Service-layer filtering and removal of replaced components — MUST complete before user story wiring

**CRITICAL**: No user story work can begin until this phase is complete

- [X] T005 Add optional `scanRootFilter` parameter to `getScanSummaries()`, `getScanTargets()`, and `getSummary()` in vsix/src/services/findings.ts — when provided, merge into Prisma where clause: getScanSummaries filters via `scanTarget: { ...scanRootFilter }`, getScanTargets filters via `{ ...scanRootFilter }` on path field, getSummary filters via `scanTarget: { ...scanRootFilter }` on the findings groupBy query
- [X] T006 [P] Remove `ashWorkbench.scanFolder` command registration block (lines ~127-138) from vsix/src/commands/scanCommands.ts
- [X] T007 [P] Remove ScanTargetPicker import and all usage from webview/src/components/DashboardView.tsx — replace scan initiation with direct `postMessage({ type: 'startScan' })` call (no targetPath payload)
- [X] T008 [P] Remove ScanTargetPicker import and all usage from webview/src/components/ScanHistoryView.tsx — replace scan initiation with direct `postMessage({ type: 'startScan' })` call (no targetPath payload)
- [X] T009 Delete webview/src/components/ScanTargetPicker.tsx

**Checkpoint**: Foundation ready — FindingsService supports filtered queries, removed components are gone, message protocol updated

---

## Phase 3: User Story 1 — Zero-Config First Scan (Priority: P1) MVP

**Goal**: A developer clicks "Run Scan" with no configuration and the scan runs against the workspace root, identical to current behavior

**Independent Test**: Open a single-folder workspace with no `ashWorkbench.scanRoot` set, click "Run Scan" in sidebar, verify scan targets the workspace root directory

### Implementation for User Story 1

- [X] T010 [US1] Wire ScanRootService into extension.ts activation — instantiate `new ScanRootService(workspaceRoot)` after project creation (after line ~67), call `scanRootService.refresh()`, inject into FindingsPanelManager and SidebarWebviewProvider via setter methods (e.g., `setScanRootService()`), push no new disposables (service has no listeners) in vsix/src/extension.ts
- [X] T011 [P] [US1] Update SidebarWebviewProvider to use ScanRootService in vsix/src/providers/sidebarWebviewProvider.ts — add `setScanRootService()` setter, replace `vscode.workspace.workspaceFolders?.[0]?.uri.fsPath` in handleStartScan (line ~187) with `this.scanRootService.getEffectiveScanRoot()`, include `scanRoot: this.scanRootService.getEffectiveScanRoot()` in queryStateAndPost stateUpdate payload
- [X] T012 [P] [US1] Update FindingsPanelManager to use ScanRootService in vsix/src/providers/findingsPanelManager.ts — add `setScanRootService()` setter, replace `message.payload.targetPath` in startScan handler (line ~244) with `this.scanRootService.getEffectiveScanRoot()`, replace `vscode.workspace.workspaceFolders?.[0]?.uri.fsPath` in navigateToCode (line ~342) with `this.scanRootService.getEffectiveScanRoot()`, include `scanRoot` in postStateUpdate payload

**Checkpoint**: Scan via sidebar and editor panel uses workspace root by default — no regression from current behavior

---

## Phase 4: User Story 2 — Custom Scan Root (Priority: P1)

**Goal**: Setting `ashWorkbench.scanRoot` to a custom directory scopes all scans, findings, scan history, and dashboard data to that directory

**Independent Test**: Set `ashWorkbench.scanRoot` to a valid subdirectory, run a scan, verify all UI surfaces show only data matching that root

### Implementation for User Story 2

- [X] T013 [P] [US2] Wire scan root filter into ScanTreeProvider in vsix/src/providers/scanTreeProvider.ts — add `setScanRootService()` setter, call `this.scanRootService.buildPathFilter()` in getChildren() and pass as scanRootFilter to `this.findingsService.getScanSummaries(filter)`
- [X] T014 [P] [US2] Wire scan root filter into FindingsPanelManager state queries in vsix/src/providers/findingsPanelManager.ts — in postStateUpdate(), call `this.scanRootService.buildPathFilter()` and pass to `findingsService.getScanSummaries(filter)`, `findingsService.getSummary(filter)`, `findingsService.getScanTargets(filter)`
- [X] T015 [P] [US2] Wire scan root filter into SidebarWebviewProvider state queries in vsix/src/providers/sidebarWebviewProvider.ts — in queryStateAndPost(), call `this.scanRootService.buildPathFilter()` and pass to `findingsService.getScanSummaries(filter)`, `findingsService.getSummary(filter)`, `findingsService.getScanTargets(filter)`

**Checkpoint**: Custom scan root scopes all data — dashboard, scan history tree, and findings all show only in-scope data

---

## Phase 5: User Story 3 — Real-Time Setting Change (Priority: P2)

**Goal**: Changing `ashWorkbench.scanRoot` in VS Code settings immediately refreshes all UI surfaces without window reload

**Independent Test**: With findings displayed, change `ashWorkbench.scanRoot` in settings, verify sidebar, scan history tree, and editor panel all refresh within 2 seconds

### Implementation for User Story 3

- [X] T016 [US3] Register `vscode.workspace.onDidChangeConfiguration` listener in vsix/src/extension.ts — check `e.affectsConfiguration('ashWorkbench.scanRoot')`, then: (1) call `scanRootService.refresh()`, (2) call `findingsPanelManager.postStateUpdate()`, (3) call `sidebarWebviewProvider.queryStateAndPost()`, (4) call `scanTreeProvider.refresh()`. Push listener disposable to `context.subscriptions`

**Checkpoint**: Setting change triggers live refresh of all UI surfaces — no window reload needed

---

## Phase 6: User Story 4 — Invalid Scan Root Recovery (Priority: P3)

**Goal**: Invalid `ashWorkbench.scanRoot` values produce a clear warning and automatic fallback to workspace root

**Independent Test**: Set `ashWorkbench.scanRoot` to a nonexistent path, verify warning notification and workspace root fallback

### Implementation for User Story 4

- [X] T017 [US4] Verify and harden ScanRootService.refresh() validation edge cases in vsix/src/services/scanRoot.ts — ensure all three invalid cases are handled: (1) path does not exist → showWarningMessage + fallback, (2) path exists but is a file not directory → showWarningMessage + fallback, (3) relative path (does not start with `/` on macOS/Linux or drive letter on Windows) → showWarningMessage + fallback. Ensure correcting the path clears the warning state

**Checkpoint**: Invalid configurations never leave the user stuck — warning + automatic fallback for all edge cases

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Verify everything compiles and lints cleanly across both packages

- [X] T018 Run `npm run compile` and `npm run lint` in vsix/ to verify no TypeScript errors or ESLint warnings
- [X] T019 [P] Run `npm run build` in webview/ to verify React app compiles with ScanTargetPicker removed and message type changes

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on Phase 1 completion — BLOCKS all user stories
- **US1 (Phase 3)**: Depends on Phase 2 — wires ScanRootService into providers
- **US2 (Phase 4)**: Depends on Phase 3 — adds filtering on top of wired service
- **US3 (Phase 5)**: Depends on Phase 4 — config listener cascades to filtered providers
- **US4 (Phase 6)**: Depends on Phase 1 (T002) — can run after ScanRootService exists; fully testable after US3
- **Polish (Phase 7)**: Depends on all user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Depends on Foundational (Phase 2). Delivers working scan-via-scan-root with default behavior
- **User Story 2 (P1)**: Depends on US1 (Phase 3). Adds data filtering layer on top of wired ScanRootService
- **User Story 3 (P2)**: Depends on US2 (Phase 4). Adds real-time change listener that cascades through filtered providers
- **User Story 4 (P3)**: Depends on ScanRootService creation (T002). Validation edge case hardening — fully verifiable after US3

### Within Each User Story

- Extension host changes before WebView changes
- Service wiring before provider integration
- Provider updates before verification

### Parallel Opportunities

- **Phase 1**: T003 and T004 can run in parallel (different files, same changes)
- **Phase 2**: T006, T007, T008 can all run in parallel (different files, independent removals). T009 runs after T007 and T008
- **Phase 3**: T011 and T012 can run in parallel after T010 (different provider files)
- **Phase 4**: T013, T014, T015 can all run in parallel (three different provider files)
- **Phase 7**: T018 and T019 can run in parallel (different packages)

---

## Parallel Example: Phase 2 (Foundational)

```text
# Sequential first:
Task T005: "Add scanRootFilter to FindingsService in vsix/src/services/findings.ts"

# Then parallel removals:
Task T006: "Remove scanFolder handler from vsix/src/commands/scanCommands.ts"
Task T007: "Remove ScanTargetPicker from webview/src/components/DashboardView.tsx"
Task T008: "Remove ScanTargetPicker from webview/src/components/ScanHistoryView.tsx"

# Then cleanup:
Task T009: "Delete webview/src/components/ScanTargetPicker.tsx"
```

## Parallel Example: Phase 4 (US2 - Custom Scan Root)

```text
# All three can run in parallel (different provider files):
Task T013: "Wire filter into ScanTreeProvider in vsix/src/providers/scanTreeProvider.ts"
Task T014: "Wire filter into FindingsPanelManager in vsix/src/providers/findingsPanelManager.ts"
Task T015: "Wire filter into SidebarWebviewProvider in vsix/src/providers/sidebarWebviewProvider.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (setting + service + protocol)
2. Complete Phase 2: Foundational (filtering + removals)
3. Complete Phase 3: User Story 1 (wire service into providers)
4. **STOP and VALIDATE**: Scan via sidebar uses workspace root by default — zero regression
5. Demo if ready

### Incremental Delivery

1. Setup + Foundational → Infrastructure ready
2. Add US1 → Default scan works → Demo (MVP!)
3. Add US2 → Custom root scopes all data → Demo
4. Add US3 → Live setting changes → Demo
5. Add US4 → Error handling hardened → Demo
6. Each story adds capability without breaking previous stories

---

## Notes

- [P] tasks = different files, no dependencies on incomplete tasks
- [Story] label maps task to specific user story for traceability
- US1 and US2 are both P1 but sequenced because US2 builds filtering on top of US1's wiring
- US4 validation logic is created in T002 (ScanRootService) and hardened in T017
- No test tasks included — not requested in spec. Manual verification at each checkpoint
- Commit after each phase or logical group
