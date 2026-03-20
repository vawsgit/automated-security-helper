# Research: Batch Analysis and Session Management

**Feature Branch**: `023-batch-ai-analysis`
**Completed**: 2026-03-20

## Decision 1: Session Resumption API

**Decision**: Use the Claude Agent SDK's `resume` option to maintain session context across findings in a batch.

**Rationale**: The SDK natively supports session resumption. Every `SDKAssistantMessage` and `SDKResultMessage` includes a `session_id` field. The `query()` function accepts `resume?: string` in its options to load conversation history from a previous session. This allows the AI to build cross-finding context (e.g., recognizing related vulnerability patterns) without any custom session management.

**Implementation Pattern**:
1. First finding in batch: call `query()` normally, capture `session_id` from the result event
2. Subsequent findings: pass `resume: capturedSessionId` in the `query()` options
3. If resumption fails (session expired/corrupted): fall back to a fresh session (no `resume`)

**Alternatives Considered**:
- Custom context injection (prepend summaries of prior findings to the prompt): More complex, no subprocess reuse benefit, manual context limits
- No session reuse (independent analyses): Simpler but slower startup per finding and no cross-finding context

## Decision 2: Batch Orchestration Location

**Decision**: Add `analyzeAllFindings(scanId, onBatchEvent)` method to `AiService` (extension host). The batch loop lives in AiService, not in the WebView or FindingsPanelManager.

**Rationale**: Per constitution principle II ("Extension Host Owns State"), all business logic must live in `vsix/src/`. The batch orchestrator needs access to FindingsService (to query unanalyzed findings), the AI provider (to run analyses), and settings (for consecutive failure limit). AiService already owns all these dependencies.

**Alternatives Considered**:
- WebView-driven loop (send `analyzeFinding` per finding from React): Violates constitution — business logic in WebView
- FindingsPanelManager loop: Mixes orchestration with message routing — AiService is the correct domain service

## Decision 3: Session ID Propagation

**Decision**: Add optional `sessionId?: string` field to `AnalysisResultEvent` and optional `resume?: string` field to `AnalyzeParams`. The provider captures `session_id` from SDK responses and surfaces it via the result event. The batch orchestrator in AiService passes it forward.

**Rationale**: Minimal interface change. The session ID flows through existing event pipeline without new event types. Only `AnalysisResultEvent` needs it (batch waits for completion before starting next finding).

**Alternatives Considered**:
- New `AnalysisSessionEvent` type: Adds complexity to event union for a single field
- Provider-level getter (`provider.lastSessionId`): Stateful, harder to test, thread-safety concerns

## Decision 4: Batch Progress Message Design

**Decision**: Add new batch-level messages alongside existing per-finding messages. Per-finding messages (`aiAnalysisStarted`, `aiAnalysisProgress`, `aiAnalysisResult`, `aiAnalysisError`) continue unchanged. New batch messages carry `scanId` instead of `findingId` for routing.

**Rationale**: Additive change — existing single-finding analysis is unaffected. WebView can display both batch progress (overall counter) and per-finding progress (tool activity) simultaneously. Clean separation of concerns in reducer.

**New Messages (Extension → WebView)**:
- `batchAnalysisStarted`: `{ scanId, totalFindings, findingIds }`
- `batchAnalysisProgress`: `{ scanId, currentIndex, totalFindings, currentFindingId, status }`
- `batchAnalysisComplete`: `{ scanId, analyzedCount, failedCount, skippedCount, status }`

**New Messages (WebView → Extension)**:
- `analyzeAllFindings`: `{ scanId }`
- `cancelBatchAnalysis`: `{ scanId }`

## Decision 5: UI Placement

**Decision**: Add "Analyze All Findings" button in the FindingsView header toolbar, alongside existing filter controls.

**Rationale**: FindingsView is where users interact with findings. The header toolbar already contains action buttons and filters. This placement is visible without requiring row selection. Follows the existing `variant="outline"` button convention.

**Alternatives Considered**:
- ScanDetailView action button: User must navigate away from findings list to trigger
- Sticky bottom bar (like batch disposition): Requires row selection, conflates with disposition actions
- Floating action button: Not consistent with VS Code aesthetic

## Decision 6: Consecutive Failure Tracking

**Decision**: Track consecutive failures as a simple counter in the batch loop. Reset to 0 on each successful analysis. Stop batch when counter reaches the configurable limit.

**Rationale**: Simple and effective. The counter resets on success, so intermittent failures (e.g., one finding with a malformed file) don't accumulate across the batch. Only truly systemic failures (provider down, auth expired) trigger the threshold.

**Setting**: `ashWorkbench.llm.batchConsecutiveFailureLimit` (number, default: 3, min: 1, max: 100)

## Decision 7: Handling In-Progress Single Analysis During Batch

**Decision**: When starting a batch, skip any finding that already has an active analysis in the `activeAnalyses` map. The batch treats it as "already being analyzed" and moves to the next finding. The skipped finding's in-progress analysis continues independently.

**Rationale**: Avoids the complexity of waiting for in-progress analyses. The existing concurrency guard in `analyzeFinding()` would reject a duplicate anyway. Skipping is the simplest correct behavior.
