# Tasks: Unified Current Findings View

**Input**: Design documents from `specs/015-current-findings-view/`
**Prerequisites**: plan.md (required), spec.md (required), research.md, data-model.md, contracts/message-protocol.md

**Tests**: Not explicitly requested in the feature specification. Test tasks omitted.

**Organization**: Tasks grouped by user story to enable independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- **Extension host**: `vsix/src/` (TypeScript, Node.js)
- **WebView**: `webview/src/` (React 19, Vite 8, Tailwind v4)
- Types are manually mirrored between `vsix/src/models/` and `webview/src/types/`

---

## Phase 1: Foundational (Types, Messages, Mapper)

**Purpose**: Shared type contracts and mapper logic that ALL user stories depend on. No behavioral changes — just the type foundation.

**Why blocking**: Every user story reads/writes `FindingRow` with the new fields, uses the new message types, or calls the extended mapper. These must exist first.

- [X] T001 Add `isCurrentlySuppressed: boolean` and `suppressionSource: 'ash_yaml' | null` fields to FindingRow interface, add `SuppressionSummary` interface (`total`, `suppressed`, `active`), and add `AshYamlConfigSummary` interface in vsix/src/models/types.ts
- [X] T002 [P] Mirror FindingRow field additions, SuppressionSummary, and AshYamlConfigSummary type changes in webview/src/types/types.ts
- [X] T003 [P] Add `currentFindingsUpdate` variant (payload: findings, suppressionSummary, scanId, lastScannedAt) and `ashYamlChanged` variant (payload: config AshYamlConfigSummary) to ExtToWebviewMessage, add `requestCurrentFindings` variant to WebviewToExtMessage in vsix/src/models/messages.ts
- [X] T004 [P] Mirror all message protocol changes (currentFindingsUpdate, ashYamlChanged, requestCurrentFindings) in webview/src/types/messages.ts
- [X] T005 Extend `mapFindingToRow` signature to accept optional `AshSuppression` parameter — when provided, populate `isCurrentlySuppressed: true`, `suppressionSource: 'ash_yaml'`, and `suppression` SuppressionData fields; when absent, set defaults (`false`, `null`, `null`). Add `generateYamlEntry(s: AshSuppression): string` helper that produces a YAML representation of the matched suppression rule in vsix/src/models/mappers.ts

**Checkpoint**: `npm run compile` passes in vsix/ with new types. `npm run build` passes in webview/. No behavioral change yet.

---

## Phase 2: User Story 1 — View Current Active Findings (Priority: P1) — MVP

**Goal**: Users open ASH Workbench and immediately see current active findings (latest scan minus .ash.yaml suppressions) without selecting a scan.

**Independent Test**: Run a scan, add suppression rules to .ash.yaml, reopen sidebar/panel — dashboard shows active/suppressed counts, findings list shows only active findings by default.

### Implementation for User Story 1

- [X] T006 [US1] Add `getCurrentFindings(scanRootService: ScanRootService, ashYamlService: AshYamlService)` method to FindingsService — query latest COMPLETED scan for effective scan root via `db.scan.findFirst()`, fetch all findings for that scan, call `ashYamlService.getMatchingSuppressions()` for batch matching, map each finding via `mapFindingToRow(finding, suppressionMap.get(finding.id))`, compute and return `{ findings: FindingRow[], summary: SuppressionSummary } | null` in vsix/src/services/findings.ts
- [X] T007 [US1] Add `postCurrentFindingsUpdate()` method to FindingsPanelManager that calls `findingsService.getCurrentFindings()` and posts `currentFindingsUpdate` message to the webview panel. Add `refreshCurrentFindings()` public method that calls `postCurrentFindingsUpdate()` (entry point for external triggers). Modify `requestState` handler to call `postCurrentFindingsUpdate()` after posting `stateUpdate` so the panel receives current findings on initial load. Handle `requestCurrentFindings` inbound message in vsix/src/providers/findingsPanelManager.ts
- [X] T008 [US1] Add `setFindingsService()` and `setAshYamlService()` setter methods to SidebarWebviewProvider. Modify `queryStateAndPost()` to also call `findingsService.getCurrentFindings()` and post a `currentFindingsUpdate` message to the sidebar webview with the suppression summary in vsix/src/providers/sidebarWebviewProvider.ts
- [X] T009 [US1] Wire FindingsService and AshYamlService to SidebarWebviewProvider and FindingsPanelManager via their setter methods during service initialization in vsix/src/extension.ts
- [X] T010 [US1] Add `currentFindings: FindingRow[]`, `suppressionSummary: SuppressionSummary` (default `{ total: 0, suppressed: 0, active: 0 }`), `showSuppressed: boolean` (default `false`), `lastScannedAt: string | undefined` to AppState. Add reducer case for `currentFindingsUpdate` message that sets `currentFindings`, `suppressionSummary`, `scanId`, and `lastScannedAt` from payload in webview/src/App.tsx
- [X] T011 [P] [US1] Update DashboardView to show "X active findings" prominently (from `suppressionSummary.active`), "Y suppressed" as secondary info, severity breakdown computed from active findings only (filter `currentFindings` where `isCurrentlySuppressed === false`), and "Last scanned: [timestamp]" from `lastScannedAt`. When no current findings exist, show existing empty state in webview/src/components/DashboardView.tsx
- [X] T012 [P] [US1] Update SidebarDashboard to show active findings count, suppressed count, and severity breakdown from active findings only. Replace current triage progress computation to use active findings as denominator in webview/src/components/SidebarDashboard.tsx
- [X] T013 [P] [US1] Update TriageProgressBar to accept active findings count as denominator — when all findings are suppressed (active = 0), hide the progress bar or show "All findings suppressed" in webview/src/components/TriageProgressBar.tsx
- [X] T014 [US1] Add "Currently suppressed" indicator to FindingDetailView when `finding.isCurrentlySuppressed === true` — show suppression badge, justification from `finding.suppression.justification`, and expiration from `finding.suppression.expiresAt` if present. Show both suppression status and disposition independently in webview/src/components/FindingDetailView.tsx

**Checkpoint**: Open sidebar → active findings count shown. Open panel → current findings displayed. Suppressed findings hidden by default. Dashboard shows active-only severity breakdown and triage progress.

---

## Phase 3: User Story 2 — Toggle Suppressed Findings Visibility (Priority: P1)

**Goal**: Users can toggle a "Show suppressed" switch to reveal hidden suppressed findings with visual differentiation.

**Independent Test**: Toggle "Show suppressed" on → suppressed findings appear with muted styling/badge. Toggle off → they disappear. Navigate away and return → toggle resets to off.

### Implementation for User Story 2

- [X] T015 [US2] Add `TOGGLE_SHOW_SUPPRESSED` to AppAction union type. Add reducer case that flips `showSuppressed` boolean. Ensure `showSuppressed` resets to `false` on `NAVIGATE` and panel re-initialization in webview/src/App.tsx
- [X] T016 [US2] Add ShadCN Switch component as "Show suppressed" toggle to FindingsView toolbar (after existing filter controls). When `showSuppressed` is false, filter the findings data to exclude rows where `isCurrentlySuppressed === true` before passing to the table. When `showSuppressed` is true, show all findings — suppressed rows get a muted/opacity-reduced row style and a "Suppressed" badge in the disposition column using the suppression color from theme-colors.ts in webview/src/components/FindingsView.tsx

**Checkpoint**: Toggle on → all findings visible, suppressed ones have muted style + badge. Toggle off → suppressed hidden. Navigate away → toggle resets.

---

## Phase 4: User Story 3 — Suppression Overlay on Historical Scans (Priority: P2)

**Goal**: When viewing a historical scan, findings that match current .ash.yaml rules show a "Currently suppressed" indicator.

**Independent Test**: Navigate to a past scan → findings matching current .ash.yaml show "Currently suppressed" chip alongside finding data.

### Implementation for User Story 3

- [X] T017 [US3] Add `getFindingsWithSuppressionOverlay(scanId: string, ashYamlService: AshYamlService, filters?: FilterState)` method to FindingsService — fetch findings for the given scan, map to FindingRow[], call `ashYamlService.getMatchingSuppressions()`, then for each matched finding set `isCurrentlySuppressed: true`, `suppressionSource: 'ash_yaml'`, and populate `suppression` field. Return enriched FindingRow[] in vsix/src/services/findings.ts
- [X] T018 [US3] Modify `selectScan` and `applyFilters` handlers in FindingsPanelManager to use `getFindingsWithSuppressionOverlay()` instead of plain `getFindings()` when loading findings for any scan, so all scan views include current suppression overlay data in vsix/src/providers/findingsPanelManager.ts

**Checkpoint**: Navigate to historical scan → findings show "Currently suppressed" badge on matches. Non-matching findings show no badge.

---

## Phase 5: User Story 4 — Live Reactivity to .ash.yaml Changes (Priority: P2)

**Goal**: Dashboard and findings view update automatically when .ash.yaml file changes.

**Independent Test**: Open findings panel, edit .ash.yaml to add a new suppression rule, save → the matched finding disappears from active list (or shows suppressed indicator), dashboard counts update.

### Implementation for User Story 4

- [X] T019 [US4] Extend the existing `ashYamlService.onDidChangeConfig` handler in extension.ts to call `findingsPanelManager.refreshCurrentFindings()` and `sidebarProvider.queryStateAndPost()`. Post `ashYamlChanged` message with `AshYamlConfigSummary` (suppressionCount, ignorePathCount, severityThreshold, projectName, enabledScanners) to both panel and sidebar webviews in vsix/src/extension.ts
- [X] T020 [US4] Add logic to `refreshCurrentFindings()` in FindingsPanelManager to also re-send suppression-enriched findings via `findingsUpdate` if the user is currently viewing a historical scan (check `currentScanId` against the latest completed scan ID) in vsix/src/providers/findingsPanelManager.ts
- [X] T021 [US4] Add `ashYamlChanged` reducer case in webview App.tsx — store config summary for potential display use (informational, no view navigation side-effects) in webview/src/App.tsx

**Checkpoint**: Edit .ash.yaml while panel/sidebar open → counts and findings update within 3 seconds. Historical scan view also re-overlays.

---

## Phase 6: User Story 5 — Suppress Button Disabled (Priority: P3)

**Goal**: SUPPRESS disposition button is disabled with explanatory tooltip until .ash.yaml write feature is delivered.

**Independent Test**: View any finding's triage controls → SUPPRESS button is visually disabled, hovering shows tooltip. FIX/DEFER/PENDING continue to work.

### Implementation for User Story 5

- [X] T022 [US5] Disable the SUPPRESS button in TriageControls by adding `disabled` prop when `d === 'SUPPRESS'`, change to muted/grayed styling, and wrap with a Tooltip component (ShadCN TooltipProvider + Tooltip + TooltipTrigger + TooltipContent) showing "Suppression is managed via .ash.yaml". Ensure FIX, DEFER, PENDING buttons remain fully functional in webview/src/components/TriageControls.tsx

**Checkpoint**: SUPPRESS button disabled with tooltip. Other buttons work normally. Finding can be both suppressed and have FIX disposition.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Verify everything compiles, integrates, and passes end-to-end.

- [X] T023 Verify TypeScript strict mode compilation passes in both packages: `cd vsix && npm run compile` and `cd webview && npm run build` with zero errors
- [X] T024 Run quickstart.md verification checklist end-to-end: (1) sidebar shows active findings count, (2) findings panel hides suppressed by default, (3) toggle reveals suppressed with badge, (4) .ash.yaml edit triggers auto-update, (5) historical scan shows "Currently suppressed" badges, (6) Suppress button disabled with tooltip, (7) Fix/Defer on suppressed finding shows both states

---

## Dependencies & Execution Order

### Phase Dependencies

- **Foundational (Phase 1)**: No dependencies — start immediately
- **US1 (Phase 2)**: Depends on Phase 1 completion — BLOCKS downstream stories
- **US2 (Phase 3)**: Depends on Phase 2 (needs `currentFindings` and `showSuppressed` in AppState)
- **US3 (Phase 4)**: Depends on Phase 1 (needs extended mapper and type fields). Can run in parallel with US1.
- **US4 (Phase 5)**: Depends on Phase 2 (needs `refreshCurrentFindings()` method from US1)
- **US5 (Phase 6)**: Depends on Phase 1 only. Can run in parallel with US1.
- **Polish (Phase 7)**: Depends on all phases complete

### User Story Dependencies

- **US1 (P1)**: Depends on Foundational (Phase 1). Core MVP — delivers the primary experience.
- **US2 (P1)**: Depends on US1 (needs currentFindings state and FindingsView showing current findings).
- **US3 (P2)**: Depends on Foundational only. Can start in parallel with US1 (different service method, different provider code paths).
- **US4 (P2)**: Depends on US1 (needs refreshCurrentFindings() and postCurrentFindingsUpdate()). Can start in parallel with US2.
- **US5 (P3)**: Depends on Foundational only. Can start in parallel with US1 (different component, no shared code paths).

### Within Each User Story

- Service methods before provider wiring
- Provider wiring before webview state
- Webview state before UI components
- Extension.ts wiring last (coordinates providers)

### Parallel Opportunities

**Phase 1**: T002, T003, T004 can all run in parallel (after T001 completes — they depend on vsix types)

**Phase 2 (US1)**: T011, T012, T013 can run in parallel (different webview components, no shared code)

**Cross-story parallelism**:
- US3 (T017-T018) and US1 (T006-T014) can run in parallel after Phase 1
- US5 (T022) can run in parallel with US1 after Phase 1
- US2 (T015-T016) and US4 (T019-T021) can run in parallel after US1

---

## Parallel Example: Phase 1 (Foundational)

```
# T001 must complete first (vsix types are the source of truth)
Task: T001 "Add FindingRow fields + new types in vsix/src/models/types.ts"

# Then these three can run in parallel (different files):
Task: T002 "Mirror type changes in webview/src/types/types.ts"
Task: T003 "Add message variants in vsix/src/models/messages.ts"
Task: T004 "Mirror messages in webview/src/types/messages.ts"

# T005 depends on T001 (imports AshSuppression type):
Task: T005 "Extend mapper in vsix/src/models/mappers.ts"
```

## Parallel Example: US1 UI Components

```
# After T010 (AppState changes), these three can run in parallel:
Task: T011 "Update DashboardView in webview/src/components/DashboardView.tsx"
Task: T012 "Update SidebarDashboard in webview/src/components/SidebarDashboard.tsx"
Task: T013 "Update TriageProgressBar in webview/src/components/TriageProgressBar.tsx"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Foundational types + messages + mapper
2. Complete Phase 2: User Story 1 (current findings computation + dashboard + sidebar)
3. **STOP and VALIDATE**: Open sidebar → see active findings. Open panel → see current findings list. Verify suppressed findings are hidden.
4. This alone delivers the core value: "show me what matters right now"

### Incremental Delivery

1. Phase 1 (Foundational) → types compile ✓
2. Phase 2 (US1) → core experience works ✓ (MVP!)
3. Phase 3 (US2) → toggle adds auditability ✓
4. Phase 4 (US3) → historical overlay adds context ✓
5. Phase 5 (US4) → live reactivity adds tight feedback loop ✓
6. Phase 6 (US5) → suppress button disabled for clarity ✓
7. Phase 7 (Polish) → end-to-end validation ✓

Each phase adds value without breaking previous phases.

---

## Notes

- [P] tasks = different files, no dependencies on incomplete tasks
- [Story] label maps task to specific user story for traceability
- All paths relative to `workbench/` monorepo root
- Types must be mirrored manually between vsix/ and webview/ (per constitution)
- No database schema migrations needed — all changes are TypeScript view-layer types
- Commit after each phase completion for clean rollback points
