# Tasks: Batch Analysis and Session Management

**Input**: Design documents from `/specs/023-batch-ai-analysis/`
**Prerequisites**: plan.md (required), spec.md (required), research.md, data-model.md, contracts/

**Organization**: Tasks grouped by user story. US1 (Batch Analyze) and US2 (Cancel Batch) are combined into a single MVP phase because cancellation is architecturally inseparable from the batch loop (shared AbortController, shared state machine). US3 (Session Persistence) is independently implementable.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Foundational (Blocking Prerequisites)

**Purpose**: Type definitions, message protocol, and settings that all user stories depend on

- [x] T001 [P] Add `resume?: string` to `AnalyzeParams` and `sessionId?: string` to `AnalysisResultEvent` in `vsix/src/services/aiProvider.ts`
- [x] T002 [P] Add 5 batch message types (`batchAnalysisStarted`, `batchAnalysisProgress`, `batchAnalysisComplete`, `analyzeAllFindings`, `cancelBatchAnalysis`) to `ExtToWebviewMessage` and `WebviewToExtMessage` unions in `vsix/src/models/messages.ts` — per contracts/messages.md
- [x] T003 [P] Add matching batch message types to `webview/src/types/messages.ts` (manual sync copy of T002 changes)
- [x] T004 [P] Add `ashWorkbench.llm.batchConsecutiveFailureLimit` setting (number, default: 3, min: 1, max: 100) to `contributes.configuration.properties` in `vsix/package.json` and read it in `getConfig()` in `vsix/src/services/aiService.ts`

**Checkpoint**: All type contracts and settings in place. TypeScript compiles in both packages.

---

## Phase 2: User Story 1 + 2 — Batch Analyze All Findings with Cancellation (Priority: P1/P2) MVP

**Goal**: Users can click "Analyze All Findings" to sequentially analyze every unanalyzed finding in a scan, see real-time progress, and cancel at any time. Consecutive failures stop the batch automatically.

**Independent Test**: Trigger "Analyze All Findings" on a scan with multiple unanalyzed findings. Verify sequential analysis with progress counter. Cancel mid-batch and verify completed analyses are preserved.

### Implementation

- [x] T005 [US1] Define `BatchAnalysisState`, `BatchStatus`, `BatchEvent`, `BatchStartedEvent`, `BatchProgressEvent`, `BatchFindingEvent`, `BatchCompleteEvent` types in `vsix/src/services/aiService.ts` — per data-model.md transient types section
- [x] T006 [US1] Implement `analyzeAllFindings(scanId: string, onBatchEvent: (event: BatchEvent) => void): Promise<void>` in `AiService` in `vsix/src/services/aiService.ts` — sequential loop: query unanalyzed findings from FindingsService, emit batch-started, iterate findings (skip already-in-progress, emit batch-progress, call existing `analyzeFinding()`, forward per-finding events via batch-finding-event, track analyzedCount/failedCount/skippedCount/consecutiveFailures), emit batch-complete. Read `batchConsecutiveFailureLimit` from config. Add `activeBatches: Map<string, BatchAnalysisState>` field. Guard against duplicate batch for same scanId (FR-013)
- [x] T007 [US1] Implement `cancelBatchAnalysis(scanId: string): void` in `AiService` in `vsix/src/services/aiService.ts` — look up batch in `activeBatches`, call `abortController.abort()`, which propagates to the currently-active `analyzeFinding()` call
- [x] T008 [US1] Add `analyzeAllFindings` and `cancelBatchAnalysis` message handlers in `handleMessage()` in `vsix/src/providers/findingsPanelManager.ts` — route batch events to webview: batch-started→`batchAnalysisStarted`, batch-progress→`batchAnalysisProgress`, batch-finding-event→forward inner AnalysisEvent as existing per-finding messages (`aiAnalysisStarted`/`aiAnalysisProgress`/`aiAnalysisResult`/`aiAnalysisError`), batch-complete→`batchAnalysisComplete`. Cancel handler calls `aiService.cancelBatchAnalysis(scanId)`
- [x] T009 [US1] Add `batchAnalysisState` field to `AppState` and reducer cases for `batchAnalysisStarted` (init running state), `batchAnalysisProgress` (update currentIndex/currentFindingId), `batchAnalysisComplete` (set terminal status) in `webview/src/App.tsx` — existing per-finding reducer cases unchanged
- [x] T010 [P] [US1] Add "Analyze All Findings" button (`variant="outline"`) and batch progress UI to FindingsView header toolbar in `webview/src/components/FindingsView.tsx` — add `batchAnalysisState`, `analysisStates`, `onAnalyzeAll`, `onCancelBatch` to props. Idle: show button (disabled when no unanalyzed findings or batch running). Running: show progress text ("Analyzing finding N of M...") with spinner and Cancel button. Complete: button reverts to disabled
- [x] T011 [US1] Wire up batch callbacks in `webview/src/App.tsx` — add `analyzeAllFindings(scanId)` and `cancelBatchAnalysis(scanId)` postMessage helpers, pass `batchAnalysisState` and callbacks to `FindingsView`, clear `batchAnalysisState` on view navigation away from findings

**Checkpoint**: Full batch analysis with progress, cancellation, and consecutive failure threshold working end-to-end. MVP complete — all US1 and US2 acceptance scenarios pass.

---

## Phase 3: User Story 3 — Session Persistence for Efficiency (Priority: P3)

**Goal**: The batch reuses the AI session from the first finding for subsequent findings, enabling faster startup and cross-finding context.

**Independent Test**: Run batch analysis on multiple findings. Observe that finding 2+ starts faster than finding 1. Analysis may reference patterns from earlier findings.

### Implementation

- [x] T012 [US3] Implement session resumption in `analyzeFinding()` async generator in `vsix/src/services/claudeAgentProvider.ts` — if `params.resume` is set, pass `resume: params.resume` in SDK `query()` options. Capture `session_id` from `SDKResultMessage` and include as `sessionId` in the yielded `AnalysisResultEvent`
- [x] T013 [US3] Add session capture and resume passing to `analyzeAllFindings()` batch loop in `vsix/src/services/aiService.ts` — on first result event, store `event.sessionId` in `BatchAnalysisState.sessionId`. For subsequent findings, pass `sessionId` as the `resume` parameter. If a finding errors after resume, clear `sessionId` and let next finding start fresh (FR-010 fallback)

**Checkpoint**: Session reuse working. Subsequent findings in batch receive `resume` parameter. Fallback works on session failure.

---

## Phase 4: Tests

**Purpose**: Unit tests covering all batch analysis edge cases

- [x] T014 Create batch analysis unit tests in `vsix/src/test/batchAnalysis.test.ts` — test cases: (1) happy path processes all unanalyzed findings sequentially with correct batch events, (2) skip already-analyzed findings with correct skippedCount, (3) cancel mid-batch preserves completed analyses and emits cancelled status, (4) consecutive failure threshold stops batch with consecutive-failures status, (5) consecutive failure counter resets on success, (6) session resumption passes `resume` to 2nd+ findings and captures `sessionId` from first result, (7) session fallback clears sessionId and retries on resume failure, (8) duplicate batch for same scanId rejected (FR-013), (9) FindingsPanelManager routes batch events to correct webview messages. Use sinon stubs for FindingsService and AiProvider. Node.js Mocha (no VS Code electron needed)

**Checkpoint**: All tests pass. Full coverage of spec edge cases and acceptance scenarios.

---

## Phase 5: Polish & Cross-Cutting Concerns

**Purpose**: Final verification and cleanup

- [x] T015 Verify message type sync between `vsix/src/models/messages.ts` and `webview/src/types/messages.ts` — ensure all 5 new batch message types have identical definitions in both packages. Run `npm run compile` in both `vsix/` and `webview/` to confirm TypeScript compiles cleanly
- [x] T016 Run `npm run lint` in `vsix/` and fix any lint issues in modified files

---

## Dependencies & Execution Order

### Phase Dependencies

- **Foundational (Phase 1)**: No dependencies — can start immediately. All T001-T004 are parallelizable
- **US1+US2 (Phase 2)**: Depends on Phase 1 completion — BLOCKS until types/messages/settings are in place
- **US3 (Phase 3)**: Depends on Phase 2 (T006 batch loop must exist before adding session logic)
- **Tests (Phase 4)**: Depends on Phases 2 and 3 (tests cover both batch and session)
- **Polish (Phase 5)**: Depends on all prior phases

### User Story Dependencies

- **US1+US2 (P1/P2)**: Can start after Foundational. No dependency on US3
- **US3 (P3)**: Depends on US1+US2 (batch loop must exist to add session reuse). Can be skipped for MVP

### Within Phase 2 (US1+US2)

- T005 (types) before T006 (batch loop) before T007 (cancel)
- T006 before T008 (panel manager needs AiService method to exist)
- T009 (reducer) before T010 (FindingsView needs batchAnalysisState prop type)
- T010 and T011 can be done in either order but T010 before T011 is natural

### Parallel Opportunities

```
Phase 1 (all parallel):
  T001 ──┐
  T002 ──┤── All complete → Phase 2 unblocked
  T003 ──┤
  T004 ──┘

Phase 2 (extension host then webview):
  T005 → T006 → T007 → T008  (extension host chain)
  T009 → T010 → T011          (webview chain, can start after T005 types defined)

Phase 3 (both parallel after T006):
  T012 ──┐── Both complete → Session reuse working
  T013 ──┘   (T012 is provider-level, T013 is service-level; T013 depends on T012)
```

---

## Parallel Example: Phase 1 (Foundational)

```
Launch all 4 tasks in parallel (different files, no dependencies):
  T001: Add resume/sessionId to AiProvider types in vsix/src/services/aiProvider.ts
  T002: Add batch messages to vsix/src/models/messages.ts
  T003: Add batch messages to webview/src/types/messages.ts
  T004: Add batchConsecutiveFailureLimit setting to vsix/package.json + aiService.ts
```

---

## Implementation Strategy

### MVP First (US1+US2 — Batch with Cancel)

1. Complete Phase 1: Foundational types and messages
2. Complete Phase 2: US1+US2 batch loop + UI
3. **STOP and VALIDATE**: Test batch analysis with multiple findings, verify progress and cancellation
4. This is a fully functional feature without session reuse

### Incremental Delivery

1. Phase 1 → Foundation ready
2. Phase 2 → Batch analysis MVP (US1+US2) → Test independently → Demo
3. Phase 3 → Session persistence (US3) → Test speed improvement → Demo
4. Phase 4 → Tests → Confidence for merge
5. Phase 5 → Polish → Ready for PR

### Key Risk: SDK Resume Option

Session resumption (US3) depends on the Claude Agent SDK `resume` option working as documented. If it doesn't work:
- **Mitigation**: FR-010 fallback clears sessionId and continues without resume
- **Impact**: Batch still works, just without cross-finding context and slightly slower
- **Decision point**: After T012, test session resumption manually before building T013

---

## Notes

- [P] tasks = different files, no dependencies between them
- [Story] label maps task to specific user story for traceability
- US1 and US2 are combined because cancellation is architecturally inseparable from the batch loop
- US3 can be deferred — batch is fully functional without session reuse
- No database changes in any phase (batch is transient, per-finding persistence via existing Spec 022 flow)
- Commit after each task or logical group
- Stop at Phase 2 checkpoint for MVP validation
