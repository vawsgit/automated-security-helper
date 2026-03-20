# Research: AI Message Protocol and Test Connection

**Feature**: 020-ai-message-protocol
**Date**: 2026-03-20

## Decision 1: Message Type Definitions — Already Implemented

**Decision**: All AI message types (ExtToWebview and WebviewToExt) are already defined in both `vsix/src/models/messages.ts` and `webview/src/types/messages.ts` from Spec 018 implementation.

**Rationale**: The types were added proactively during the AI provider abstraction work. They follow the existing discriminated union pattern with `type` field as discriminant.

**Current state**:
- ExtToWebview: `aiAnalysisStarted`, `aiAnalysisProgress`, `aiAnalysisResult`, `aiAnalysisError`, `aiTestResult` — all defined
- WebviewToExt: `testAiConnection`, `analyzeFinding`, `cancelAiAnalysis` — all defined
- Types are in sync between vsix and webview

**Remaining work**: None for type definitions. The protocol contract is complete.

## Decision 2: stateUpdate Payload — Needs Extension

**Decision**: Add `claudeSettingsDetected` and `detectedProvider` fields to the existing `stateUpdate` message payload.

**Rationale**: The `stateUpdate` message is already sent on initial load and after state changes from both `SidebarWebviewProvider.queryStateAndPost()` and `FindingsPanelManager.postStateUpdate()`. Both providers already have access to `ClaudeSettingsDetection` via setter methods. Adding fields to the existing message avoids introducing a new message type.

**Alternatives considered**:
- Separate `aiConfigStatus` message type — rejected; adds complexity, creates ordering dependency (WebView would need to handle stateUpdate + aiConfigStatus independently)
- Include in `init` message — rejected; init is context-specific (sidebar vs editorPanel vs sink), detection info should be available on every state refresh

**Current state**:
- `stateUpdate` payload: `{ scans, summary, scanTargets, scanRoot }` — missing AI fields
- `ClaudeSettingsDetection` interface exists: `{ claudeSettingsDetected: boolean; detectedProvider: 'bedrock' | 'anthropic-api' | 'none' }`
- Both providers have `this.claudeSettingsDetection` instance variable populated at extension activation
- Default when detection hasn't completed: `{ claudeSettingsDetected: false, detectedProvider: 'none' }`

**Remaining work**: Add 2 fields to stateUpdate type, include in both provider methods, handle in WebView reducer.

## Decision 3: Extension Host Handlers — Mostly Implemented

**Decision**: Use existing handler patterns. testAiConnection is in SidebarWebviewProvider. analyzeFinding/cancelAiAnalysis are in FindingsPanelManager.

**Rationale**: The sidebar is where the dashboard lives (test connection), while finding analysis happens in the editor panel (FindingsPanelManager). This matches the existing responsibility split.

**Current state**:
- `SidebarWebviewProvider.handleTestAiConnection()` — fully implemented, calls `aiService.testConnection()`, posts `aiTestResult`
- `FindingsPanelManager` handles `analyzeFinding` (lines 513-543) with full event relay and `cancelAiAnalysis` (lines 545-549)
- `AiService.testConnection()` and `AiService.analyzeFinding()` — fully implemented
- All wiring in `extension.ts` is complete (AiService created, passed to both providers)

**Remaining work**: None for extension host handlers.

## Decision 4: WebView State Management — Needs Building

**Decision**: Add AI-related fields to AppState and implement reducer case handlers for all 5 AI message types.

**Rationale**: The WebView currently has zero AI state management. Types are defined but no reducer cases exist. The `AiAnalysisPanel` component exists but only renders completed analyses (no loading/error/progress states).

**Current state**:
- AppState has no AI fields (no connectionTest state, no analysisProgress tracking)
- Reducer has no case handlers for AI messages
- `AiAnalysisPanel` is read-only, renders only when `analysis` prop is truthy

**New AppState fields needed**:
- `claudeSettingsDetected: boolean` — from stateUpdate
- `detectedProvider: 'bedrock' | 'anthropic-api' | 'none'` — from stateUpdate
- `aiTestStatus: 'idle' | 'testing' | 'success' | 'error'` — tracks test button state
- `aiTestResult: { model?: string; latencyMs: number; error?: { type: string; message: string } } | null` — last test result

**New reducer cases needed**:
- `aiTestResult` — update aiTestStatus and aiTestResult
- `aiAnalysisStarted`, `aiAnalysisProgress`, `aiAnalysisResult`, `aiAnalysisError` — update per-finding analysis state (these are scoped to finding detail, may be tracked at the finding level rather than global state)

**Remaining work**: Full implementation of state management and reducer cases.

## Decision 5: Dashboard UI — Needs Building

**Decision**: Add an AI status section to both `DashboardView` and `SidebarDashboard` components, positioned after existing scan summary sections.

**Rationale**: Both dashboard views exist and follow consistent patterns. The AI status section is a new card/section that shows detection status and test connection results. Follows the existing SummaryCard pattern in DashboardView and separator-based sections in SidebarDashboard.

**Current state**:
- `DashboardView` — 3-column grid (Active Findings, Scan Targets, Triage Progress), scan target cards, quick actions bar
- `SidebarDashboard` — vertical stack with buttons, scan targets, triage progress, severity breakdown
- Neither has any AI-related UI

**UI approach**:
- `SidebarDashboard`: New section after the Suppressions button, before the Active Scan section. Shows detection status text, "Test Connection" outline button, result/error inline below button.
- `DashboardView`: New SummaryCard in the existing grid or a dedicated section. Shows detection status, test button, result display.
- Both use `variant="outline"` for the test button per constitution (button treatment convention).
- Spinner uses `Loader2` from lucide-react with `animate-spin` (existing pattern in codebase).

**Remaining work**: Full implementation of UI components in both dashboard views.

## Decision 6: Error Message Mapping

**Decision**: Map `AnalysisErrorType` values to human-readable messages in the WebView.

**Rationale**: The extension host sends categorized error types (from `aiProvider.ts`). The WebView should display user-friendly messages. Keeping the mapping in the WebView allows localization in the future without changing the protocol.

**Error type mapping**:
| Error Type | Display Message |
|---|---|
| `credentials_missing` | "No API credentials found. Configure your AI provider in Settings." |
| `auth_failed` | "Authentication failed. Check your API key or AWS credentials." |
| `model_unavailable` | "Model not available. Check your region and model settings." |
| `network_error` | "Network error. Check your internet connection and try again." |
| `budget_exceeded` | "Analysis budget exceeded." |
| `max_turns_exceeded` | "Analysis reached maximum turns limit." |
| `cancelled` | "Analysis cancelled." |
| `unknown` | "An unexpected error occurred. Check the ASH output channel for details." |

**Remaining work**: Implement error message mapping utility in webview.
