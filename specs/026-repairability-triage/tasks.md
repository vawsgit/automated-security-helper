# Tasks: Repairability Triage Analysis

**Input**: Design documents from `/specs/026-repairability-triage/`
**Prerequisites**: plan.md (required), spec.md (required), research.md, data-model.md, contracts/

**Tests**: Not explicitly requested in the feature specification. Test tasks are omitted.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3, US4)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Schema migration, shared type definitions, and design tokens

- [x] T001 Add `triageAnalysis Json?` field to Finding model in `vsix/prisma/schema.prisma` (after existing `aiAnalysis Json?` field). Create migration file at `vsix/prisma/migrations/XXX_add_triage_analysis/migration.sql` with SQL: `ALTER TABLE "Finding" ADD COLUMN "triageAnalysis" TEXT;`. Follow the naming pattern of existing migrations in that directory for the XXX prefix.

- [x] T002 [P] Create triage type definitions in `vsix/src/models/triageTypes.ts`. Define and export: `TriageCategory` ('suppress' | 'easy_fix' | 'systemic'), `TriageClassificationBase`, `TriageSuppressClassification`, `TriageEasyFixClassification`, `TriageSystemicClassification`, `TriageClassification` (discriminated union), `RepairGuidance`, `TriageMetadata`, `StoredTriageAnalysis` (analysis + metadata + fingerprint), `TriageSummary`, `TriageSeverityBreakdown`. Use exact type shapes from `data-model.md` Type Definitions section. Named exports only.

- [x] T003 [P] Add `repairabilityColor` map to `webview/src/lib/theme-colors.ts`. Follow the existing `severityColor` and `dispositionColor` patterns. Three entries: `suppress` (purple: `bg-purple-500/15 text-purple-700 dark:text-purple-400`), `easy_fix` (green: `bg-green-500/15 text-green-700 dark:text-green-400`), `systemic` (amber: `bg-amber-500/15 text-amber-700 dark:text-amber-400`). Each entry needs `base`, `hover`, and `fill` keys matching the `severityColor` pattern. Export as `repairabilityColor: Record<TriageCategory, { base: string; hover: string; fill: string }>`.

- [x] T004 [P] Extend WebView types in `webview/src/types/types.ts`. Mirror all triage type definitions from T002 (TriageCategory, TriageClassification discriminated union, RepairGuidance, TriageMetadata, TriageSummary, TriageSeverityBreakdown). Extend the existing `FindingRow` interface with four new fields: `triageAnalysis: TriageClassification | null`, `triageMetadata: TriageMetadata | null`, `triageFingerprint: string | null`, `isTriageStale: boolean`. Keep existing fields unchanged.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**CRITICAL**: No user story work can begin until this phase is complete

- [ ] T005 [P] Add triage message types to `vsix/src/models/messages.ts`. Add 10 new variants to the `ExtToWebviewMessage` union: `triageSummaryUpdate`, `triageClassificationStarted`, `triageClassificationProgress`, `triageClassificationResult`, `triageClassificationError`, `triageClassificationComplete`, `triageFixApplied`, `triageFixError`, `triageSuppressed`, `triageSuppressionError`. Add 7 new variants to the `WebviewToExtMessage` union: `requestTriageSummary`, `startTriageClassification`, `retryTriageClassification`, `cancelTriageClassification`, `applyTriageFix`, `applyTriageSuppression`, `requestRepairGuidance`. Use exact payload shapes from `contracts/ext-to-webview.md` and `contracts/webview-to-ext.md`. Import triage types from `./triageTypes.js`.

- [ ] T006 [P] Mirror triage message types in `webview/src/types/messages.ts`. Add the same 10 ExtToWebview and 7 WebviewToExt message variants as T005, using the WebView-side type imports from `./types`. Keep both files exactly in sync.

- [ ] T007 [P] Extend finding mapper in `vsix/src/models/mappers.ts`. Add `parseStoredTriageAnalysis(json: unknown): StoredTriageAnalysis | null` function following the existing `parseStoredAiAnalysis()` pattern (null-safe, validates required fields). Add `computeTriageFingerprint(finding)` function that SHA-256 hashes `ruleId|file|snippet|severity|description` using Node.js `crypto`. Extend `mapFindingToRow()` to include `triageAnalysis`, `triageMetadata`, `triageFingerprint`, and computed `isTriageStale` (compare current fingerprint vs stored). Import triage types from `./triageTypes.js`.

- [ ] T008 [P] Create triage prompt builder in `vsix/src/services/triagePromptBuilder.ts`. Export pure functions: `buildTriagePrompt(finding: { ruleId, severity, file, startLine, endLine, snippet, title, description, scanner, notes })` returns `{ systemPrompt: string, outputSchema: object }`. The system prompt instructs the AI to classify the finding into one of three categories (suppress/easy_fix/systemic) and generate category-specific action data. Include classification criteria from spec: suppress = false positive or acceptable risk; easy_fix = non-risky single-file change; systemic = complex multi-file or high-risk fix. The output schema is a JSON schema matching `TriageClassification` discriminated union. Also export `parseTriageResponse(raw: unknown): TriageClassification | null` for safe parsing of AI output. Follow `suppressionPromptBuilder.ts` patterns.

- [ ] T009 Create TriageService class in `vsix/src/services/triageService.ts`. Constructor takes: `findingsService: FindingsService`, `aiService: AiService`, `ashYamlWriteService: AshYamlWriteService`, `workspaceRoot: string`. Implement core classification methods: (1) `classifyFinding(findingId: string, onEvent: callback)` — loads finding, checks cache via fingerprint, calls AI provider with triage prompt, stores `StoredTriageAnalysis` in finding.triageAnalysis via Prisma update, emits progress/result/error events. (2) `classifyBatch(onEvent: callback)` — queries all HIGH severity non-suppressed findings, filters to unanalyzed or stale, processes sequentially with consecutive failure detection (limit from AiService config), emits batch progress events matching contracts. (3) `getTriageSummary(): Promise<TriageSummary>` — queries latest cumulative findings, groups by severity × triage category, computes TriageSeverityBreakdown for each severity. Follow the `AiService.analyzeFinding()` and `startBatchAnalysis()` patterns for event handling and provider access.

- [ ] T010 Add triage message handlers to `vsix/src/providers/findingsPanelManager.ts`. Add `setTriageService(service: TriageService): void` setter method. Add cases to `handleMessage()` switch for: `requestTriageSummary` (call triageService.getTriageSummary(), post triageSummaryUpdate), `startTriageClassification` (call triageService.classifyBatch(), stream progress events to WebView, post updated triageSummaryUpdate on completion), `retryTriageClassification` (call triageService.classifyFinding() for single finding), `cancelTriageClassification` (abort batch via AbortController pattern). Add `showTriageDashboard()` method that calls ensurePanel(), posts init with context: 'editorPanel', and triggers requestTriageSummary.

- [ ] T011 Wire TriageService in `vsix/src/extension.ts`. In the `activate()` function: instantiate `TriageService` with FindingsService, AiService, AshYamlWriteService, and workspace root path. Call `findingsPanelManager.setTriageService(triageService)`. Follow the existing pattern for service instantiation and injection (see how AiService and AshYamlWriteService are wired).

- [ ] T012 Add triage view states and reducer cases to `webview/src/App.tsx`. (1) Add `'triageDashboard' | 'triageDrillDown'` to `ViewState` union. (2) Add state fields to `AppState`: `triageSummary: TriageSummary | null`, `triageClassificationState: TriageBatchState | null` (running/completed status, progress counts), `triageDrillDownFilter: { severity: Severity; category: TriageCategory } | null`, `triageSelectedFindingId: string | null`. (3) Add reducer cases for all 10 ExtToWebview triage message types: `triageSummaryUpdate` → set triageSummary; `triageClassificationStarted/Progress/Complete` → update triageClassificationState; `triageClassificationResult` → update finding's triageAnalysis in findings array; `triageClassificationError` → mark finding as error in analysisStates; `triageSuppressed` → update disposition to SUPPRESS; `triageFixApplied` → update disposition to FIX; error variants → store error for display. (4) Add NAVIGATE cases for 'triageDashboard' and 'triageDrillDown'. (5) Add rendering: `view === 'triageDashboard'` → `<TriageDashboardView>`, `view === 'triageDrillDown'` → `<TriageDrillDownView>`. Wire postMessage calls for all 7 WebviewToExt triage messages.

**Checkpoint**: Foundation ready — user story implementation can now begin

---

## Phase 3: User Story 1 — Triage Dashboard with AI-Driven Classification (Priority: P1) MVP

**Goal**: Users see a dashboard with KPI charts showing findings organized by severity and repairability category, can drill down to filtered lists, and see classification progress as AI analyzes HIGH severity findings.

**Independent Test**: Open triage dashboard → charts display with correct counts → click a severity × category cell → drill-down shows filtered findings with addressed/unaddressed distinction → batch classification runs and updates dashboard in real-time.

### Implementation for User Story 1

- [ ] T013 [P] [US1] Create TriageChart component in `webview/src/components/TriageChart.tsx`. CSS-based horizontal bar chart (no external library). Props: `counts: Record<TriageCategory, number>`, `onCategoryClick?: (category: TriageCategory) => void`, `severity?: Severity`. Renders a horizontal bar for each category using `repairabilityColor[category].fill` for fill color and percentage-width `<div>` elements. Display count and percentage labels. Follow the `SeverityChart.tsx` pattern. Clickable bars when `onCategoryClick` provided (use `cursor-pointer` + hover effect). Support an `unanalyzed` segment (gray) for findings not yet classified.

- [ ] T014 [US1] Create TriageDashboardView component in `webview/src/components/TriageDashboardView.tsx`. Props: `triageSummary: TriageSummary | null`, `classificationState: TriageBatchState | null`, `claudeSettingsDetected: boolean`, `onDrillDown: (severity: Severity, category: TriageCategory) => void`, `onStartClassification: () => void`, `onCancelClassification: () => void`, `onNavigateDashboard: () => void`. Layout: (1) AppBreadcrumb with segments [Dashboard, Triage]. (2) Header with title "Repairability Triage" and classification progress indicator when running. (3) For HIGH severity: full TriageChart with clickable bars. (4) For other severities: row showing total count with "Analysis scoped to HIGH" note (FR-018). (5) Severity × category matrix as a grid of clickable Card components — each cell shows count, colored by `repairabilityColor`. (6) Empty state when no findings or no scans. (7) No-AI-provider state with configuration guidance (FR-020). (8) Classification progress bar during batch analysis. Use ShadCN Card, Badge, Button (variant="outline") components.

- [ ] T015 [US1] Create TriageDrillDownView component in `webview/src/components/TriageDrillDownView.tsx`. Props: `findings: FindingRow[]`, `severity: Severity`, `category: TriageCategory`, `onSelectFinding: (findingId: string) => void`, `onBack: () => void`, `onNavigateDashboard: () => void`. Layout: (1) AppBreadcrumb with segments [Dashboard, Triage, "{severity} / {category}"]. (2) Header showing filtered context: severity badge + category badge + count. (3) Progress indicator: "X of Y addressed" with stacked progress bar (addressed in green/gray, unaddressed remaining). (4) Scrollable list of findings as Card rows: title, file path, scanner, and addressed badge (if disposition is SUPPRESS or FIX). Addressed findings use reduced opacity (`opacity-60`) or strikethrough styling. (5) Click on finding → `onSelectFinding(id)`. Use `@tanstack/react-table` only if needed; a simpler Card list may suffice for the drill-down.

- [ ] T016 [US1] Create TriageFindingPanel component skeleton in `webview/src/components/TriageFindingPanel.tsx`. Props: `finding: FindingRow`, `onBack: () => void`, `onNavigateDashboard: () => void`, `onNavigateTriageDashboard: () => void`. For now, render: (1) AppBreadcrumb with segments [Dashboard, Triage, "{severity}/{category}", finding.title]. (2) Finding header: title, severity badge, category badge (`repairabilityColor`), file path + line, scanner. (3) Explanation section: `finding.triageAnalysis.explanation` rendered as text. (4) Risk section: `finding.triageAnalysis.risk` rendered as text. (5) Category-specific section placeholder: display category name and "Action available" text — actual action buttons added in US2/US3/US4 phases. (6) Staleness warning if `finding.isTriageStale` — show Alert with "Finding has changed since classification. Re-analysis recommended." Handle null `triageAnalysis` gracefully.

- [ ] T017 [US1] Add "Triage" button to `webview/src/components/SidebarDashboard.tsx`. Add a Button (variant="outline") with a BarChart3 icon (from lucide-react) labeled "Repairability Triage" in the action buttons section (near "View Dashboard" and "Scan Workspace" buttons). onClick: `postMessage({ type: 'openTriageDashboard' })`. Conditionally show badge with count of HIGH severity unanalyzed findings if `triageSummary` is available.

- [ ] T018 [US1] Wire triage navigation end-to-end. In `vsix/src/providers/findingsPanelManager.ts`: add `openTriageDashboard` case to handleMessage that calls `showTriageDashboard()`. In `webview/src/App.tsx`: (1) Add `openTriageDashboard` to WebviewToExtMessage if not already present. (2) Wire navigation callbacks: clicking a matrix cell dispatches `{ type: 'NAVIGATE', view: 'triageDrillDown' }` with filter state; clicking a finding in drill-down dispatches navigation to `TriageFindingPanel`; back buttons pop view history. (3) On triage dashboard mount: `postMessage({ type: 'requestTriageSummary' })` + auto-trigger `postMessage({ type: 'startTriageClassification' })` if unanalyzed HIGH findings exist. (4) Wire TriageDashboardView, TriageDrillDownView, and TriageFindingPanel into the view switch with appropriate props from state.

**Checkpoint**: User Story 1 complete — triage dashboard shows charts, drill-down works, classification runs. Delivers MVP value.

---

## Phase 4: User Story 2 — One-Click Suppress (Priority: P2)

**Goal**: Users can suppress findings classified as "should suppress" with a single click, with the suppression written immediately and the interface updated.

**Independent Test**: Open triage dashboard → drill down to "HIGH / Suppress" → select finding → see suppression rationale → click "Suppress" → suppression written to .ash.yaml → finding marked as addressed → dashboard counts update.

### Implementation for User Story 2

- [ ] T019 [US2] Implement `applyTriageSuppression(findingId: string)` method in `vsix/src/services/triageService.ts`. Load finding by ID. Parse triageAnalysis — verify category is 'suppress'. Extract `suggestedJustification` and `suggestedScope` from `TriageSuppressClassification`. Build a `SuppressionInput` object: `{ findingId, filePath: finding.file, ruleId: finding.ruleId, scope: analysis.suggestedScope, justification: analysis.suggestedJustification, includeLineRange: false, startLine: finding.startLine, endLine: finding.endLine, expiration: null }`. Call `ashYamlWriteService.addSuppression(input)`. On success: call `findingsService.setDisposition(findingId, 'SUPPRESS')`. Return success/error result. Handle errors: finding not found, wrong category, write failure.

- [ ] T020 [US2] Add `applyTriageSuppression` handler to `vsix/src/providers/findingsPanelManager.ts`. On `applyTriageSuppression` message: call `triageService.applyTriageSuppression(payload.findingId)`. On success: post `triageSuppressed` message with findingId and disposition 'SUPPRESS', then compute and post updated `triageSummaryUpdate`. On error: post `triageSuppressionError` with findingId, errorType, and message.

- [ ] T021 [US2] Add suppress action UI to TriageFindingPanel in `webview/src/components/TriageFindingPanel.tsx`. When `finding.triageAnalysis.category === 'suppress'`: (1) Add "Why Suppress" section showing `suppressionRationale`. (2) Add "Suggested Scope" showing `suggestedScope` as a readable label (file_rule → "This file + this rule", rule_everywhere → "This rule everywhere", file_all_rules → "All rules in this file"). (3) Add "Suppress" Button (variant="outline", className with `repairabilityColor.suppress.base`). onClick: `postMessage({ type: 'applyTriageSuppression', payload: { findingId: finding.id } })`. (4) Add loading state (button disabled + spinner during suppression). (5) Add success state: show "Suppressed" badge after `triageSuppressed` received. (6) Add error state: Alert with error message + dismiss button.

- [ ] T022 [US2] Add suppress-specific reducer updates to `webview/src/App.tsx`. On `triageSuppressed`: update the finding's disposition to 'SUPPRESS' in `state.findings` array and `state.currentFindings` array (find by findingId, set disposition). Clear any pending suppression state. On `triageSuppressionError`: store error for display in TriageFindingPanel (add to a `triageActionErrors: Record<string, string>` state field).

**Checkpoint**: User Stories 1 AND 2 complete — dashboard + one-click suppress working independently

---

## Phase 5: User Story 3 — One-Click Fix (Priority: P3)

**Goal**: Users can apply code fixes for "easy fix" findings with a single click, with the fix written to the source file and the interface updated.

**Independent Test**: Open triage dashboard → drill down to "HIGH / Easy Fix" → select finding → see before/after code → click "Apply Fix" → code change written to file → "Fix applied, status will be updated next scan" message → finding marked as addressed.

### Implementation for User Story 3

- [ ] T023 [US3] Implement `applyTriageFix(findingId: string)` method in `vsix/src/services/triageService.ts`. Load finding by ID. Parse triageAnalysis — verify category is 'easy_fix'. Extract `codeBefore`, `codeAfter`, `filePath`, `startLine`, `endLine` from `TriageEasyFixClassification`. (1) Validate filePath: resolve against workspace root, ensure it's within workspace (prevent directory traversal). (2) Read file via `vscode.workspace.fs.readFile(fileUri)`. (3) Split content into lines, extract lines at `startLine` through `endLine` (1-indexed). (4) Compare extracted lines (trimmed) against `codeBefore` (trimmed). If mismatch: return error with type 'stale_code' and message recommending re-analysis. (5) Replace matched lines with `codeAfter`. (6) Write file via `vscode.workspace.fs.writeFile(fileUri, modifiedContent)`. (7) Call `findingsService.setDisposition(findingId, 'FIX')`. Return success with filePath. Handle errors: file not found ('file_not_found'), write failure ('write_error'), path validation failure ('path_validation').

- [ ] T024 [US3] Add `applyTriageFix` handler to `vsix/src/providers/findingsPanelManager.ts`. On `applyTriageFix` message: call `triageService.applyTriageFix(payload.findingId)`. On success: post `triageFixApplied` with findingId, filePath, disposition 'FIX', then compute and post updated `triageSummaryUpdate`. On error: post `triageFixError` with findingId, errorType, and message.

- [ ] T025 [US3] Add easy fix action UI to TriageFindingPanel in `webview/src/components/TriageFindingPanel.tsx`. When `finding.triageAnalysis.category === 'easy_fix'`: (1) Add "How to Fix" section showing `fixDescription`. (2) Add "Code Change" section with two CodeBlock components side-by-side or stacked: "Before" showing `codeBefore` with startLine, "After" showing `codeAfter`. (3) Add file path + line range indicator. (4) Add "Apply Fix" Button (variant="outline", className with `repairabilityColor.easy_fix.base`). onClick: `postMessage({ type: 'applyTriageFix', payload: { findingId: finding.id } })`. (5) Add loading state (button disabled + spinner). (6) Add success state: show "Fix applied, status will be updated next scan" message with CheckCircle icon. (7) Add stale_code error state: Alert warning "Source file has changed since analysis. Re-analysis recommended." with re-analyze suggestion. (8) Add general error state: Alert with error message. (9) If `finding.isTriageStale`: show warning before the fix button that the analysis may be outdated.

- [ ] T026 [US3] Add fix-specific reducer updates to `webview/src/App.tsx`. On `triageFixApplied`: update the finding's disposition to 'FIX' in state.findings and state.currentFindings arrays (find by findingId, set disposition). Store a success message for display. On `triageFixError`: store error details in `triageActionErrors[findingId]` for display in TriageFindingPanel.

**Checkpoint**: User Stories 1, 2, AND 3 complete — dashboard + suppress + fix all working independently

---

## Phase 6: User Story 4 — Comprehensive Repair Guidance (Priority: P4)

**Goal**: Users can view comprehensive repair guidance for "systemic" findings and copy it to clipboard for use in an external coding agent.

**Independent Test**: Open triage dashboard → drill down to "HIGH / Systemic" → select finding → see why it's hard to fix → see comprehensive guidance (affected areas, remediation approach, side effects, testing) → click "Copy to Clipboard" → paste into coding agent.

### Implementation for User Story 4

- [ ] T027 [US4] Add systemic guidance UI and clipboard copy to TriageFindingPanel in `webview/src/components/TriageFindingPanel.tsx`. When `finding.triageAnalysis.category === 'systemic'`: (1) Add "Why It's Complex" section showing `complexityRationale`. (2) Add "Repair Guidance" section with 5 subsections from RepairGuidance: "Affected Areas" (bulleted list from `affectedAreas[]`), "Vulnerability Details" (`vulnerabilityNature` as markdown via MarkdownContent), "Remediation Approach" (`remediationApproach` as markdown), "Potential Side Effects" (bulleted list from `sideEffects[]`), "Testing Recommendations" (`testingRecommendations` as markdown). Use Accordion or collapsible Card sections for each. (3) Add "Copy Guidance to Clipboard" Button (variant="outline", className with `repairabilityColor.systemic.base`, Copy icon from lucide-react). onClick: format all guidance sections into a structured text block and call `navigator.clipboard.writeText(formattedGuidance)`. The formatted text should include headers, the finding context (title, rule, file, severity), and all guidance sections — optimized for pasting into a coding agent prompt. (4) Add visual feedback on copy: brief "Copied!" toast or button text change for 2 seconds (use `useState` with `setTimeout`). (5) If `finding.isTriageStale`: show staleness indicator recommending re-analysis, but still display the existing guidance.

**Checkpoint**: All 4 user stories complete

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Kitchen sink demos, edge case hardening, and final integration

- [ ] T028 [P] Create Kitchen Sink demo in `webview/src/pages/sink/demos/triage-dashboard-demo.tsx`. Create mock triage data: a TriageSummary with realistic counts across all severities, and sample findings with each TriageClassification category (suppress, easy_fix, systemic). Render: (1) TriageChart with mock counts. (2) TriageDashboardView with mock summary and no active classification. (3) TriageDrillDownView with mock filtered findings (mix of addressed and unaddressed). (4) TriageFindingPanel for each category type (3 demos). Register in `webview/src/pages/sink/sink-registry.ts` with key `'triage-dashboard'`, name `'Triage Dashboard'`, type `'app'`.

- [ ] T029 Review and harden edge case handling across all triage components. Verify: (1) `TriageDashboardView` shows empty state when no scans run (FR-020 edge case). (2) `TriageDashboardView` shows "No HIGH severity findings" when all HIGH are suppressed. (3) `TriageDashboardView` shows AI configuration guidance when `claudeSettingsDetected` is false. (4) `TriageDrillDownView` handles empty filter results gracefully. (5) `TriageFindingPanel` handles null `triageAnalysis` (unanalyzed finding). (6) Batch classification continues in background on navigate-away. (7) Re-classification replaces old result (reclassified finding edge case). (8) Dashboard counts update after every action without manual refresh (FR-021). Fix any missing edge cases in the relevant component files.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on Setup (Phase 1) completion — BLOCKS all user stories
- **User Story 1 (Phase 3)**: Depends on Foundational (Phase 2) completion
- **User Story 2 (Phase 4)**: Depends on Phase 3 (US1 provides dashboard and drill-down)
- **User Story 3 (Phase 5)**: Depends on Phase 3 (US1 provides dashboard and drill-down)
- **User Story 4 (Phase 6)**: Depends on Phase 3 (US1 provides dashboard and drill-down)
- **Polish (Phase 7)**: Depends on all user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Depends on Foundational only — provides the dashboard, drill-down, and classification infrastructure used by all other stories
- **User Story 2 (P2)**: Depends on US1 (needs drill-down and TriageFindingPanel) — can run in parallel with US3/US4
- **User Story 3 (P3)**: Depends on US1 (needs drill-down and TriageFindingPanel) — can run in parallel with US2/US4
- **User Story 4 (P4)**: Depends on US1 (needs drill-down and TriageFindingPanel) — can run in parallel with US2/US3

### Within Each User Story

- Extension host service methods before panel manager handlers
- Panel manager handlers before WebView UI components
- WebView components before reducer cases (or parallel if in different files)
- Navigation integration last (connects everything)

### Parallel Opportunities

- **Phase 1**: T002, T003, T004 can all run in parallel (different files)
- **Phase 2**: T005, T006, T007, T008 can all run in parallel (different files); T009–T012 are sequential (dependency chain)
- **Phase 3**: T013 (TriageChart) can run in parallel with other US1 tasks
- **Phase 4–6**: US2, US3, and US4 can be developed in parallel by different agents after US1 completes (they modify different sections of the same files but don't conflict if each category's UI section is isolated)

---

## Parallel Example: User Story 1

```bash
# After Phase 2 is complete, launch in parallel:
Task T013: "Create TriageChart component in webview/src/components/TriageChart.tsx"
Task T017: "Add Triage button to webview/src/components/SidebarDashboard.tsx"

# Then sequential:
Task T014: "Create TriageDashboardView" (needs TriageChart from T013)
Task T015: "Create TriageDrillDownView"
Task T016: "Create TriageFindingPanel skeleton"
Task T018: "Wire triage navigation end-to-end"
```

## Parallel Example: User Stories 2, 3, 4

```bash
# After US1 is complete, all three stories can start in parallel:
# Agent A:
Task T019 → T020 → T021 → T022  (Suppress flow)

# Agent B:
Task T023 → T024 → T025 → T026  (Fix flow)

# Agent C:
Task T027  (Systemic guidance)
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (4 tasks)
2. Complete Phase 2: Foundational (8 tasks)
3. Complete Phase 3: User Story 1 (6 tasks)
4. **STOP and VALIDATE**: Test dashboard with classification — delivers visibility value
5. Demo: "Here's the repairability landscape of your findings"

### Incremental Delivery

1. Setup + Foundational → Infrastructure ready (12 tasks)
2. Add User Story 1 → Dashboard + classification → Demo (MVP!)
3. Add User Story 2 → One-click suppress → Demo
4. Add User Story 3 → One-click fix → Demo
5. Add User Story 4 → Systemic guidance → Demo
6. Polish → Kitchen sink + edge cases → Done

### Single Agent Strategy

Work sequentially: Phase 1 → Phase 2 → Phase 3 → Phase 4 → Phase 5 → Phase 6 → Phase 7. Each phase builds on the previous. Stop after any user story for a working increment.

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- All new WebView components must render correctly in both light and dark VS Code themes
- Type definitions must be manually synced between vsix/ and webview/ packages
- The TriageFindingPanel is progressively enhanced: US1 adds the skeleton, US2/US3/US4 each add category-specific action sections
