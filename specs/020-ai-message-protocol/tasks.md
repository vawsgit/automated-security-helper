# Tasks: AI Message Protocol and Test Connection

**Input**: Design documents from `/specs/020-ai-message-protocol/`
**Prerequisites**: plan.md (required), spec.md (required), research.md, data-model.md, contracts/message-protocol.md

**Tests**: Not explicitly requested — test tasks omitted.

**Organization**: Tasks are grouped by user story. US3 and US4 are combined since the cancel flow reuses the same reducer infrastructure as analysis events.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Foundational (Blocking Prerequisites)

**Purpose**: Extend the stateUpdate message protocol and create the error mapping utility. MUST complete before any user story work.

**Why blocking**: User stories need the extended stateUpdate type to compile, and the error utility for display.

- [X] T001 Add `claudeSettingsDetected` and `detectedProvider` fields to stateUpdate payload type in `vsix/src/models/messages.ts`
- [X] T002 [P] Mirror stateUpdate type change in `webview/src/types/messages.ts` (must match T001 exactly)
- [X] T003 Include `claudeSettingsDetection` fields in `queryStateAndPost()` payload in `vsix/src/providers/sidebarWebviewProvider.ts` — default to `{ claudeSettingsDetected: false, detectedProvider: 'none' }` when `this.claudeSettingsDetection` is undefined
- [X] T004 [P] Include `claudeSettingsDetection` fields in `postStateUpdate()` payload in `vsix/src/providers/findingsPanelManager.ts` — same default pattern as T003
- [X] T005 [P] Create error mapping utility `getAiErrorMessage(errorType: string): string` in `webview/src/lib/ai-errors.ts` — map all 9 AnalysisErrorType values to human-readable messages per contracts/message-protocol.md error taxonomy table; fallback to unknown message for unrecognized types

**Checkpoint**: stateUpdate now carries detection data from extension host to WebView. Error mapping ready for UI consumption. Verify: `cd vsix && npm run compile` passes.

---

## Phase 2: User Story 2 — View AI Configuration Status (Priority: P2)

**Goal**: Users see whether Claude Code AI settings are detected on the Dashboard, with the provider type, immediately on load — no action needed.

**Independent Test**: Open the sidebar Dashboard. If `~/.claude/settings.json` exists with Bedrock or Anthropic API config, the AI section shows "Claude Code settings detected (Bedrock)" or "(Anthropic API)". If the file is missing or empty, it shows setup guidance.

**Note**: US2 is implemented before US1 because the detection display is a prerequisite for the test connection button — the AI status section created here is extended in US1.

### Implementation for User Story 2

- [X] T006 [US2] Add `claudeSettingsDetected: boolean` and `detectedProvider: 'bedrock' | 'anthropic-api' | 'none'` fields to `AppState` interface and `initialState` in `webview/src/App.tsx`
- [X] T007 [US2] Extend the existing `stateUpdate` reducer case to also store `claudeSettingsDetected` and `detectedProvider` from `msg.payload` in `webview/src/App.tsx`
- [X] T008 [US2] Add AI status section to `SidebarDashboard` in `webview/src/components/SidebarDashboard.tsx` — add `claudeSettingsDetected` and `detectedProvider` to props interface; render section after Suppressions button with `<Separator />`, section heading "AI Analysis", detection status text ("Claude Code settings detected (Bedrock)" or setup guidance "Configure AI in VS Code Settings"), use `variant="outline"` styling conventions
- [X] T009 [P] [US2] Add AI status section to `DashboardView` in `webview/src/components/DashboardView.tsx` — add same detection props; render section after the 3-column summary grid with `<Separator />`; show detection status with `<Badge variant="outline">` for provider type or "Not configured"
- [X] T010 [US2] Pass `state.claudeSettingsDetected` and `state.detectedProvider` from AppState to both `SidebarDashboard` and `DashboardView` component renderers in `webview/src/App.tsx`

**Checkpoint**: Dashboard shows detection status on load. Verify: open sidebar, observe AI status section with detection text. No test button yet — that's US1.

---

## Phase 3: User Story 1 — Test AI Connection from Dashboard (Priority: P1) 🎯 MVP

**Goal**: Users can click "Test Connection" on the Dashboard, see a spinner during the test, then see success (model name + latency) or a categorized error message.

**Independent Test**: Click "Test Connection" on either dashboard. Spinner appears immediately. Within 10 seconds: success shows model name + latency in ms, or error shows human-readable categorized message.

### Implementation for User Story 1

- [X] T011 [US1] Add `aiTestStatus: 'idle' | 'testing' | 'success' | 'error'` and `aiTestResult` fields to `AppState` interface and `initialState` in `webview/src/App.tsx`
- [X] T012 [US1] Add `SET_AI_TEST_STATUS` local action (sets `aiTestStatus` to `'testing'` on button click) and `aiTestResult` message handler (sets status to `'success'` or `'error'`, stores result payload) to reducer in `webview/src/App.tsx`
- [X] T013 [US1] Add "Test Connection" button and result display to AI status section in `webview/src/components/SidebarDashboard.tsx` — add `aiTestStatus`, `aiTestResult`, `onTestConnection` callback to props; render `<Button variant="outline">` with `<Loader2 className="animate-spin" />` when testing, disabled when `aiTestStatus === 'testing'`; show success text (model + latencyMs) or error via `getAiErrorMessage()` below button
- [X] T014 [P] [US1] Add "Test Connection" button and result display to AI status section in `webview/src/components/DashboardView.tsx` — same props and behavior as T013; use `size="sm"` per existing button styling in DashboardView
- [X] T015 [US1] Create `handleTestAiConnection` callback in `webview/src/App.tsx` that dispatches `SET_AI_TEST_STATUS` then calls `postMessage({ type: 'testAiConnection' })`; pass `aiTestStatus`, `aiTestResult`, and `onTestConnection` props to both dashboard components

**Checkpoint**: Full test connection flow works end-to-end. Click button → spinner → result/error. Verify all 4 acceptance scenarios from spec US1.

---

## Phase 4: User Story 3+4 — Analysis Progress Updates & Cancel (Priority: P3+P4)

**Goal**: The WebView reducer handles all AI analysis event messages (started, progress, result, error) and routes them by finding ID. Cancel is already handled by the extension host — the cancelled error type flows through the standard error path.

**Independent Test**: Trigger analysis on a finding via the finding detail view. Observe that `aiAnalysisStarted` marks the finding as analyzing. Progress messages update status text. Result stores the analysis on the finding. Error (including cancel) displays categorized message. Cancel message is already sent by the existing `cancelAiAnalysis` WebView-to-extension message.

### Implementation for User Story 3+4

- [X] T016 [US3] Add `aiAnalysisStarted` reducer case in `webview/src/App.tsx` — when received, find the matching finding by `findingId` in `state.findings` or `state.currentFindings` arrays and mark it as having an in-progress analysis (set a transient `aiAnalysisStatus` or similar field); store the model name from payload
- [X] T017 [US3] Add `aiAnalysisProgress` reducer case in `webview/src/App.tsx` — update the matching finding's progress message and optional tool name for live display in the finding detail view
- [X] T018 [US3] Add `aiAnalysisResult` reducer case in `webview/src/App.tsx` — update the matching finding's `aiAnalysis` field with `msg.payload.analysis`, clear any in-progress state; this enables the existing `AiAnalysisPanel` component to render the result
- [X] T019 [US3] Add `aiAnalysisError` reducer case in `webview/src/App.tsx` — update the matching finding's error state with categorized error type and message; clear in-progress state; use `getAiErrorMessage()` from `webview/src/lib/ai-errors.ts` for display text

**Checkpoint**: All AI analysis messages are handled in the reducer. Finding detail view can show live analysis state. Cancel produces a "cancelled" error that displays correctly. Verify: TypeScript compiles, no unhandled message type warnings.

---

## Phase 5: Polish & Cross-Cutting Concerns

**Purpose**: Compilation verification and visual validation across both packages.

- [X] T020 Verify TypeScript compilation passes in both packages: run `cd vsix && npm run compile` and `cd webview && npm run build`
- [ ] T021 Visual verification: open the extension in development mode, confirm AI status section appears on both sidebar and editor panel dashboards; test with and without `~/.claude/settings.json` present

---

## Dependencies & Execution Order

### Phase Dependencies

- **Foundational (Phase 1)**: No dependencies — start immediately
- **US2 (Phase 2)**: Depends on Phase 1 (stateUpdate type must be extended first)
- **US1 (Phase 3)**: Depends on Phase 2 (needs detection UI section to add test button to)
- **US3+US4 (Phase 4)**: Depends on Phase 1 only (error utility); can run in parallel with Phase 2+3
- **Polish (Phase 5)**: Depends on all above

### User Story Dependencies

- **US2 (P2)**: Foundational only — no dependencies on other stories
- **US1 (P1)**: Depends on US2 (builds on the AI status section created by US2)
- **US3 (P3)**: Foundational only — independent of US1/US2
- **US4 (P4)**: Covered by US3 reducer cases — no additional tasks

### Within Each User Story

- AppState fields before reducer cases
- Reducer cases before UI components
- UI components before App.tsx wiring

### Parallel Opportunities

**Phase 1 parallelism**:
```
T001 (vsix messages.ts)  ──┐
T002 (webview messages.ts) ─┤── all different files, run in parallel
T005 (ai-errors.ts)        ─┘
                               then T003 + T004 in parallel (both depend on T001 type)
```

**Phase 2 parallelism**:
```
T008 (SidebarDashboard) ──┐── different files, run in parallel
T009 (DashboardView)     ──┘
```

**Cross-phase parallelism**:
```
Phase 2 (US2) ──────────── ┐
                            ├── can run in parallel after Phase 1
Phase 4 (US3+US4) ──────── ┘
```

---

## Implementation Strategy

### MVP First (US2 + US1)

1. Complete Phase 1: Foundational (types + providers + error utility)
2. Complete Phase 2: US2 (detection display on dashboards)
3. Complete Phase 3: US1 (test connection button + results)
4. **STOP and VALIDATE**: Test connection flow end-to-end
5. Ship — users can validate their AI configuration

### Incremental Delivery

1. Phase 1 → types extended, providers updated
2. + Phase 2 (US2) → dashboards show detection status
3. + Phase 3 (US1) → test connection works end-to-end (**MVP!**)
4. + Phase 4 (US3+US4) → analysis events flow through reducer
5. Each phase adds value without breaking previous work

---

## Notes

- [P] tasks = different files, no dependencies on incomplete tasks
- [Story] label maps task to specific user story for traceability
- US2 is implemented before US1 because US2 creates the AI status section that US1 extends
- US4 requires no separate tasks — cancel is handled by extension host; the error type "cancelled" flows through the US3 reducer error case
- All extension host code is already implemented (Spec 018 + 019) — this spec is WebView-focused
- Commit after each phase checkpoint
