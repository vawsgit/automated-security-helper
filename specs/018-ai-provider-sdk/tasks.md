# Tasks: AI Provider Abstraction and Claude Agent SDK Integration

**Input**: Design documents from `/specs/018-ai-provider-sdk/`
**Prerequisites**: plan.md (required), spec.md (required), research.md, data-model.md, contracts/

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- **Extension host**: `vsix/src/` (TypeScript, Node.js)
- **WebView**: `webview/src/` (React 19, Vite)
- **Prisma**: `vsix/prisma/` (schema, migrations)
- All paths relative to `workbench/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Install dependencies and update extension configuration

- [X] T001 Install `@anthropic-ai/claude-agent-sdk` and `zod` dependencies by running `npm install` in `vsix/`
- [X] T002 [P] Update `ashWorkbench.llm` settings in `vsix/package.json` contributes.configuration — add `useClaudeSettings` (boolean, default true), `awsAuthRefresh` (string, default empty), `maxBudgetUsd` (number, default 1.00), `toolMode` (enum `read-only`/`full`, default `read-only`); update `provider` enum to include `anthropic-api`; change `region`, `modelId`, `provider` defaults to empty strings for override-only behavior

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core types, interfaces, schema, and service skeleton that ALL user stories depend on

**CRITICAL**: No user story work can begin until this phase is complete

- [X] T003 [P] Add `StoredAiAnalysis` interface (wraps `AiAnalysis` + `AnalysisMetadata`) and `AnalysisMetadata` interface (`analyzedAt`, `modelId`, `costUsd`, `toolsUsed`) to `vsix/src/models/types.ts`
- [X] T004 [P] Sync `StoredAiAnalysis` and `AnalysisMetadata` interfaces to `webview/src/types/types.ts` (manual copy, must match vsix exactly)
- [X] T005 [P] Create `vsix/src/services/aiProvider.ts` — define `AiProvider` interface (`analyzeFinding`, `testConnection`, `getCapabilities`), `AnalyzeParams`, `AnalysisEvent` discriminated union (`AnalysisProgressEvent | AnalysisResultEvent | AnalysisErrorEvent`), `AnalysisErrorType` union literal, `ConnectionTestResult`, and `ProviderCapabilities` per `contracts/ai-provider-interface.md`
- [X] T006 [P] Add 5 new `ExtToWebviewMessage` types (`aiAnalysisStarted`, `aiAnalysisProgress`, `aiAnalysisResult`, `aiAnalysisError`, `aiTestResult`) and 3 new `WebviewToExtMessage` types (`testAiConnection`, `analyzeFinding`, `cancelAiAnalysis`) to the discriminated unions in `vsix/src/models/messages.ts` per `contracts/messages.md`
- [X] T007 [P] Sync all new AI message types to `webview/src/types/messages.ts` (manual copy, must match vsix exactly)
- [X] T008 Add `aiAnalysis Json?` column to `Finding` model in `vsix/prisma/schema.prisma` and create SQL migration file (`ALTER TABLE "Finding" ADD COLUMN "aiAnalysis" jsonb`) per `data-model.md`
- [X] T009 Update `mapFindingToRow()` in `vsix/src/models/mappers.ts` — read `finding.aiAnalysis` from Prisma result (`Prisma.JsonValue | null`), parse as `StoredAiAnalysis`, extract `.analysis` field, return as `FindingRow.aiAnalysis: AiAnalysis | null` (replace existing `null` hardcode)
- [X] T010 Add `setAiAnalysis(findingId: string, analysis: AiAnalysis, metadata: AnalysisMetadata)` method (stores `StoredAiAnalysis` wrapper as JSON) and `clearAiAnalysis(findingId: string)` method (sets column to null) to `vsix/src/services/findings.ts`
- [X] T011 Create `vsix/src/services/aiService.ts` — `AiService` class with constructor taking `FindingsService` + workspace root, lazy `ClaudeAgentProvider` creation on first AI action (FR-012), concurrency tracking via `Map<string, AbortController>` with max 5 active (FR-014), `buildQueryOptions()` settings resolution reading `ashWorkbench.llm.*` config with `settingSources: ['user']` inheritance when `useClaudeSettings` is true, and method stubs for `testConnection()` and `analyzeFinding()`
- [X] T012 Wire `AiService` creation in `vsix/src/extension.ts` — instantiate after `FindingsService` with workspace root, inject into `FindingsPanelManager` and `SidebarWebviewProvider` via new `setAiService()` setter methods, add `dispose()` cleanup to `context.subscriptions`

**Checkpoint**: Foundation ready — types defined, schema updated, service skeleton in place. User story implementation can now begin.

---

## Phase 3: User Story 1 — Validate AI Connection (Priority: P1) MVP

**Goal**: Users can test their AI backend configuration and get a clear success/failure result with model name, latency, or categorized error

**Independent Test**: Trigger "Test AI Connection" from the dashboard and observe success (model name + latency ms) or a specific error message (credentials missing, auth failed, model unavailable, network error)

### Implementation for User Story 1

- [X] T013 [US1] Implement `ClaudeAgentProvider` class in `vsix/src/services/claudeAgentProvider.ts` — constructor accepts settings config, `testConnection()` runs minimal SDK `query()` with 10-second timeout capturing `session_id` from init message as proof of connectivity, `getCapabilities()` returns static capabilities object (`{ structuredOutput: true, toolUse: true, codeEditing: true, webSearch: true, sessionPersistence: true }`), and error categorization helper mapping SDK exceptions to `AnalysisErrorType` (credentials_missing for missing env vars, auth_failed for 401/403, model_unavailable for model errors, network_error for timeouts/DNS, unknown for all else)
- [X] T014 [US1] Implement `AiService.testConnection()` in `vsix/src/services/aiService.ts` — lazily creates `ClaudeAgentProvider` via `buildQueryOptions()` settings, delegates to `provider.testConnection()`, returns `ConnectionTestResult`
- [X] T015 [US1] Wire `testAiConnection` message handler in `vsix/src/providers/SidebarWebviewProvider.ts` — on receiving `testAiConnection`, call `aiService.testConnection()`, post `aiTestResult` message back to WebView with success/failure details. Also handle in `FindingsPanelManager` if dashboard messages route there

**Checkpoint**: User Story 1 complete — users can validate their AI configuration end-to-end. Test by clicking "Test AI Connection" in the dashboard.

---

## Phase 4: User Story 2 — Analyze a Single Security Finding (Priority: P1) MVP

**Goal**: Users select a finding, click "Analyze", see real-time progress, and receive a structured analysis (explanation, risk assessment, suggested fix, references) that is persisted to the database

**Independent Test**: Open a finding with a valid file path, click "Analyze", observe progress messages, see the completed analysis in AiAnalysisPanel, close and reopen the finding to verify cached result loads instantly

### Implementation for User Story 2

- [X] T016 [P] [US2] Build security analysis system prompt template (AppSec expert persona, finding context injection with title/description/severity/scanner/ruleId/filePath/lineNumbers/codeSnippet, output expectations) and define `AiAnalysis` JSON Schema object for SDK `outputFormat` option matching the existing `AiAnalysis` TypeScript type in `vsix/src/services/claudeAgentProvider.ts`
- [X] T017 [US2] Implement `ClaudeAgentProvider.analyzeFinding(params: AnalyzeParams)` in `vsix/src/services/claudeAgentProvider.ts` — configure SDK `query()` with: `systemPrompt` from template, `allowedTools` based on `params.toolMode` (read-only: `["Read", "Glob", "Grep"]`, full: `["Read", "Write", "Edit", "Bash", "Glob", "Grep"]`), `permissionMode: "dontAsk"`, `outputFormat: { type: "json_schema", schema }`, `maxBudgetUsd`, `maxTurns`, `cwd: params.workspaceRoot`, `abortController` from `params.abortSignal`; iterate SDK message generator yielding `AnalysisProgressEvent` for assistant tool-use and status messages, `AnalysisResultEvent` from `result.structured_output` with `total_cost_usd`, `AnalysisErrorEvent` for `error_max_turns`/`error_max_budget_usd`/exceptions
- [X] T018 [US2] Implement `AiService.analyzeFinding(findingId, onEvent callback)` in `vsix/src/services/aiService.ts` — check concurrency limit (reject with `aiAnalysisError` if 5 active per FR-015), create `AbortController` and track in active map, load finding via `FindingsService.getFindingDetail()`, build `AnalyzeParams` from settings, iterate `provider.analyzeFinding()` generator forwarding events via callback, on `result` event persist `StoredAiAnalysis` via `FindingsService.setAiAnalysis()`, on re-analysis (finding already has aiAnalysis) only overwrite on success / preserve on failure per FR-016, remove from active map on completion
- [X] T019 [US2] Wire `analyzeFinding` message handler in `vsix/src/providers/FindingsPanelManager.ts` — on receiving `analyzeFinding { findingId }`, post `aiAnalysisStarted` immediately, call `aiService.analyzeFinding()` with event callback that posts `aiAnalysisProgress` for progress events and `aiAnalysisResult` or `aiAnalysisError` for terminal events. Handle concurrent requests for the same finding (reject duplicate)

**Checkpoint**: User Story 2 complete — users can analyze findings with real-time progress and persistent results. Test by analyzing a finding, closing/reopening to verify cache, and re-analyzing to verify overwrite behavior.

---

## Phase 5: User Story 3 — Cancel In-Progress Analysis (Priority: P2)

**Goal**: Users can cancel a running analysis and the system halts within 5 seconds, leaving the finding in its pre-analysis state

**Independent Test**: Start an analysis, click "Cancel" while progress messages are streaming, verify the analysis stops and the finding shows no result (or previous result if re-analyzing)

**Depends on**: Phase 4 (US2) — analysis must exist to be cancelled

### Implementation for User Story 3

- [X] T020 [US3] Implement `AiService.cancelAnalysis(findingId: string)` in `vsix/src/services/aiService.ts` — look up `AbortController` in active map, call `abort()`, and add `dispose()` method that aborts all active analyses for clean extension shutdown (push to `context.subscriptions` in extension.ts)
- [X] T021 [US3] Wire `cancelAiAnalysis` message handler in `vsix/src/providers/FindingsPanelManager.ts` — on receiving `cancelAiAnalysis { findingId }`, call `aiService.cancelAnalysis(findingId)` (provider yields `AnalysisErrorEvent` with `errorType: 'cancelled'`, which the existing US2 handler posts as `aiAnalysisError`)

**Checkpoint**: User Story 3 complete — users can cancel analyses and cleanly shut down. Test by starting analysis, cancelling mid-stream, verifying finding is unaffected.

---

## Phase 6: User Story 4 — Cost-Controlled Analysis (Priority: P2)

**Goal**: The system enforces a per-analysis budget limit and reports actual cost in the result

**Independent Test**: Set `ashWorkbench.llm.maxBudgetUsd` to a very low value (e.g., 0.001), trigger analysis, verify it stops with "budget exceeded" error. Then set a normal budget, run analysis, verify cost is reported in the result metadata.

**Depends on**: Phase 4 (US2) — budget enforcement is a parameter of the analysis flow

### Implementation for User Story 4

- [X] T022 [US4] Verify end-to-end cost control: confirm `maxBudgetUsd` from VS Code settings flows through `buildQueryOptions()` → `AnalyzeParams` → SDK `query()` options, `maxTurns` (default 15) flows the same path, `error_max_budget_usd` SDK result maps to `AnalysisErrorEvent { errorType: 'budget_exceeded', message: "Analysis stopped: cost limit reached ($X.XX budget)" }`, `error_max_turns` maps similarly, and `result.total_cost_usd` populates `AnalysisMetadata.costUsd` in both DB persistence and `aiAnalysisResult` message — fix any gaps in `vsix/src/services/claudeAgentProvider.ts` and `vsix/src/services/aiService.ts`

**Checkpoint**: User Story 4 complete — budget enforcement and cost transparency verified. Test with low budget and normal budget scenarios.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [X] T023 [P] Add logging for all AI operations to ASH output channel (`vscode.window.createOutputChannel('ASH')` — reuse existing channel): log connection test attempts/results, analysis start/complete/error/cancel with findingId and cost, tool use activity, and concurrency state in `vsix/src/services/aiService.ts`
- [X] T024 Run `npm run compile` in `vsix/` and fix any TypeScript errors across all modified files — ensure strict mode compliance with no `any` types in production code
- [X] T025 Validate provider abstraction (US5 acceptance): confirm `AiService` imports and references `AiProvider` interface only (from `aiProvider.ts`), never imports `ClaudeAgentProvider` directly except in the lazy factory method within `AiService`. A mock provider implementing `AiProvider` can be substituted with zero changes to `AiService`, `FindingsPanelManager`, or `SidebarWebviewProvider`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on Setup (T001 for SDK types) — BLOCKS all user stories
- **US1 (Phase 3)**: Depends on Foundational (Phase 2)
- **US2 (Phase 4)**: Depends on Foundational (Phase 2)
- **US3 (Phase 5)**: Depends on US2 (Phase 4) — cancellation requires the analysis flow
- **US4 (Phase 6)**: Depends on US2 (Phase 4) — cost control is a parameter of the analysis flow
- **Polish (Phase 7)**: Depends on all desired user stories being complete

### User Story Dependencies

- **US1 (P1)**: Can start after Phase 2 — **no dependencies on other stories**
- **US2 (P1)**: Can start after Phase 2 — **no dependencies on other stories**
- **US3 (P2)**: Depends on US2 — adds cancellation to the analysis flow
- **US4 (P2)**: Depends on US2 — verifies cost control in the analysis flow
- **US5 (P3)**: Delivered by Phase 2 + validated in Phase 7 (T025) — no separate implementation phase

### Within Each User Story

- Types/interfaces before implementations
- Provider implementation before service orchestration
- Service orchestration before message handler wiring
- All in same file → sequential; different files → parallel where marked [P]

### Parallel Opportunities

- **Phase 1**: T001 and T002 can run in parallel
- **Phase 2**: T003, T004, T005, T006, T007 can all run in parallel (different files). T008 is also independent. T009 and T010 depend on T003+T008. T011 depends on T005. T012 depends on T011
- **Phase 3 + Phase 4**: US1 (T013–T015) and US2 (T016–T019) can run **in parallel** after Phase 2 — they modify different service methods and providers
- **Phase 5 + Phase 6**: US3 and US4 can run in parallel after US2 completes
- **Phase 7**: T023 can run in parallel with T024 and T025

---

## Parallel Example: Foundational Phase

```text
# Wave 1 — all parallel (different files):
T003: StoredAiAnalysis types in vsix/src/models/types.ts
T004: Sync types to webview/src/types/types.ts
T005: AiProvider interface in vsix/src/services/aiProvider.ts
T006: AI message types in vsix/src/models/messages.ts
T007: Sync messages to webview/src/types/messages.ts
T008: Prisma schema + migration

# Wave 2 — after Wave 1:
T009: Update mappers (needs T003 + T008)
T010: FindingsService methods (needs T003 + T008)
T011: AiService skeleton (needs T005)

# Wave 3 — after Wave 2:
T012: Wire AiService in extension.ts (needs T011)
```

## Parallel Example: US1 + US2 (after Phase 2)

```text
# These two streams run in parallel:

# Stream A — US1 (connection test):
T013: ClaudeAgentProvider constructor + testConnection()
T014: AiService.testConnection()
T015: SidebarWebviewProvider handler

# Stream B — US2 (finding analysis):
T016: System prompt + JSON schema
T017: ClaudeAgentProvider.analyzeFinding()
T018: AiService.analyzeFinding()
T019: FindingsPanelManager handler
```

---

## Implementation Strategy

### MVP First (US1 + US2 Only)

1. Complete Phase 1: Setup (install SDK, update settings)
2. Complete Phase 2: Foundational (types, interfaces, schema, AiService skeleton)
3. Complete Phase 3 + Phase 4 **in parallel**: US1 (connection test) + US2 (finding analysis)
4. **STOP and VALIDATE**: Test connection test and single finding analysis independently
5. Demo: user can validate AI config and analyze a finding with progress + cached results

### Incremental Delivery

1. Setup + Foundational → Foundation ready
2. US1 + US2 in parallel → **MVP!** (connection test + finding analysis)
3. US3 (cancel) → Enhanced user control
4. US4 (cost control) → Enterprise readiness
5. Polish → Logging, compile validation, abstraction verification

### Single Developer Strategy

1. Phase 1 + Phase 2 → Foundation
2. US1 first (simpler, validates SDK integration works)
3. US2 next (core value, builds on SDK knowledge from US1)
4. US3 + US4 (enhancements to US2's flow)
5. Polish

---

## Notes

- [P] tasks = different files, no dependencies on incomplete tasks
- [Story] label maps task to specific user story for traceability
- US5 (Swappable Backend) has no dedicated phase — the `AiProvider` interface is created in Phase 2 (foundational) because US1 and US2 depend on it. Validation is in Phase 7 (T025)
- No test tasks included — tests were not explicitly requested in the spec
- The `AiAnalysisPanel` WebView component already exists and requires no changes
- Message types must be synced manually between `vsix/src/models/messages.ts` and `webview/src/types/messages.ts`
- All new services follow the existing pattern: constructor DI, setter-based injection into providers, disposable cleanup
