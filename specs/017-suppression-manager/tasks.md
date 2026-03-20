# Tasks: Suppression Management View

**Input**: Design documents from `/specs/017-suppression-manager/`
**Prerequisites**: plan.md (required), spec.md (required), research.md, data-model.md, contracts/message-protocol.md

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Add shared types and message definitions that all user stories depend on

- [x] T001 Add `SuppressionStatus`, `MatchedFindingRef`, `SuppressionEntry`, `SuppressionWriteResult` types to `vsix/src/models/types.ts` per data-model.md. `SuppressionEntry extends AshSuppression` with `status: SuppressionStatus`, `matchCount: number`, `matchedFindings: MatchedFindingRef[]`. `SuppressionWriteResult` has `success: boolean`, optional `error: string`
- [x] T002 Add 6 new message types to the discriminated unions in `vsix/src/models/messages.ts` per contracts/message-protocol.md: WebView→Ext: `requestSuppressions`, `editSuppression` (payload: `{ old: AshSuppression, updated: AshSuppression }`), `removeSuppression` (payload: `{ suppression: AshSuppression }`), `addSuppression` (payload: `{ suppression: AshSuppression }`). Ext→WebView: `suppressionsUpdate` (payload: `{ suppressions: SuppressionEntry[], ignorePaths: AshIgnorePath[], configInfo: AshYamlConfigSummary }`), `suppressionWriteResult` (payload: `SuppressionWriteResult`)
- [x] T003 [P] Mirror new types from T001 to `webview/src/types/types.ts` — exact copy of `SuppressionStatus`, `MatchedFindingRef`, `SuppressionEntry`, `SuppressionWriteResult`
- [x] T004 [P] Mirror new message types from T002 to `webview/src/types/messages.ts` — exact copy of all 6 new union members

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Extension host service methods, handlers, state model, and command registration that MUST be complete before any user story UI work

- [x] T005 Add `getSuppressionStatuses(findings: FindingRow[]): SuppressionEntry[]` method to `vsix/src/services/ashYaml.ts`. For each suppression from `getSuppressions()`: check `isExpired()` from ashYamlCore, count matching findings by iterating `findings` array and testing each against the suppression using `findMatchingSuppression` logic (reversed per R4), build `MatchedFindingRef[]` from matching findings (id, severity, title, file, line). Return `SuppressionEntry[]` with computed `status`, `matchCount`, `matchedFindings`
- [x] T006 [P] Add `updateSuppression(old: AshSuppression, updated: AshSuppression): Promise<SuppressionWriteResult>` to `vsix/src/services/ashYamlWrite.ts`. Read file, parse YAML, use `findSuppressionIndex(suppressions, old)` to locate entry, replace with `updated` in array, call `reserializeSuppressionsSection()` to write back. Include conflict detection (mtime check) and validation (reason non-empty, expiration in future if set). Return `SuppressionWriteResult`
- [x] T007 [P] Add `removeSuppressionRule(suppression: AshSuppression): Promise<SuppressionWriteResult>` to `vsix/src/services/ashYamlWrite.ts`. Read file, parse YAML, use `findSuppressionIndex(suppressions, suppression)` to locate entry, remove from array, call `reserializeSuppressionsSection()` to write back. Include mtime conflict detection. Return `SuppressionWriteResult`
- [x] T008 [P] Add `addSuppressionDirect(suppression: AshSuppression): Promise<SuppressionWriteResult>` to `vsix/src/services/ashYamlWrite.ts`. Accepts raw `AshSuppression` (no `SuppressionInput` conversion needed). If file exists, append via `appendSuppressionEntry()`. If not, create via `generateSkeleton()`. Validate reason non-empty, expiration in future if set. Return `SuppressionWriteResult`
- [x] T009 Add 4 message handlers to `handleMessage()` switch in `vsix/src/providers/findingsPanelManager.ts`: (1) `requestSuppressions` — call `ashYamlService.getSuppressionStatuses(currentFindings)`, get ignore paths and config from `ashYamlService.getConfig()`, post `suppressionsUpdate` with all three payloads. (2) `editSuppression` — call `ashYamlWriteService.updateSuppression(old, updated)`, post `suppressionWriteResult`. (3) `removeSuppression` — call `ashYamlWriteService.removeSuppressionRule(suppression)`, post `suppressionWriteResult`. (4) `addSuppression` — call `ashYamlWriteService.addSuppressionDirect(suppression)`, post `suppressionWriteResult`
- [x] T010 Add `showSuppressionManager()` method to `FindingsPanelManager` in `vsix/src/providers/findingsPanelManager.ts`. Call `ensurePanel()`, then use `setTimeout` to defer initial `requestSuppressions` message post (per panel manager lifecycle pattern). Also send an init message with context `'editorPanel'` and view hint `'suppressionManager'`
- [x] T011 [P] Register `ashWorkbench.manageSuppressions` command in `vsix/package.json` under `contributes.commands` with title "ASH: Manage Suppressions". Wire command handler in `vsix/src/extension.ts` to call `findingsPanelManager.showSuppressionManager()`
- [x] T012 Extend `ViewState` type in `webview/src/App.tsx` to include `'suppressionManager'`. Add suppression management fields to `AppState`: `suppressions: SuppressionEntry[]`, `ignorePaths: AshIgnorePath[]`, `suppressionManagerConfig: AshYamlConfigSummary | null`, `editingSuppressionIndex: number | null`, `addingNewSuppression: boolean`. Set initial values in `initialState`. Add `AppAction` variants: `OPEN_SUPPRESSION_EDIT` (index: number), `CLOSE_SUPPRESSION_EDIT`, `START_ADD_SUPPRESSION`, `CANCEL_ADD_SUPPRESSION`
- [x] T013 Add reducer cases in `webview/src/App.tsx` for: (1) `suppressionsUpdate` message — update `suppressions`, `ignorePaths`, `suppressionManagerConfig` from payload. (2) `suppressionWriteResult` message — on success close any open edit/add form (`editingSuppressionIndex: null`, `addingNewSuppression: false`); on failure, keep form open (error displayed by component). (3) `OPEN_SUPPRESSION_EDIT`, `CLOSE_SUPPRESSION_EDIT`, `START_ADD_SUPPRESSION`, `CANCEL_ADD_SUPPRESSION` — toggle local form state. (4) Handle `'suppressionManager'` in the `NAVIGATE` case (push to viewHistory). Also handle init message with view hint `'suppressionManager'` to set initial view

**Checkpoint**: Foundation ready — all services, handlers, state model, and command wiring complete. User story UI work can begin.

---

## Phase 3: User Story 1 + User Story 2 — View All Rules + Navigate (Priority: P1) — MVP

**Goal**: Users can see all suppression rules with statuses and navigate to the view from dashboard, panel header, and command palette

**Independent Test**: Open the Suppression Manager via any entry point with a `.ash.yaml` containing rules and a completed scan. Verify all rules display with correct status badges and match counts. Verify empty state when no `.ash.yaml` exists.

- [x] T014 [US1] Create `SuppressionTable` component in `webview/src/components/SuppressionTable.tsx`. Props: `suppressions: SuppressionEntry[]`, `onRemove`, `onEdit`, `onExpand`, `onFindingClick`. Render a table with columns: Rule ID (show "Any" if null), Path, Line range ("L{start}-L{end}" or "Any"), Reason (truncated to ~60 chars), Expiration (date or "None"), Status badge (Active/green, Unused/amber, Expired/gray — use `theme-colors.ts` domain color map pattern), Match count. Each row has Edit and Remove icon buttons (`variant="outline"`). Use ShadCN `Table` component. For MVP: basic table rendering only (sort/filter/search added in US3)
- [x] T015 [US1] Create `SuppressionManagerView` component in `webview/src/components/SuppressionManagerView.tsx`. Props: `suppressions`, `ignorePaths`, `configInfo`, `currentFindings`, `editingSuppressionIndex`, `addingNewSuppression`, plus callbacks for all actions. Compose: (1) `AppBreadcrumb` with segments `["Dashboard", "Suppressions"]`. (2) Summary header card showing total/active/unused/expired counts and source file path (clickable — posts `openFile` message). (3) `SuppressionTable` with current suppressions. (4) Empty state when no suppressions: message "No suppression rules defined" with "Add Suppression" button. (5) "No scan data" indicator when no findings loaded
- [x] T016 [US1] Wire `SuppressionManagerView` into the render switch in `webview/src/App.tsx`. When `state.view === 'suppressionManager'`, render the view with props from state and dispatch/postMessage callbacks. Create a `navigateToSuppressionManager()` helper (following the `selectScan`/`selectScanTarget` dual pattern): dispatch `NAVIGATE` + postMessage `requestSuppressions`
- [x] T017 [US2] Add "Manage Suppressions" link to `webview/src/components/SidebarDashboard.tsx`. Show count: "Manage Suppressions ({N} rules)" where N is `ashYamlConfig?.suppressionCount ?? 0`. Show "0 rules" when no config. On click, post `manageSuppressions` message to extension host (which calls `showSuppressionManager`). Alternatively, if sidebar can dispatch to the editor panel, use that pattern
- [x] T018 [US2] Add "Manage Suppressions" button to `webview/src/components/DashboardView.tsx` in the quick actions area alongside existing buttons. Use `variant="outline"` per button convention. Show suppression rule count. On click, navigate to suppression manager view using the helper from T016
- [x] T019 [US2] Add reactive refresh: when the webview is on the `'suppressionManager'` view and receives `ashYamlChanged` message, automatically re-request suppression data by posting `requestSuppressions`. Add this logic to the `ashYamlChanged` handler in the reducer or in a `useEffect` in `App.tsx`

**Checkpoint**: MVP complete. Users can navigate to the Suppression Manager from sidebar, dashboard, or command palette and see all rules with status/match count. The view auto-refreshes on `.ash.yaml` changes.

---

## Phase 4: User Story 3 — Filter, Sort, and Search (Priority: P2)

**Goal**: Users can find specific rules quickly using status filters, column sorting, and text search

**Independent Test**: Load 15+ mock rules with mixed statuses. Verify filter chips narrow by status, column headers toggle sort, and search box filters by text across Rule ID, Path, and Reason.

- [x] T020 [US3] Add filter state to `SuppressionTable` in `webview/src/components/SuppressionTable.tsx`: local `useState` for `activeFilters: Set<SuppressionStatus>` (default: all three selected), `searchQuery: string` (default: empty), `sortColumn: string | null`, `sortDirection: 'asc' | 'desc'`. Render filter toggle chips (Active, Unused, Expired) above the table using ShadCN `Badge` or `Button` with `variant="secondary"` when selected, `variant="outline"` when not. Filter chips are local UI state per constitution (not extension host state)
- [x] T021 [US3] Add search input to `SuppressionTable` in `webview/src/components/SuppressionTable.tsx`. Use ShadCN `Input` with placeholder "Search by rule ID, path, or reason...". Filter suppressions array in `useMemo`: apply status filter (intersection of activeFilters), then text search (case-insensitive match against `rule_id`, `path`, `reason`). Show count of filtered results: "Showing X of Y rules"
- [x] T022 [US3] Add column sort to `SuppressionTable` in `webview/src/components/SuppressionTable.tsx`. Make column headers clickable. On click, toggle sort: null → asc → desc → null. Sort filtered suppressions in `useMemo` by selected column. Add sort indicator icon (chevron up/down) next to active sort column. Sortable columns: Rule ID (string), Path (string), Match count (number), Expiration (date, nulls last), Status (active < unused < expired)

**Checkpoint**: Filter, sort, and search working. Users can find specific rules from large lists.

---

## Phase 5: User Story 4 — View Matched Findings (Priority: P2)

**Goal**: Users can expand a suppression row to see which findings it matches, and click through to finding detail

**Independent Test**: Expand a rule row with matchCount > 0 and verify findings display with severity, title, file, line. Click a finding and verify navigation to finding detail view.

- [x] T023 [US4] Add expandable row capability to `SuppressionTable` in `webview/src/components/SuppressionTable.tsx`. Track `expandedIndex: number | null` in local state. When a row is clicked (not on Edit/Remove buttons), toggle expansion. Below the expanded row, render a sub-table or list of `matchedFindings`: for each show severity badge (use `theme-colors.ts`), title, file path (truncated), line number. If `matchCount === 0`, show "No findings matched by this rule in the latest scan." Each finding row is clickable — calls `onFindingClick(findingId)` prop
- [x] T024 [US4] Wire finding click in `webview/src/App.tsx`: when `onFindingClick` is called from SuppressionTable, find the matching `FindingRow` in `currentFindings` by id, set it as `selectedFinding`, and navigate to `'findingDetail'` view (push `'suppressionManager'` to viewHistory so Back returns to manager)

**Checkpoint**: Matched findings expandable and navigable. Users can understand rule impact.

---

## Phase 6: User Story 5 — Remove Suppression Rule (Priority: P2)

**Goal**: Users can remove unwanted or expired rules directly from the management view

**Independent Test**: Click Remove on a rule, confirm, verify rule disappears from list and `.ash.yaml` file is updated. Verify cancel leaves list unchanged.

- [x] T025 [US5] Add remove confirmation dialog to `SuppressionTable` in `webview/src/components/SuppressionTable.tsx`. When Remove button is clicked, show ShadCN `AlertDialog` with message: "Remove this suppression rule? This will unsuppress {matchCount} finding(s) in the current scan." (or "No findings are currently matched by this rule." if matchCount === 0). On confirm, call `onRemove(suppression)` prop. On cancel, close dialog
- [x] T026 [US5] Wire remove action in `webview/src/App.tsx`: `onRemove` callback posts `removeSuppression` message with the `AshSuppression` payload to extension host. Handle `suppressionWriteResult` — on failure, show error (can use a transient state or toast pattern). On success, the file watcher triggers `suppressionsUpdate` which refreshes the list automatically

**Checkpoint**: Remove working end-to-end. Users can clean up expired and unwanted rules.

---

## Phase 7: User Story 6 — Edit Suppression Rule (Priority: P2)

**Goal**: Users can modify any field of an existing suppression rule via an inline form

**Independent Test**: Click Edit on a rule, verify form pre-fills with current values. Change a field, save, verify `.ash.yaml` updated. Verify validation (empty reason rejected, past expiration rejected).

- [x] T027 [US6] Create `SuppressionRuleForm` component in `webview/src/components/SuppressionRuleForm.tsx`. Props: `initialValues?: AshSuppression` (null for add mode), `onSave: (suppression: AshSuppression) => void`, `onCancel: () => void`, `isPending?: boolean`. Fields: Path (ShadCN `Input`, required), Rule ID (`Input`, optional — empty = null/"any rule"), Reason (`Textarea`, required), Line start/Line end (number `Input`s, optional), Expiration (date `Input` type="date", optional, must be future per FR-023). Validate on submit: path non-empty, reason non-empty, expiration in future if set, line_end >= line_start if both set. Show inline validation errors. Save button disabled while `isPending`
- [x] T028 [US6] Integrate edit form into `SuppressionTable` in `webview/src/components/SuppressionTable.tsx`. When `editingSuppressionIndex` matches a row index, render `SuppressionRuleForm` below that row (inline, replacing the expanded content area). Pre-fill with the suppression's current values. On save, call `onEdit(oldSuppression, updatedSuppression)` prop. On cancel, call `onCloseEdit()` prop. Only one edit form open at a time — opening edit on another row closes the current one
- [x] T029 [US6] Wire edit action in `webview/src/App.tsx`: Edit button dispatches `OPEN_SUPPRESSION_EDIT` with index. `onEdit` callback posts `editSuppression` message with `{ old, updated }` payload. Cancel dispatches `CLOSE_SUPPRESSION_EDIT`. Success from `suppressionWriteResult` closes the form (reducer already handles this from T013)

**Checkpoint**: Edit working end-to-end. Users can refine rules without touching YAML.

---

## Phase 8: User Story 7 — Add New Suppression Rule (Priority: P3)

**Goal**: Users can create freeform suppression rules from the management view with autocomplete assistance

**Independent Test**: Click "Add Suppression", fill form, save, verify rule appears in list and `.ash.yaml`. Verify autocomplete suggests known paths and rule IDs.

- [x] T030 [US7] Add "Add Suppression" button to `SuppressionManagerView` in `webview/src/components/SuppressionManagerView.tsx` above the table. Use `variant="outline"`. When clicked, dispatch `START_ADD_SUPPRESSION`. When `addingNewSuppression` is true, render `SuppressionRuleForm` (with no `initialValues`) above the table. On save, call `onAdd(suppression)` prop. On cancel, dispatch `CANCEL_ADD_SUPPRESSION`
- [x] T031 [US7] Add autocomplete suggestions to `SuppressionRuleForm` in `webview/src/components/SuppressionRuleForm.tsx`. Accept optional props `knownPaths?: string[]`, `knownRuleIds?: string[]` (extracted from `currentFindings` in the parent). For Path field: show filtered suggestions in a dropdown as user types (use ShadCN `Command` or a simple filtered list). For Rule ID field: same pattern. Suggestions are derived from `currentFindings` — unique file paths and unique rule IDs
- [x] T032 [US7] Wire add action in `webview/src/App.tsx`: `onAdd` callback posts `addSuppression` message with the `AshSuppression` payload. Compute `knownPaths` and `knownRuleIds` from `currentFindings` via `useMemo` and pass to `SuppressionManagerView`. Success from `suppressionWriteResult` closes the form

**Checkpoint**: Add working end-to-end with autocomplete. Users can create broad suppression rules.

---

## Phase 9: User Story 8 + User Story 9 — Ignore Paths + Config Summary (Priority: P3)

**Goal**: Users can see ignore paths and configuration info from `.ash.yaml` without opening the file

**Independent Test**: Load `.ash.yaml` with ignore paths and config settings. Verify ignore paths table renders with status. Verify config panel shows project name, threshold, scanners, fail flag. Verify section hidden when no data.

- [x] T033 [P] [US8] Add ignore paths section to `SuppressionManagerView` in `webview/src/components/SuppressionManagerView.tsx`. Below the suppression table, render a "Scan Exclusions" section when `ignorePaths.length > 0`. Use a simple ShadCN `Table` with columns: Path, Reason, Expiration, Status (Active/Expired — compute from expiration date using same logic as suppressions). Read-only, no actions. Hide entire section when `ignorePaths` is empty
- [x] T034 [P] [US9] Add configuration info panel to `SuppressionManagerView` in `webview/src/components/SuppressionManagerView.tsx`. Below ignore paths, render a collapsible "Configuration" section when `configInfo` is not null. Show: Project name (or "Not set"), Severity threshold, Enabled scanners (comma-separated list or "None"), Fail on findings (Yes/No). All read-only. Clickable source file path (from `configInfo` or derived from `AshYamlService.getConfig().configFilePath`) that posts `openFile` message to open `.ash.yaml` in editor

**Checkpoint**: Full suppression management view complete with all informational sections.

---

## Phase 10: Polish & Cross-Cutting Concerns

**Purpose**: Kitchen Sink demos and final verification

- [x] T035 [P] Create Kitchen Sink demo in `webview/src/pages/sink/suppression-management-demo.tsx`. Import `SuppressionManagerView`, `SuppressionTable`, and `SuppressionRuleForm`. Create mock data in the demo file (not in mock-data.ts): 3 active rules, 2 unused rules, 2 expired rules with varied fields. Render `SuppressionTable` with mock data showing all status variants. Render `SuppressionRuleForm` in both add mode (empty) and edit mode (pre-filled). Include ignore paths and config mock data
- [x] T036 [P] Register Kitchen Sink demo in `webview/src/pages/sink/sink-registry.ts`. Add entry: `'suppression-management': { name: 'Suppression Management', component: SuppressionManagementDemo, type: 'app', className: 'w-full' }`
- [x] T037 Run `cd vsix && npm run compile` and `cd webview && npm run build` to verify no TypeScript errors. Fix any type mismatches between vsix and webview packages. Verify type sync between `vsix/src/models/types.ts` and `webview/src/types/types.ts`, and between `vsix/src/models/messages.ts` and `webview/src/types/messages.ts`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Setup (T001-T004) completion — BLOCKS all user stories
- **US1+US2 (Phase 3)**: Depends on Foundational (Phase 2) — MVP deliverable
- **US3, US4, US5, US6 (Phases 4-7)**: All depend on US1+US2 (Phase 3) for the base view to exist
  - US3 (filter/sort/search), US4 (expand), US5 (remove) can proceed in parallel
  - US6 (edit) can proceed in parallel with US3-US5
- **US7 (Phase 8)**: Depends on US6 (Phase 7) — reuses `SuppressionRuleForm` component
- **US8+US9 (Phase 9)**: Depend on US1+US2 (Phase 3) — can proceed in parallel with US3-US7
- **Polish (Phase 10)**: Depends on all components being built (Phases 3-9)

### User Story Dependencies

```
Setup (Phase 1)
  └── Foundational (Phase 2)
        └── US1+US2 (Phase 3) ← MVP
              ├── US3 (Phase 4) ─────┐
              ├── US4 (Phase 5) ─────┤ (parallel)
              ├── US5 (Phase 6) ─────┤
              ├── US6 (Phase 7) ─────┤
              │     └── US7 (Phase 8)│
              └── US8+US9 (Phase 9) ─┘
                                     └── Polish (Phase 10)
```

### Parallel Opportunities

**Within Phase 1 (Setup)**:
- T003 and T004 (webview mirrors) can run in parallel

**Within Phase 2 (Foundational)**:
- T006, T007, T008 (write service methods) can run in parallel — different methods, same file but independent sections
- T011 (command registration) can run in parallel with service work

**After Phase 3 (US1+US2)**:
- US3, US4, US5, US6, US8+US9 can all start in parallel
- US7 must wait for US6 (form component dependency)

**Within Phase 9**:
- T033 (ignore paths) and T034 (config panel) can run in parallel

**Within Phase 10**:
- T035, T036 (Kitchen Sink) can run in parallel with T037 (verification)

---

## Parallel Example: After Phase 3 MVP

```
# These can all launch simultaneously:
Agent A: US3 — Filter/sort/search (T020, T021, T022)
Agent B: US4 — Expandable matched findings (T023, T024)
Agent C: US5 — Remove rule (T025, T026)
Agent D: US6 — Edit rule + form (T027, T028, T029) → then US7 (T030, T031, T032)
Agent E: US8+US9 — Ignore paths + config (T033, T034)
```

---

## Implementation Strategy

### MVP First (US1 + US2 Only)

1. Complete Phase 1: Setup (T001-T004)
2. Complete Phase 2: Foundational (T005-T013)
3. Complete Phase 3: US1+US2 (T014-T019)
4. **STOP and VALIDATE**: Open Kitchen Sink or Extension Development Host, navigate to Suppression Manager, verify rules display with statuses
5. Demo if ready — users can already see all their suppression rules

### Incremental Delivery

1. Setup + Foundational → Foundation ready
2. US1+US2 → Test: view renders with rules and statuses → **MVP!**
3. US3 → Test: filter/sort/search narrows list correctly
4. US4 → Test: expand shows matched findings
5. US5 → Test: remove updates `.ash.yaml` and refreshes view
6. US6 → Test: edit form pre-fills and saves correctly
7. US7 → Test: add form with autocomplete creates new rules
8. US8+US9 → Test: ignore paths and config display correctly
9. Polish → Kitchen Sink demos + compile verification

---

## Notes

- [P] tasks = different files or independent sections, no dependencies
- [Story] label maps task to specific user story for traceability
- Types and messages MUST be kept in sync between `vsix/src/models/` and `webview/src/types/` (T001↔T003, T002↔T004)
- All buttons use `variant="outline"` per constitution
- Status badges use domain color maps from `webview/src/lib/theme-colors.ts`
- Filter/sort/search state is local UI state (not extension host state) per constitution principle II
- The `SuppressionRuleForm` component (T027) is shared between edit (US6) and add (US7) flows
- Every postMessage to extension host for data follows the dual dispatch+postMessage pattern
