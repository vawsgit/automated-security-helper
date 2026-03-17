# Tasks: Finding Queries, Filters & Summary

**Input**: Design documents from `/specs/006-finding-queries-filters/`
**Prerequisites**: plan.md, spec.md, data-model.md, contracts/, research.md, quickstart.md

**Tests**: Not explicitly requested in the feature specification. No test tasks included.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Shared Types & Mapper)

**Purpose**: Add the `FilterState` type and `mapScanTargetToView()` mapper that all subsequent phases depend on.

- [x] T001 [P] Add `FilterState` interface to `vsix/src/models/types.ts` with optional fields: `severity?: Severity[]`, `scanner?: string`, `disposition?: Disposition[]`, `filePattern?: string`
- [x] T002 [P] Add `FilterState` interface to `webview/src/types/types.ts` — mirror the exact same definition from T001
- [x] T003 [P] Add `mapScanTargetToView()` function to `vsix/src/models/mappers.ts` that takes a Prisma `ScanTarget` record plus computed aggregates (scanCount, findingCount, lastScannedAt, severityCounts, triageSummary) and returns a `ScanTarget` view type

---

## Phase 2: Foundational (FindingsService & Message Protocol)

**Purpose**: Create the FindingsService class and update message types. MUST complete before user story phases.

- [x] T004 Create `vsix/src/services/findings.ts` with `FindingsService` class: constructor accepts `PrismaClient` and `projectId`. Implement `getFindings(scanId: string, filters?: FilterState): Promise<FindingRow[]>` — build dynamic Prisma `where` clause from FilterState fields (severity `in`, scanner `equals`, disposition `in`, file `contains`), query `db.finding.findMany()`, map results with `mapFindingToRow()`
- [x] T005 Add `getSummary(projectId: string): Promise<DispositionSummary>` to `FindingsService` in `vsix/src/services/findings.ts` — use `db.finding.groupBy({ by: ['disposition'], where: { projectId }, _count: true })`, assemble into `DispositionSummary` with counts per disposition state defaulting to 0
- [x] T006 Add `getScanSummaries(projectId: string): Promise<ScanSummary[]>` to `FindingsService` in `vsix/src/services/findings.ts` — query `db.scan.findMany({ where: { projectId }, orderBy: { startedAt: 'desc' } })`, map results with `mapScanToSummary()`
- [x] T007 Add `getScanTargets(projectId: string): Promise<ScanTarget[]>` to `FindingsService` in `vsix/src/services/findings.ts` — fetch all ScanTarget records, for each target query scan count, latest scan date, finding counts by severity (groupBy), finding counts by disposition (groupBy), assemble using `mapScanTargetToView()`
- [x] T008 [P] Add `applyFilters` variant to `WebviewToExtMessage` in `vsix/src/models/messages.ts`: `{ type: 'applyFilters'; payload: { scanId: string; filters: FilterState } }`. Import `FilterState` from types. Update `stateUpdate` payload in `ExtToWebviewMessage` to include `scanTargets: ScanTarget[]` — import `ScanTarget` from types
- [x] T009 [P] Mirror T008 changes in `webview/src/types/messages.ts`: add `applyFilters` to `WebviewToExtMessage`, update `stateUpdate` payload to include `scanTargets: ScanTarget[]`. Import `FilterState` and `ScanTarget` from types

**Checkpoint**: FindingsService is ready with all 4 methods. Message protocol updated in both packages.

---

## Phase 3: User Story 1 — View Real Findings for a Scan (Priority: P1)

**Goal**: Replace inline database queries in providers with FindingsService calls. Wire FindingsService into the extension. Push real scan targets via stateUpdate. After disposition changes, push refreshed stateUpdate.

**Independent Test**: Run a scan, open the findings panel. Verify real findings appear. Triage a finding and verify the dashboard summary updates with correct per-disposition counts.

### Implementation for User Story 1

- [x] T010 [US1] Update `vsix/src/extension.ts`: create `FindingsService` instance with `db` and `project.id`, pass it to `FindingsPanelManager` and `SidebarWebviewProvider` via new `setFindingsService()` setter methods
- [x] T011 [US1] Update `vsix/src/providers/findingsPanelManager.ts`: add `findingsService` field with `setFindingsService()` setter. Replace inline `db.finding.findMany()` in `requestState` handler with `findingsService.getFindings(scanId)`. Replace inline `db.finding.findMany()` in `startScan` completion handler with `findingsService.getFindings(result.scanId)`
- [x] T012 [US1] Update `vsix/src/providers/findingsPanelManager.ts` `setDisposition` handler: after successful `db.finding.update()`, query updated state via `findingsService.getScanSummaries()`, `.getSummary()`, `.getScanTargets()` and post a `stateUpdate` message with scans, summary, and scanTargets to the panel
- [x] T013 [US1] Update `vsix/src/providers/sidebarWebviewProvider.ts`: add `findingsService` field with `setFindingsService()` setter. Replace `queryStateAndPost()` to use `findingsService.getScanSummaries()`, `findingsService.getSummary()`, `findingsService.getScanTargets()` and include all three in the `stateUpdate` message payload

**Checkpoint**: Providers use FindingsService for all queries. stateUpdate includes scanTargets. Disposition changes refresh the dashboard summary.

---

## Phase 4: User Story 2 — Filter Findings by Criteria (Priority: P2)

**Goal**: Add applyFilters message handler so the WebView can request filtered findings from the extension host.

**Independent Test**: Open findings for a scan. Send an applyFilters message with severity filter. Verify only matching findings are returned.

### Implementation for User Story 2

- [x] T014 [US2] Add `applyFilters` case to `handleMessage()` switch in `vsix/src/providers/findingsPanelManager.ts`: extract `scanId` and `filters` from `message.payload`, call `findingsService.getFindings(scanId, filters)`, post `findingsUpdate` response with the filtered results

**Checkpoint**: Filter queries work from the extension host side. The WebView can request filtered findings.

---

## Phase 5: User Story 3 — Enriched Scan Targets & WebView Mock Removal (Priority: P3)

**Goal**: Remove all mock data imports from the WebView. Replace with empty initial state that gets populated by real data from the extension host via stateUpdate messages.

**Independent Test**: Open the extension. Verify the dashboard starts in a loading state, then shows real data once stateUpdate arrives. Verify scan target cards show computed counts. Verify no mock data text appears.

### Implementation for User Story 3

- [x] T015 [US3] Update `webview/src/App.tsx`: remove the `import { mockProject, mockScans, mockFindings, mockSummary, mockScanTargets, updateMockDisposition, updateMockNotes, recomputeScanTargets } from './mock-data'` import entirely
- [x] T016 [US3] Update `webview/src/App.tsx` initial state: replace `mockProject` with `{ id: '', name: '', rootPath: '' }`, `mockScans` with `[]`, `mockFindings` with `[]`, `mockSummary` with `{ total: 0, counts: { PENDING: 0, FIX: 0, SUPPRESS: 0, DEFER: 0 } }`, `mockScanTargets` with `[]`, set initial `view` to `'loading'`, set `scanId` to `undefined`
- [x] T017 [US3] Update `stateUpdate` handler in the reducer in `webview/src/App.tsx`: add `scanTargets: msg.payload.scanTargets` to the returned state. Add view transition: if current view is `'loading'`, change to `'dashboard'`
- [x] T018 [US3] Update `dispositionUpdated` handler in the reducer in `webview/src/App.tsx`: replace `updateMockDisposition(state.findings, ...)` with `state.findings.map(f => f.id === msg.payload.findingId ? { ...f, disposition: msg.payload.disposition } : f)`. Remove `recomputeScanTargets()` call (scanTargets now come from extension host via stateUpdate)
- [x] T019 [US3] Update `SET_DISPOSITION` action handler in the reducer in `webview/src/App.tsx`: replace `updateMockDisposition(state.findings, ...)` with simple `.map()`. Remove `recomputeScanTargets()` call
- [x] T020 [US3] Update `SET_NOTES` action handler in the reducer in `webview/src/App.tsx`: replace `updateMockNotes(state.findings, ...)` with `state.findings.map(f => f.id === action.findingId ? { ...f, notes: action.notes } : f)`

**Checkpoint**: WebView uses no mock data. Dashboard shows real data from extension host. Scan target cards show computed aggregates.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Compile, lint, and verify all changes work together.

- [x] T021 Run `npm run compile` in `vsix/` and fix any TypeScript errors across all modified files
- [x] T022 Run `npm run lint` in `vsix/` and fix any ESLint errors in modified files
- [x] T023 Run `npm run build` in `webview/` and fix any TypeScript errors in `App.tsx` and `messages.ts`
- [x] T024 Run `npm run test:unit` in `vsix/` and verify existing tests still pass
- [x] T025 Verify no remaining `mock-data` imports in `webview/src/App.tsx` (search for `from './mock-data'`)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately. T001, T002, T003 are all parallel.
- **Foundational (Phase 2)**: Depends on Phase 1 (FilterState type and mapper needed). T004–T007 are sequential (same file). T008 and T009 are parallel with each other, parallel with T004–T007.
- **US1 (Phase 3)**: Depends on Phase 2 (FindingsService must exist, message types must be updated).
- **US2 (Phase 4)**: Depends on Phase 2 (FindingsService with filter support) and Phase 3 (findingsPanelManager must have FindingsService wired).
- **US3 (Phase 5)**: Depends on Phase 2 (stateUpdate message type updated). Can run in parallel with US1 since it modifies webview/ while US1 modifies vsix/.
- **Polish (Phase 6)**: Depends on all previous phases.

### User Story Dependencies

- **US1 (P1)**: Foundational → US1. Core service wiring pipeline.
- **US2 (P2)**: US1 → US2. Needs FindingsService wired to findingsPanelManager.
- **US3 (P3)**: Foundational → US3. WebView changes are independent of vsix provider changes but need the updated message types.

### Within Each User Story

- Service creation before provider wiring
- Provider wiring before extension.ts changes
- Extension host changes before WebView changes (for same message types)

### Parallel Opportunities

- Phase 1: T001, T002, T003 are all parallel (different files)
- Phase 2: T008 and T009 are parallel with T004–T007 (different files)
- After Phase 2: US1 (vsix/) and US3 (webview/) can proceed in parallel
- US2 is a single task phase — quick to complete after US1

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (types + mapper)
2. Complete Phase 2: Foundational (FindingsService + message types)
3. Complete Phase 3: User Story 1 (provider wiring with real queries)
4. **STOP and VALIDATE**: Run extension, verify real findings appear, disposition summary is accurate
5. Core product value delivered: real data replaces mock data in extension host

### Incremental Delivery

1. Setup + Foundational → FindingsService ready, message types updated
2. US1 → Real findings and summaries in providers → **MVP!**
3. US2 → Filter support (single task, reuses FindingsService)
4. US3 → WebView mock removal, real scan targets on dashboard
5. Polish → All checks pass

---

## Notes

- [P] tasks = different files or independent changes, no dependencies
- [Story] label maps each task to its user story for traceability
- US2 is a single-task phase — it adds the `applyFilters` handler to the already-wired findingsPanelManager
- US3 is a webview-only phase (App.tsx changes) and can run in parallel with US1 (vsix changes)
- The `mock-data.ts` file is NOT deleted — it remains for Kitchen Sink demos. Only the import in App.tsx is removed
- T004–T007 are listed sequentially because they modify the same file (`findings.ts`), but each adds an independent method
- No test tasks included since tests were not explicitly requested in the specification
