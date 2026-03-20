# Implementation Plan: AI Message Protocol and Test Connection

**Feature Branch**: `020-ai-message-protocol`
**Created**: 2026-03-20
**Spec**: [spec.md](spec.md)
**Research**: [research.md](research.md)

## Technical Context

### Current State

The AI message protocol is partially implemented from Spec 018 (AI Provider Abstraction) and Spec 019 (Settings Inheritance):

**Already built (no changes needed)**:
- All 8 AI message types defined in both `vsix/src/models/messages.ts` and `webview/src/types/messages.ts`
- `SidebarWebviewProvider.handleTestAiConnection()` — handles `testAiConnection`, calls `AiService.testConnection()`, posts `aiTestResult`
- `FindingsPanelManager` — handles `analyzeFinding` (with full event relay) and `cancelAiAnalysis`
- `AiService` — `testConnection()`, `analyzeFinding()`, `cancelAnalysis()` fully implemented
- `ClaudeSettingsDetector` — `detectClaudeSettings()` returns `ClaudeSettingsDetection`
- Extension activation wiring — AiService and ClaudeSettingsDetection passed to both providers
- `AiAnalysisPanel` component — renders completed analysis results (explanation, risk, fix, references)
- `AiProvider` interface with `ConnectionTestResult`, `AnalysisEvent` types
- Error type taxonomy (`AnalysisErrorType` with 9 categories)

**Needs building**:
1. Add `claudeSettingsDetected` and `detectedProvider` to `stateUpdate` message payload (type + sender + receiver)
2. WebView reducer case handlers for all 5 AI message types
3. WebView AppState fields for AI connection status and test results
4. Dashboard AI status section UI in both `DashboardView` and `SidebarDashboard`
5. Error message mapping utility in WebView

### Dependencies

| Dependency | Status | Impact |
|---|---|---|
| Spec 018 (AiService, AiProvider) | Implemented | All extension host handlers ready |
| Spec 019 (ClaudeSettingsDetector) | Implemented | Detection available in both providers |
| ShadCN components | Available | Button, Badge, Alert, Separator already installed |
| lucide-react icons | Available | Loader2, Wifi, WifiOff, CheckCircle, AlertCircle available |

### Technologies

- TypeScript (strict mode) — both vsix and webview packages
- React 19 — `useReducer` state management, functional components
- ShadCN/ui — Button (outline variant), Badge, Alert components
- Tailwind CSS v4 — utility classes, `animate-spin` for spinner
- VS Code WebView API — `postMessage` for bidirectional communication

## Constitution Check

| Principle | Status | Notes |
|---|---|---|
| I. VS Code Native | PASS | No external services; uses `postMessage` protocol |
| II. Extension Host Owns State | PASS | All business logic in vsix/; WebView is pure renderer; typed messages only |
| III. Ship Fast / Simplicity First | PASS | Extends existing patterns; no new abstractions; minimal new state |
| IV. Typed Contracts at Boundaries | PASS | Discriminated unions; strict types; manual sync between packages |
| V. Theme Integration | PASS | Uses VS Code theme variables; `variant="outline"` buttons; domain colors from theme-colors.ts |
| VI. Security by Default | PASS | No new CSP changes; sanitized display of error messages |

## Implementation Phases

### Phase 1: Extend stateUpdate Protocol (Extension Host)

**Goal**: Add Claude settings detection data to the stateUpdate message flow.

**Files to modify**:

1. **`vsix/src/models/messages.ts`** — Add `claudeSettingsDetected` and `detectedProvider` to `stateUpdate` payload type
2. **`webview/src/types/messages.ts`** — Mirror the same type change (manual sync)
3. **`vsix/src/providers/sidebarWebviewProvider.ts`** — Include detection fields in `queryStateAndPost()` payload
4. **`vsix/src/providers/findingsPanelManager.ts`** — Include detection fields in `postStateUpdate()` payload

**Implementation details**:
- Both providers already have `this.claudeSettingsDetection` (set via `setClaudeSettingsDetection()`)
- Default to `{ claudeSettingsDetected: false, detectedProvider: 'none' }` when detection is undefined
- No new imports needed — `ClaudeSettingsDetection` type already imported

**Verification**: TypeScript compilation passes in both packages. Existing stateUpdate consumers still work.

### Phase 2: WebView State Management

**Goal**: Add AI-related fields to AppState and implement reducer handlers.

**Files to modify**:

1. **`webview/src/App.tsx`** — Extend `AppState` interface, `initialState`, and reducer

**New AppState fields**:
```
claudeSettingsDetected: boolean          (default: false)
detectedProvider: 'bedrock' | 'anthropic-api' | 'none'  (default: 'none')
aiTestStatus: 'idle' | 'testing' | 'success' | 'error'  (default: 'idle')
aiTestResult: { success: boolean; model?: string; latencyMs: number; error?: { type: string; message: string } } | null  (default: null)
```

**New reducer cases**:
- `stateUpdate` — extend existing handler to also set `claudeSettingsDetected` and `detectedProvider`
- `aiTestResult` — set `aiTestStatus` to `'success'` or `'error'`, store result payload in `aiTestResult`
- `aiAnalysisStarted` — update finding's analysis state (mark in-progress)
- `aiAnalysisProgress` — update finding's progress message (for finding detail view — may be deferred if finding detail UI is a separate spec)
- `aiAnalysisResult` — update finding's `aiAnalysis` field with result
- `aiAnalysisError` — update finding's error state

**Note**: The `aiAnalysisStarted/Progress/Result/Error` handlers update per-finding state. The reducer should update the relevant finding in the `findings` or `currentFindings` array. This enables `AiAnalysisPanel` to show live analysis state when viewing a finding detail.

**Verification**: Reducer handles all AI message types. TypeScript compiles. No runtime errors when messages arrive.

### Phase 3: Error Message Mapping Utility

**Goal**: Centralized mapping from error type codes to user-friendly messages.

**Files to create**:

1. **`webview/src/lib/ai-errors.ts`** — Export `getAiErrorMessage(errorType: string): string`

**Implementation**:
```
credentials_missing → "No API credentials found. Configure your AI provider in Settings."
auth_failed → "Authentication failed. Check your API key or AWS credentials."
model_unavailable → "Model not available. Check your region and model settings."
network_error → "Network error. Check your internet connection and try again."
budget_exceeded → "Analysis budget exceeded."
max_turns_exceeded → "Analysis reached maximum turns limit."
format_error → "AI response could not be parsed. Try again."
cancelled → "Analysis cancelled."
unknown → "An unexpected error occurred. Check the ASH output channel for details."
```

Fallback for unrecognized types: same as `unknown`.

**Verification**: All known error types produce distinct messages. Unknown types produce a safe fallback.

### Phase 4: Dashboard UI — SidebarDashboard

**Goal**: Add AI status section to the sidebar dashboard.

**Files to modify**:

1. **`webview/src/components/SidebarDashboard.tsx`** — Add AI status section

**Props changes**: Add `claudeSettingsDetected`, `detectedProvider`, `aiTestStatus`, `aiTestResult` to `SidebarDashboardProps`.

**UI structure** (inserted after Suppressions button, before Active Scan section):
```
<Separator />
<div>  <!-- AI Status section -->
  <h3>AI Analysis</h3>

  {claudeSettingsDetected ? (
    <p>"Claude Code detected ({provider})"</p>
  ) : (
    <p>"Configure AI in Settings"</p>
  )}

  <Button variant="outline" onClick={testAiConnection} disabled={aiTestStatus === 'testing'}>
    {aiTestStatus === 'testing' ? <Loader2 spin /> : <Wifi />}
    Test Connection
  </Button>

  {aiTestStatus === 'success' && (
    <p>Connected: {model} ({latencyMs}ms)</p>
  )}

  {aiTestStatus === 'error' && (
    <p class="text-destructive">{errorMessage}</p>
  )}
</div>
```

**Behavior**:
- Button disabled during test (`aiTestStatus === 'testing'`)
- Spinner replaces icon during test
- Success shows model name + latency
- Error shows mapped error message (from Phase 3 utility)
- Detection status always visible regardless of test state

**Verification**: Visual check in Kitchen Sink or development mode. Button disabled during test. Results display correctly.

### Phase 5: Dashboard UI — DashboardView

**Goal**: Add AI status section to the editor panel dashboard.

**Files to modify**:

1. **`webview/src/components/DashboardView.tsx`** — Add AI status section

**Props changes**: Add same AI-related props as SidebarDashboard.

**UI structure** (new section after the 3-column summary grid, before Scan Targets):
```
<Separator />
<div>  <!-- AI Status section -->
  <div className="flex items-center gap-2">
    <h3>AI Analysis</h3>
    {claudeSettingsDetected ? (
      <Badge variant="outline">{detectedProvider}</Badge>
    ) : (
      <Badge variant="outline">Not configured</Badge>
    )}
  </div>

  <div className="flex items-center gap-3">
    <Button variant="outline" size="sm" onClick={testAiConnection} disabled={testing}>
      {testing ? <Loader2 spin /> : <Wifi />}
      Test Connection
    </Button>

    {success && <span>✓ {model} ({latencyMs}ms)</span>}
    {error && <span class="text-destructive">{errorMessage}</span>}
  </div>

  {!claudeSettingsDetected && (
    <p>Configure your AI provider in VS Code Settings (ashWorkbench.llm)</p>
  )}
</div>
```

**Verification**: Visual check. Consistent with sidebar behavior. Test button works from editor panel dashboard.

### Phase 6: Wire Props Through App.tsx

**Goal**: Pass AI state from AppState down to Dashboard components.

**Files to modify**:

1. **`webview/src/App.tsx`** — Pass new props to `SidebarDashboard` and `DashboardView` renderers

**Implementation**:
- In sidebar context: pass `state.claudeSettingsDetected`, `state.detectedProvider`, `state.aiTestStatus`, `state.aiTestResult` to `SidebarDashboard`
- In editor panel dashboard view: pass same props to `DashboardView`
- Add `testAiConnection` handler: `() => { dispatch({ type: 'SET_AI_TEST_STATUS', payload: 'testing' }); postMessage({ type: 'testAiConnection' }); }`
- The dispatch sets local state to `testing` immediately (optimistic UI for spinner), then `aiTestResult` message from extension host resolves the state

**New reducer action** (local, not from extension host):
- `SET_AI_TEST_STATUS` — sets `aiTestStatus` to `'testing'` when user clicks button (enables immediate spinner feedback)

**Verification**: Props flow correctly. Test button triggers postMessage. Spinner appears immediately on click. Result updates UI on response.

### Phase 7: Unit Tests

**Goal**: Test the new reducer cases and error mapping utility.

**Files to create/modify**:

1. **`webview/src/lib/__tests__/ai-errors.test.ts`** (or appropriate test location) — Test error message mapping
2. Verify reducer test coverage for new AI cases if test infrastructure exists

**Test cases**:
- `getAiErrorMessage('credentials_missing')` returns expected string
- `getAiErrorMessage('unknown_type')` returns fallback message
- Reducer: `stateUpdate` with detection fields updates AppState
- Reducer: `aiTestResult` success updates status and result
- Reducer: `aiTestResult` failure updates status and error

**Verification**: All tests pass. No regressions in existing tests.

## File Inventory

### Modified Files

| File | Phase | Change |
|---|---|---|
| `vsix/src/models/messages.ts` | 1 | Add 2 fields to stateUpdate payload type |
| `webview/src/types/messages.ts` | 1 | Mirror stateUpdate type change |
| `vsix/src/providers/sidebarWebviewProvider.ts` | 1 | Include detection in queryStateAndPost() |
| `vsix/src/providers/findingsPanelManager.ts` | 1 | Include detection in postStateUpdate() |
| `webview/src/App.tsx` | 2, 6 | AppState fields, reducer cases, prop passing |
| `webview/src/components/SidebarDashboard.tsx` | 4 | AI status section |
| `webview/src/components/DashboardView.tsx` | 5 | AI status section |

### New Files

| File | Phase | Purpose |
|---|---|---|
| `webview/src/lib/ai-errors.ts` | 3 | Error type to message mapping |

### No Changes Needed

| File | Reason |
|---|---|
| `vsix/src/services/aiService.ts` | Already complete (Spec 018) |
| `vsix/src/services/aiProvider.ts` | Already complete (Spec 018) |
| `vsix/src/services/claudeSettingsDetector.ts` | Already complete (Spec 019) |
| `vsix/src/extension.ts` | Wiring already complete |
| `webview/src/components/AiAnalysisPanel.tsx` | Renders completed analysis; progress states are a separate concern |

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| stateUpdate type change breaks existing consumers | Low | Medium | Both senders add fields with defaults; reducer spreads existing state |
| Test connection slow on first call (lazy provider init) | Medium | Low | Spinner provides feedback; 10s timeout in success criteria |
| Sidebar doesn't forward testAiConnection to editor panel | None | N/A | Sidebar handles testAiConnection directly; editor panel has its own dashboard |
| Type sync drift between vsix and webview | Low | High | Phase 1 modifies both files atomically; TypeScript catches mismatches at compile |

## Implementation Order & Dependencies

```
Phase 1 (stateUpdate extension)
  ↓
Phase 2 (WebView state management)  ←  depends on Phase 1 types
  ↓
Phase 3 (error mapping utility)     ←  independent, but used by Phase 4/5
  ↓
Phase 4 (SidebarDashboard UI)       ←  depends on Phase 2 state + Phase 3 errors
  ↓
Phase 5 (DashboardView UI)          ←  depends on Phase 2 state + Phase 3 errors
  ↓
Phase 6 (App.tsx wiring)            ←  depends on Phase 4/5 props
  ↓
Phase 7 (tests)                     ←  depends on all above
```

Note: Phases 3-5 can be developed in parallel once Phase 2 is complete. Phase 6 is the integration step that wires everything together.
