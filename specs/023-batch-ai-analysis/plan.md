# Implementation Plan: Batch Analysis and Session Management

**Feature Branch**: `023-batch-ai-analysis`
**Created**: 2026-03-20
**Spec**: [spec.md](./spec.md)
**Research**: [research.md](./research.md)

## Technical Context

| Aspect | Details |
|--------|---------|
| **Scope** | Extension host (AiService, provider, panel manager) + WebView (FindingsView, App reducer) |
| **Dependencies** | Spec 022 (single finding analysis) — AiService, AiProvider, message protocol, ClaudeAgentProvider |
| **SDK** | `@anthropic-ai/claude-agent-sdk` — `query()` with `resume` option, `session_id` in result events |
| **Key Files** | `aiService.ts`, `aiProvider.ts`, `claudeAgentProvider.ts`, `messages.ts`, `findingsPanelManager.ts`, `FindingsView.tsx`, `App.tsx` |
| **No DB Changes** | Batch is transient — no Prisma schema changes |

## Constitution Check

| Principle | Status | Notes |
|-----------|--------|-------|
| I. VS Code Native | PASS | Setting declared in `package.json`, no external dependencies |
| II. Extension Host Owns State | PASS | Batch loop in AiService, WebView is pure renderer |
| III. Ship Fast / Simplicity First | PASS | Sequential loop, no complex concurrency, minimal new abstractions |
| IV. Typed Contracts at Boundaries | PASS | New messages added to discriminated unions in both packages |
| V. Theme Integration | PASS | Button uses `variant="outline"`, progress uses existing patterns |
| VI. Security by Default | PASS | No new network calls, no eval, no CSP changes |

## Phase 2: Implementation Plan

### Task 1: Extend AiProvider Interface for Session Resumption

**Files**: `vsix/src/services/aiProvider.ts`

**Changes**:
- Add `resume?: string` to `AnalyzeParams` interface
- Add `sessionId?: string` to `AnalysisResultEvent` interface

**Why**: Foundation for all batch session work. Must be done first so provider and service can reference these fields.

**Acceptance**: TypeScript compiles. Existing single-finding analysis unaffected (fields are optional).

---

### Task 2: Implement Session Resumption in ClaudeAgentProvider

**Files**: `vsix/src/services/claudeAgentProvider.ts`

**Changes**:
- In `analyzeFinding()` async generator: if `params.resume` is set, pass `resume: params.resume` to the SDK `query()` options object
- Capture `session_id` from `SDKResultMessage` (it's already available on the message object)
- Include `sessionId: message.session_id` in the yielded `AnalysisResultEvent`

**Why**: Enables session reuse. The provider doesn't decide when to resume — it just passes the option through. The orchestrator (AiService) decides.

**Acceptance**: When `resume` is provided, the SDK query includes it. When omitted, behavior is identical to current. `sessionId` appears in result events.

---

### Task 3: Add Batch Setting to package.json and AiServiceConfig

**Files**: `vsix/package.json`, `vsix/src/services/aiService.ts`

**Changes**:
- Add `ashWorkbench.llm.batchConsecutiveFailureLimit` to `contributes.configuration.properties` in `package.json` (type: number, default: 3, min: 1, max: 100)
- Add `batchConsecutiveFailureLimit: number` to `AiServiceConfig` interface
- Read setting in `getConfig()`: `config.get<number>('batchConsecutiveFailureLimit', 3)`

**Why**: Configurable consecutive failure limit per FR-014.

**Acceptance**: Setting appears in VS Code Settings UI under "ASH Workbench > LLM". Default value is 3.

---

### Task 4: Add Batch Message Types to Protocol

**Files**: `vsix/src/models/messages.ts`, `webview/src/types/messages.ts`

**Changes**:
- Add to `ExtToWebviewMessage` union:
  - `batchAnalysisStarted: { scanId, totalFindings, findingIds }`
  - `batchAnalysisProgress: { scanId, currentIndex, totalFindings, currentFindingId }`
  - `batchAnalysisComplete: { scanId, analyzedCount, failedCount, skippedCount, status }`
- Add to `WebviewToExtMessage` union:
  - `analyzeAllFindings: { scanId }`
  - `cancelBatchAnalysis: { scanId }`
- Keep both files in sync (manual copy per convention)

**Why**: Typed message contracts per constitution principle IV. Both packages must have identical type definitions.

**Acceptance**: TypeScript compiles in both packages. Existing message types unchanged.

---

### Task 5: Implement `analyzeAllFindings()` in AiService

**Files**: `vsix/src/services/aiService.ts`

**Changes**:
- Add `activeBatches: Map<string, BatchAnalysisState>` instance field
- Add `analyzeAllFindings(scanId: string, onBatchEvent: (event: BatchEvent) => void): Promise<void>` method
- Implementation:
  1. Query FindingsService for all findings in scan where `aiAnalysis` is null
  2. Guard: reject if batch already active for scanId (FR-013)
  3. Emit `batch-started` event
  4. Loop through findings sequentially:
     a. Skip if finding has active analysis in `activeAnalyses` map
     b. Emit `batch-progress` event (1-based index)
     c. Call existing `analyzeFinding()` with `resume` session ID (captured from prior result)
     d. In the onEvent callback: forward as `batch-finding-event`, capture `sessionId` from result, track success/failure counts
     e. On success: reset `consecutiveFailures` to 0, increment `analyzedCount`
     f. On error: increment `consecutiveFailures` and `failedCount`. If threshold reached, stop loop
  5. Emit `batch-complete` event with final status
  6. Clean up: remove from `activeBatches`
- Add `cancelBatchAnalysis(scanId: string): void` method:
  1. Get batch state from `activeBatches`
  2. Call `abortController.abort()` on the batch
  3. The currently-active `analyzeFinding()` will receive abort and emit cancelled error

**Session resumption flow**:
- First finding: `resume` is undefined (fresh session)
- On first result event: capture `event.sessionId` into `BatchAnalysisState.sessionId`
- Subsequent findings: pass `BatchAnalysisState.sessionId` as `resume` to `analyzeFinding()`
- If session fails (error on resume): clear `sessionId`, retry without resume (FR-010 fallback)

**Why**: Core batch orchestration logic. This is the P1 feature.

**Acceptance**: Analyzes all unanalyzed findings sequentially. Consecutive failure threshold stops batch. Cancellation works. Session ID propagated.

---

### Task 6: Add Batch Handlers to FindingsPanelManager

**Files**: `vsix/src/providers/findingsPanelManager.ts`

**Changes**:
- Add `analyzeAllFindings` case in `handleMessage()`:
  1. Post `batchAnalysisStarted` to webview
  2. Call `aiService.analyzeAllFindings(scanId, (batchEvent) => {...})`
  3. Route batch events to webview messages:
     - `batch-progress` → post `batchAnalysisProgress`
     - `batch-finding-event` → forward inner event as existing per-finding message (`aiAnalysisStarted`, `aiAnalysisProgress`, `aiAnalysisResult`, `aiAnalysisError`)
     - `batch-complete` → post `batchAnalysisComplete`
- Add `cancelBatchAnalysis` case: call `aiService.cancelBatchAnalysis(scanId)`

**Why**: Message routing layer between WebView and AiService. Follows existing pattern (see `analyzeFinding` handler at line 514).

**Acceptance**: Batch messages route correctly. Per-finding events still flow through during batch.

---

### Task 7: Add Batch State to WebView Reducer

**Files**: `webview/src/App.tsx`

**Changes**:
- Add `batchAnalysisState` to `AppState`:
  ```typescript
  batchAnalysisState: {
    scanId: string;
    currentIndex: number;
    totalFindings: number;
    currentFindingId: string;
    analyzedCount: number;
    failedCount: number;
    status: 'running' | 'completed' | 'cancelled' | 'consecutive-failures' | 'error';
  } | null;
  ```
- Add reducer cases for new messages:
  - `batchAnalysisStarted`: set `batchAnalysisState` with initial values, status `'running'`
  - `batchAnalysisProgress`: update `currentIndex`, `currentFindingId`
  - `batchAnalysisComplete`: update final counts and status. Auto-clear after a brief display (or on user dismiss)
- Existing per-finding reducer cases (`aiAnalysisStarted`, `aiAnalysisProgress`, `aiAnalysisResult`, `aiAnalysisError`) continue to work unchanged during batch — they update `analysisStates[findingId]` as before

**Why**: WebView needs batch state to render progress UI and button states.

**Acceptance**: Batch state updates correctly through the batch lifecycle. Per-finding states still work.

---

### Task 8: Add "Analyze All Findings" Button and Batch Progress UI

**Files**: `webview/src/components/FindingsView.tsx`

**Changes**:
- Add `batchAnalysisState` and `analysisStates` to `FindingsViewProps`
- Add `onAnalyzeAll: (scanId: string) => void` and `onCancelBatch: (scanId: string) => void` callback props
- Compute `hasUnanalyzedFindings`: check if any visible finding has `aiAnalysis === null` and is not in `analysisStates`
- Render in header toolbar area (near filter controls):
  - **Idle state**: "Analyze All Findings" button (`variant="outline"`)
    - Disabled when: `!hasUnanalyzedFindings` or `batchAnalysisState?.status === 'running'`
    - On click: `postMessage({ type: 'analyzeAllFindings', payload: { scanId } })`
  - **Running state** (when `batchAnalysisState?.status === 'running'`):
    - Progress text: "Analyzing finding {currentIndex} of {totalFindings}..."
    - Small spinner icon
    - "Cancel" button (`variant="outline"`, text-destructive)
  - **Complete state** (brief notification):
    - "Analyzed {analyzedCount} findings" (with failed/skipped counts if non-zero)
    - Auto-dismiss or dismiss on next navigation

**Why**: Primary user interaction for batch analysis (FR-003, FR-004, FR-005). Follows existing toolbar patterns.

**Acceptance**: Button visible in FindingsView header. Disabled when appropriate. Progress shows during batch. Cancel works.

---

### Task 9: Wire Up postMessage Calls and App.tsx Integration

**Files**: `webview/src/App.tsx`

**Changes**:
- Pass `batchAnalysisState` and batch callbacks to `FindingsView`
- Add `analyzeAllFindings` helper (like existing `selectScan` helper):
  ```typescript
  const analyzeAllFindings = (scanId: string) => {
    postMessage({ type: 'analyzeAllFindings', payload: { scanId } });
  };
  ```
- Add `cancelBatchAnalysis` helper similarly
- Ensure `batchAnalysisState` is cleared on view navigation (user leaves findings view)

**Why**: Connect the WebView UI to the message protocol.

**Acceptance**: Clicking "Analyze All" sends message. Cancel sends message. State flows correctly.

---

### Task 10: Unit Tests

**Files**: `vsix/src/test/` (new test file: `batchAnalysis.test.ts`)

**Test cases**:
1. **Happy path**: `analyzeAllFindings` processes all unanalyzed findings sequentially, emits correct batch events
2. **Skip already-analyzed**: Findings with existing `aiAnalysis` are skipped, counts reflect this
3. **Cancellation**: Cancel mid-batch, verify completed analyses preserved, remaining skipped
4. **Consecutive failure threshold**: After N consecutive errors, batch stops with `consecutive-failures` status
5. **Consecutive failure reset**: Success between failures resets the counter
6. **Session resumption**: Verify `resume` is passed to second+ findings, `sessionId` captured from first result
7. **Session fallback**: If resume fails (error), next finding starts fresh session
8. **Duplicate batch guard**: Starting a second batch for same scanId is rejected (FR-013)
9. **Message routing**: FindingsPanelManager correctly routes batch events to webview messages

**Testing approach**: Unit tests with sinon stubs for FindingsService and AiProvider. No VS Code electron needed (pure logic).

**Acceptance**: All tests pass. Coverage for all edge cases in spec.

---

## Implementation Order & Dependencies

```
Task 1 (AiProvider types)
  └──> Task 2 (ClaudeAgentProvider session)
  └──> Task 5 (AiService batch loop) ──> Task 6 (Panel manager handlers)

Task 3 (Settings) ──> Task 5 (AiService reads setting)

Task 4 (Message types)
  └──> Task 6 (Panel manager uses types)
  └──> Task 7 (WebView reducer uses types)
  └──> Task 8 (FindingsView uses types)
  └──> Task 9 (App.tsx wiring)

Task 10 (Tests) — after Tasks 1-6 complete
```

**Suggested execution order**: 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9 → 10

## Risk Assessment

| Risk | Mitigation |
|------|-----------|
| SDK `resume` option doesn't work as expected | FR-010 fallback: clear sessionId and continue without resume. Session reuse is P3 — batch works without it |
| Long-running batch blocks UI | Sequential with per-finding events keeps UI responsive. Cancel always available |
| Batch + single analysis race condition | Skip findings with active analysis in `activeAnalyses` map. Concurrency guard prevents duplicates |
| Settings not read during batch | Read `getConfig()` once at batch start. Setting change mid-batch takes effect on next batch |
