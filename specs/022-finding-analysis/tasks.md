# Tasks: Finding Analysis — Core AI Feature

**Input**: Design documents from `/specs/022-finding-analysis/`
**Prerequisites**: plan.md (required), spec.md (required), research.md, data-model.md, contracts/

**Tests**: Test tasks included in Polish phase per plan.md Phase H.

**Organization**: Tasks grouped by user story. Infrastructure exists from Specs 018-021; this feature completes the end-to-end flow.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Phase 1: Foundational (Shared Type & State Changes)

**Purpose**: Type extensions and reducer state that multiple user stories depend on

**CRITICAL**: No user story work can begin until this phase is complete

- [x] T001 [P] Add `analysisMetadata: AnalysisMetadata | null` field to `FindingRow` interface in `vsix/src/models/types.ts`
- [x] T002 [P] Add `analysisMetadata: AnalysisMetadata | null` field to `FindingRow` interface in `webview/src/types/types.ts` (manual sync with T001)
- [x] T003 Update `mapFindingToRow` in `vsix/src/models/mappers.ts` to parse `Finding.aiAnalysis` JSON as `StoredAiAnalysis` and extract `stored.metadata` into the new `analysisMetadata` field alongside existing `stored.analysis` → `aiAnalysis`
- [x] T004 Define `AnalysisUIState` type (`{ status: 'analyzing' | 'error', message: string, toolName?: string, errorType?: string }`) and add `analysisStates: Record<string, AnalysisUIState>` to `AppState` in `webview/src/App.tsx`
- [x] T005 Update reducer in `webview/src/App.tsx` to handle all four AI analysis message types: `aiAnalysisStarted` → create entry with status 'analyzing'; `aiAnalysisProgress` → update message/toolName; `aiAnalysisResult` → delete entry from analysisStates AND update finding's `analysisMetadata` alongside existing `aiAnalysis` update; `aiAnalysisError` → set status 'error' with message and errorType
- [x] T006 Pass `analysisStates` from App.tsx state down to `FindingDetailView` component via props — add `analysisState` prop (looked up by `finding.id`) to the component's props interface

**Checkpoint**: Types extended, reducer wired, analysisState flows to FindingDetailView — user story implementation can begin

---

## Phase 2: User Story 1 — Analyze a Security Finding (Priority: P1) MVP

**Goal**: User clicks "Analyze" on a finding, sees a loading indicator, and receives the structured analysis displayed in the AiAnalysisPanel

**Independent Test**: Select any finding without an existing analysis, click "Analyze," wait for completion, verify the explanation/risk/fix/references appear in the panel. Navigate away and back — stored result should render immediately. Click "Re-analyze" on an existing analysis — new result should overwrite.

### Implementation for User Story 1

- [x] T007 [US1] Add "Analyze" button (variant="outline") to `FindingDetailView` in `webview/src/components/FindingDetailView.tsx` — render when `finding.aiAnalysis` is null AND `analysisState` is undefined. Wire onClick to `postMessage({ type: 'analyzeFinding', payload: { findingId: finding.id } })`
- [x] T008 [US1] Add basic loading state to `FindingDetailView` in `webview/src/components/FindingDetailView.tsx` — when `analysisState?.status === 'analyzing'`, replace the Analyze button with a spinner and the text from `analysisState.message`
- [x] T009 [US1] Add "Re-analyze" button (variant="outline") to `FindingDetailView` in `webview/src/components/FindingDetailView.tsx` — render below existing `AiAnalysisPanel` when `finding.aiAnalysis` is not null AND `analysisState` is undefined. Wire onClick to same `analyzeFinding` postMessage
- [x] T010 [US1] Pass `metadata={finding.analysisMetadata}` prop to `AiAnalysisPanel` in `FindingDetailView` — update the existing `<AiAnalysisPanel analysis={finding.aiAnalysis} />` call to also forward metadata (AiAnalysisPanel prop update comes in US4, but passing the prop now avoids a revisit)

**Checkpoint**: US1 fully functional — trigger, wait, view result, re-analyze, persistence verified

---

## Phase 3: User Story 2 — Monitor Analysis Progress (Priority: P2)

**Goal**: During analysis, stream real-time agent activity messages (e.g., "Reading auth.py…") so the user knows the agent is actively working

**Independent Test**: Trigger analysis, observe progress messages updating in sequence. Switch to another finding and back — progress state should persist if analysis is still running.

### Implementation for User Story 2

- [x] T011 [US2] Create `AnalysisProgress` component in `webview/src/components/AnalysisProgress.tsx` — accepts `{ message: string, toolName?: string }` props. Renders a spinner icon, the progress message text, and optionally the tool name as a subtle label. Uses ShadCN Spinner/Loader pattern with outline styling
- [x] T012 [US2] Integrate `AnalysisProgress` into `FindingDetailView` in `webview/src/components/FindingDetailView.tsx` — replace the basic spinner+text from T008 with the `AnalysisProgress` component, passing `analysisState.message` and `analysisState.toolName`

**Checkpoint**: US2 fully functional — progress messages stream live during analysis, latest message shown

---

## Phase 4: User Story 3 — Cancel an In-Flight Analysis (Priority: P2)

**Goal**: User can abort a running analysis via a "Cancel" button, freeing resources and budget

**Independent Test**: Trigger analysis, click "Cancel" during progress, verify the UI returns to the Analyze button state and no result is persisted.

### Implementation for User Story 3

- [x] T013 [US3] Add `onCancel` callback prop to `AnalysisProgress` component in `webview/src/components/AnalysisProgress.tsx` — render a "Cancel" button (variant="outline", with `text-destructive` class for red text per constitution Button Treatment) that calls `onCancel` when clicked
- [x] T014 [US3] Wire cancel action in `FindingDetailView` in `webview/src/components/FindingDetailView.tsx` — pass `onCancel={() => postMessage({ type: 'cancelAiAnalysis', payload: { findingId: finding.id } })}` to the `AnalysisProgress` component

**Checkpoint**: US3 fully functional — cancel stops analysis, UI resets, no partial persist

---

## Phase 5: User Story 6 — AI Agent Custom Tools (Priority: P2)

**Goal**: The AI agent can call `get_finding_context` and `list_related_findings` MCP tools to access enriched finding data from the database

**Independent Test**: Analyze a finding and check the metadata section's "tools used" list — it should include custom tool names when the agent used them.

### Implementation for User Story 6

- [x] T015 [US6] Add `getRelatedFindings(findingId: string)` method to `FindingsService` in `vsix/src/services/findings.ts` — loads target finding to get scanId/ruleId/scanner/file, then queries `Finding.findMany` with `where: { scanId, id: { not: findingId }, OR: [{ ruleId }, { scanner }, { file }] }`, take: 25. Returns array of mapped FindingRow plus a `matchReason` field
- [x] T016 [P] [US6] Create `vsix/src/services/mcpTools.ts` — export `createFindingMcpServer(findingsService, findingId, workspaceRoot)` function. Define `get_finding_context` tool: calls `getFindingDetail(findingId)`, reads source file via `fs.readFile` for ±20 lines around startLine/endLine, returns `{ finding, surroundingCode, fileExists }`. Handles missing file gracefully (fileExists: false, surroundingCode empty). Define `list_related_findings` tool: calls `getRelatedFindings(findingId)`, returns `{ relatedFindings, totalCount }`. Use the JSON schemas from `contracts/messages.md` for input validation
- [x] T017 [US6] Update `ClaudeAgentProvider.analyzeFinding()` in `vsix/src/services/claudeAgentProvider.ts` — import `createFindingMcpServer`, create the MCP server before the query call, add it to query options via `mcpServers: [server]`. Add `'get_finding_context'` and `'list_related_findings'` to the `allowedTools` array (both read-only and full modes)
- [x] T018 [US6] Pass `findingsService` into `ClaudeAgentProvider` — update the constructor or `analyzeFinding` params to receive `FindingsService` so the MCP tools can access the database. Update `AiService.analyzeFinding()` in `vsix/src/services/aiService.ts` to pass `findingsService` through to the provider's `analyzeFinding` call

**Checkpoint**: US6 fully functional — agent has access to custom tools, tool usage visible in metadata

---

## Phase 6: User Story 4 — View Analysis Metadata (Priority: P3)

**Goal**: After analysis completes, display model name, cost, timestamp, and tools used in a collapsible "Analysis Details" section

**Independent Test**: Complete an analysis, verify the Analysis Details section appears with all four metadata fields. Collapse it, navigate away and back — it should remain collapsed. Different findings show their own metadata.

### Implementation for User Story 4

- [x] T019 [US4] Extend `AiAnalysisPanel` props in `webview/src/components/AiAnalysisPanel.tsx` — add `metadata?: AnalysisMetadata | null` to the props interface
- [x] T020 [US4] Add "Analysis Details" accordion item to `AiAnalysisPanel` in `webview/src/components/AiAnalysisPanel.tsx` — render as the last accordion item, NOT in the `defaultValue` array (collapsed by default). Display: model name (`metadata.modelId`), cost (`$${metadata.costUsd.toFixed(4)}`), timestamp (formatted `metadata.analyzedAt`), tools used (Badge list of `metadata.toolsUsed`). Only render this section when `metadata` is non-null

**Checkpoint**: US4 fully functional — metadata visible, collapsible, per-finding

---

## Phase 7: User Story 5 — Handle Analysis Errors Gracefully (Priority: P3)

**Goal**: When analysis fails, display a clear, actionable error message with guidance specific to the error type, plus a retry button

**Independent Test**: Simulate each error condition (missing credentials, budget exceeded, network error) and verify the appropriate guidance message appears with a retry button.

### Implementation for User Story 5

- [x] T021 [US5] Create `ERROR_GUIDANCE` map in `webview/src/components/FindingDetailView.tsx` (or a shared `lib/error-guidance.ts`) — `Record<string, string>` mapping each `errorType` to its user-facing guidance message per the error guidance map in `contracts/messages.md` (9 error types: credentials_missing, auth_failed, model_unavailable, budget_exceeded, max_turns_exceeded, network_error, cancelled, format_error, unknown)
- [x] T022 [US5] Add error state display to `FindingDetailView` in `webview/src/components/FindingDetailView.tsx` — when `analysisState?.status === 'error'`, render a ShadCN Alert component (variant="destructive") showing the error message and the mapped guidance text from `ERROR_GUIDANCE`. Include a "Retry" button (variant="outline") that fires `analyzeFinding` postMessage, and a dismiss action that clears the error from `analysisStates`
- [x] T023 [US5] Add `dismissAnalysisError` handling — define a local dispatch action or inline state update in `App.tsx` that removes the error entry from `analysisStates[findingId]` when the user dismisses. Wire from FindingDetailView via a callback prop or postMessage pattern consistent with existing dismiss patterns

**Checkpoint**: US5 fully functional — errors display with guidance, retry works, dismiss clears

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Kitchen Sink demo, tests, compile/lint verification

- [x] T024 [P] Create Kitchen Sink demo for analysis UI in `webview/src/pages/sink/` — show all states: Analyze button, progress indicator with sample messages, each error type with guidance, completed analysis with metadata section. Register in sink registry
- [x] T025 [P] Create unit tests for MCP tools in `vsix/src/test/unit/mcpTools.test.ts` — test `get_finding_context` with mock FindingsService (happy path + missing file), test `list_related_findings` with mock data (verify same-scan scoping, max 25 limit, excludes self)
- [x] T026 [P] Add metadata extraction test to `vsix/src/test/unit/mappers.test.ts` — test `mapFindingToRow` correctly extracts both `aiAnalysis` and `analysisMetadata` from `StoredAiAnalysis` JSON, and returns null for both when `aiAnalysis` column is null
- [x] T027 [P] Create end-to-end flow test in `vsix/src/test/unit/findingAnalysisFlow.test.ts` — mock AiService and FindingsPanelManager to verify: analyzeFinding triggers AiService.analyzeFinding(), progress events forward to WebView, result persists via setAiAnalysis(), cancelAiAnalysis calls abort, error events forward with correct errorType
- [x] T028 [P] Add reducer state transition tests in `webview/src/test/reducer.test.ts` — test all four AI message reducer cases: aiAnalysisStarted creates analysisStates entry, aiAnalysisProgress updates message/toolName, aiAnalysisResult removes entry and updates finding, aiAnalysisError sets error status. Test dismissAnalysisError clears entry
- [x] T029 Run `npm run compile` in `vsix/` and `npm run build` in `webview/` to verify no TypeScript errors across both packages
- [x] T030 Run `npm run lint` in `vsix/` to verify no ESLint violations

**Checkpoint**: All code compiles, lints clean, tests pass, Kitchen Sink covers all visual states

> Note: T024-T028 can all run in parallel. T029-T030 are sequential verification gates.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Foundational (Phase 1)**: No dependencies — can start immediately. BLOCKS all user stories
- **US1 (Phase 2)**: Depends on Phase 1 completion — delivers the MVP
- **US2 (Phase 3)**: Depends on US1 (T008 creates basic loading state that US2 enhances)
- **US3 (Phase 4)**: Depends on US2 (Cancel button lives on the AnalysisProgress component)
- **US6 (Phase 5)**: Depends on Phase 1 only — can run in parallel with US1/US2/US3
- **US4 (Phase 6)**: Depends on Phase 1 only — can run in parallel with US1-US3 (prop wired in T010)
- **US5 (Phase 7)**: Depends on Phase 1 only — can run in parallel with US1-US3
- **Polish (Phase 8)**: Depends on all user stories being complete

### User Story Dependencies

- **US1 (P1)**: Phase 1 only — no other story dependencies
- **US2 (P2)**: US1 (needs FindingDetailView loading state to enhance)
- **US3 (P2)**: US2 (needs AnalysisProgress component to add cancel to)
- **US6 (P2)**: Phase 1 only — independent of all UI stories
- **US4 (P3)**: Phase 1 only — independent (prop passed in US1's T010)
- **US5 (P3)**: Phase 1 only — independent

### Parallel Opportunities

- T001 and T002 (type changes in both packages) can run in parallel
- After Phase 1: US6, US4, and US5 can all run in parallel with the US1→US2→US3 chain
- All Polish tasks (T024-T028) can run in parallel
- US6 (MCP tools) is entirely extension-host side, no UI overlap with other stories

---

## Parallel Example: After Phase 1

```
# Track 1 (UI chain — sequential):
T007 → T008 → T009 → T010       (US1: Analyze button + loading + re-analyze)
       then T011 → T012          (US2: AnalysisProgress component)
       then T013 → T014          (US3: Cancel button)

# Track 2 (Extension host — independent):
T015 → T016 → T017 → T018       (US6: MCP tools)

# Track 3 (Metadata UI — independent):
T019 → T020                       (US4: Metadata display)

# Track 4 (Error UI — independent):
T021 → T022 → T023               (US5: Error guidance)

# All tracks can run in parallel after Phase 1
```

---

## Implementation Strategy

### MVP First (US1 Only)

1. Complete Phase 1: Foundational types + reducer (T001-T006)
2. Complete Phase 2: US1 — Analyze button + results (T007-T010)
3. **STOP and VALIDATE**: Trigger analysis, verify result displays, test persistence
4. This alone delivers the core value: AI-powered finding analysis

### Incremental Delivery

1. Phase 1 → Foundation ready
2. US1 → Trigger + results (MVP!)
3. US2 → Real-time progress messages
4. US3 → Cancel support
5. US6 → Enriched agent context via custom tools
6. US4 → Metadata display
7. US5 → Error guidance
8. Polish → Kitchen Sink, tests, lint

### Parallel Strategy

With capacity for 2+ parallel tracks after Phase 1:
- **Track A**: US1 → US2 → US3 (UI chain)
- **Track B**: US6 + US4 + US5 (independent backend + UI)

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Types in `vsix/src/models/types.ts` and `webview/src/types/types.ts` MUST be kept in manual sync
- All buttons use `variant="outline"` per constitution (Button Treatment convention)
- Domain colors for risk badges already exist in `AiAnalysisPanel` — no new color maps needed
- The `aiAnalysisResult` message already carries `metadata` in its payload (defined in Spec 020) — no message protocol changes needed
- Commit after each phase checkpoint for clean rollback points
