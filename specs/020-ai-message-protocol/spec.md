# Feature Specification: AI Message Protocol and Test Connection

**Feature Branch**: `020-ai-message-protocol`
**Created**: 2026-03-20
**Status**: Draft
**Input**: User description: "AI Message Protocol and Test Connection — Extension host providers, WebView message types, Dashboard UI"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Test AI Connection from Dashboard (Priority: P1)

A user who has configured their AI provider (via Claude Code settings or VS Code settings) wants to verify the connection works before attempting to analyze findings. They open the Dashboard (either the sidebar or the editor panel) and see an AI status section. If Claude Code settings are detected, a message says "Claude Code settings detected" with a "Test Connection" button. They click the button, see a spinner while the test runs, and then see a success message showing the model name and response latency, or a clear error message explaining what went wrong.

**Why this priority**: Without the ability to test the connection, users have no way to validate their AI configuration before attempting an analysis. A broken connection discovered mid-analysis wastes time and erodes trust. This is the foundational user action for all AI features.

**Independent Test**: Can be fully tested by clicking "Test Connection" on the Dashboard and verifying the result message, independent of any finding analysis workflow.

**Acceptance Scenarios**:

1. **Given** the user has valid AI provider credentials configured, **When** they click "Test Connection" on the Dashboard, **Then** they see a spinner while the test runs, followed by a success indicator showing the model name and response latency in milliseconds.
2. **Given** the user has invalid or missing credentials, **When** they click "Test Connection", **Then** they see a categorized error message (e.g., "Credentials missing — configure your API key in VS Code Settings") within a few seconds.
3. **Given** the user's credentials are valid but the model is unavailable in their region, **When** they click "Test Connection", **Then** they see an error message indicating "Model unavailable" with guidance to check region settings.
4. **Given** a network timeout occurs during the test, **When** the test completes, **Then** the user sees a "Network error" message suggesting they check connectivity.

---

### User Story 2 - View AI Configuration Status on Dashboard (Priority: P2)

A user opens the Dashboard and sees whether their system has AI capabilities detected. If Claude Code settings are found on their machine, the Dashboard shows "Claude Code settings detected" along with the detected provider type (Bedrock or Anthropic API). If no settings are detected, the Dashboard shows setup guidance directing them to VS Code Settings to configure the AI provider.

**Why this priority**: Before testing a connection, users need to know whether the system has detected any configuration at all. This passive indicator prevents confusion when the "Test Connection" button is available but misconfigured.

**Independent Test**: Can be tested by opening the Dashboard and verifying the correct AI status indicator appears based on whether `~/.claude/settings.json` exists and contains provider configuration.

**Acceptance Scenarios**:

1. **Given** Claude Code settings exist with Bedrock configuration, **When** the Dashboard loads, **Then** the AI status section shows "Claude Code settings detected (Bedrock)" and the "Test Connection" button is available.
2. **Given** Claude Code settings exist with Anthropic API configuration, **When** the Dashboard loads, **Then** the AI status section shows "Claude Code settings detected (Anthropic API)" and the "Test Connection" button is available.
3. **Given** no Claude Code settings are detected, **When** the Dashboard loads, **Then** the AI status section shows setup guidance directing the user to configure AI settings in VS Code Settings, and the "Test Connection" button is still available (to test manually configured settings).

---

### User Story 3 - Receive AI Analysis Progress Updates (Priority: P3)

A user triggers an AI analysis on a specific finding (from the finding detail view). They see real-time progress updates as the analysis proceeds — including status text and the name of any tool the AI is currently using. When the analysis completes, they see the full result with the AI's explanation, risk assessment, and suggested fix. If the analysis fails, they see a categorized error message.

**Why this priority**: While the analysis trigger and result display are part of the finding detail UI (separate spec), the message protocol that carries these events between extension host and WebView must be defined here to ensure both sides agree on the contract.

**Independent Test**: Can be tested by triggering an analysis and observing that progress messages, result messages, and error messages all arrive in the WebView with the correct structure and content.

**Acceptance Scenarios**:

1. **Given** the user triggers AI analysis on a finding, **When** the analysis starts, **Then** the WebView receives an `aiAnalysisStarted` event with the finding ID and model name.
2. **Given** analysis is in progress, **When** the AI uses a tool (e.g., reads a file), **Then** the WebView receives an `aiAnalysisProgress` event with a human-readable status message and the tool name.
3. **Given** analysis completes successfully, **When** the result is ready, **Then** the WebView receives an `aiAnalysisResult` event containing the full analysis object and metadata (model, cost, tools used).
4. **Given** analysis fails, **When** the error occurs, **Then** the WebView receives an `aiAnalysisError` event with a categorized error type and human-readable message.
5. **Given** the user cancels an in-progress analysis, **When** the cancellation is sent, **Then** the analysis stops and the WebView receives an error event with type "cancelled".

---

### User Story 4 - Cancel an In-Progress AI Analysis (Priority: P4)

A user who has triggered an AI analysis decides they want to cancel it (e.g., it's taking too long or they selected the wrong finding). They click a "Cancel" action, which sends a cancellation message to the extension host. The extension host aborts the analysis and the WebView updates to reflect the cancelled state.

**Why this priority**: Cancellation is a safety valve. While not on the critical path, users must be able to stop an analysis that consumes budget or time unexpectedly.

**Independent Test**: Can be tested by triggering an analysis, cancelling it, and verifying the analysis stops and the UI reflects the cancellation.

**Acceptance Scenarios**:

1. **Given** an AI analysis is in progress for a finding, **When** the user sends a `cancelAiAnalysis` message, **Then** the extension host aborts the analysis and the WebView receives an error event with type "cancelled".
2. **Given** no analysis is in progress for the specified finding, **When** a `cancelAiAnalysis` message is sent, **Then** the message is silently ignored with no error.

---

### Edge Cases

- What happens when the user clicks "Test Connection" while a test is already in progress? The button is disabled during testing to prevent duplicate requests.
- What happens when the extension host has no AI service initialized? The test returns a clear error message rather than silently failing.
- What happens when the `stateUpdate` message is sent before Claude settings detection completes? The `claudeSettingsDetected` field defaults to `false` until detection finishes, then a follow-up `stateUpdate` is sent with updated values.
- What happens when the user's network drops mid-analysis? The analysis times out and returns a `network_error` categorized error.
- What happens when multiple findings are being analyzed simultaneously? Each analysis is independent — progress and results are routed by finding ID.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The extension host MUST send the following message types to the WebView: `aiTestResult`, `aiAnalysisStarted`, `aiAnalysisProgress`, `aiAnalysisResult`, `aiAnalysisError`.
- **FR-002**: The WebView MUST be able to send the following message types to the extension host: `testAiConnection`, `analyzeFinding` (with finding ID), `cancelAiAnalysis` (with finding ID).
- **FR-003**: Message types MUST be defined in both the extension host type file and the WebView type file, following the existing type duplication pattern used by the project.
- **FR-004**: The `stateUpdate` message payload MUST include a `claudeSettingsDetected` boolean and a `detectedProvider` string (`'bedrock'`, `'anthropic-api'`, or `'none'`) so the WebView knows whether AI configuration exists.
- **FR-005**: The extension host MUST handle the `testAiConnection` message by reading current settings, invoking the AI service's test connection method, and sending an `aiTestResult` message back to the WebView.
- **FR-006**: The `aiTestResult` payload MUST include: success boolean, model name (on success), latency in milliseconds, and on failure an error object with a categorized type and human-readable message.
- **FR-007**: Error types MUST include at minimum: `credentials_missing`, `auth_failed`, `model_unavailable`, `network_error`, and `unknown`.
- **FR-008**: The Dashboard (both the editor panel `DashboardView` and the sidebar `SidebarDashboard`) MUST display an AI status section that shows whether Claude Code settings were detected, the detected provider type, and a "Test Connection" button.
- **FR-009**: When `claudeSettingsDetected` is `true`, the AI status section MUST show a message indicating detected settings and the provider type (e.g., "Claude Code settings detected (Bedrock)").
- **FR-010**: When `claudeSettingsDetected` is `false`, the AI status section MUST show setup guidance directing the user to VS Code Settings to configure the AI provider.
- **FR-011**: The "Test Connection" button MUST show an inline loading indicator (spinner) while the test is in progress.
- **FR-012**: On test success, the Dashboard MUST display the model name and response latency.
- **FR-013**: On test failure, the Dashboard MUST display a human-readable error message based on the error category.
- **FR-014**: The "Test Connection" button MUST be disabled while a test is already in progress to prevent duplicate requests.
- **FR-015**: The `aiAnalysisStarted` payload MUST include the finding ID and model name.
- **FR-016**: The `aiAnalysisProgress` payload MUST include the finding ID, a human-readable status message, and an optional tool name.
- **FR-017**: The `aiAnalysisResult` payload MUST include the finding ID, the full analysis object (explanation, risk assessment, suggested fix), and metadata (model, cost, tools used).
- **FR-018**: The `aiAnalysisError` payload MUST include the finding ID, a categorized error type, and a human-readable message.
- **FR-019**: The `cancelAiAnalysis` message MUST include the finding ID to identify which analysis to cancel.

### Key Entities

- **AI Connection Test Result**: Represents the outcome of a connection test — success/failure, model name, latency, and categorized error details.
- **AI Analysis Event**: A stream of events (started, progress, result, error) tied to a specific finding ID, carrying real-time updates from the extension host to the WebView.
- **Claude Settings Detection**: A passive detection result indicating whether AI provider configuration exists on the user's machine and which provider type was found.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can verify their AI connection works within 10 seconds of clicking "Test Connection", receiving either a success confirmation or a categorized error message.
- **SC-002**: Users see their AI configuration status (detected/not detected, provider type) immediately when the Dashboard loads, without needing to take any action.
- **SC-003**: During AI analysis, users receive at least one progress update within 5 seconds of the analysis starting, confirming the system is working.
- **SC-004**: 100% of connection test errors are categorized into a recognized error type with a human-readable message — no raw exception text is shown to users.
- **SC-005**: Users can cancel an in-progress AI analysis and see the UI reflect the cancellation within 2 seconds.

## Assumptions

- The AI service and provider abstraction (Spec 018) are available and expose `testConnection()` and `analyzeFinding()` methods.
- The Claude settings detector (Spec 019) is available and provides `claudeSettingsDetected` and `detectedProvider` values.
- The existing type duplication pattern (manual sync between `vsix/src/models/` and `webview/src/types/`) is the established convention and will be followed.
- The Dashboard views (`DashboardView` and `SidebarDashboard`) already exist and can be extended with a new AI status section.
- The `stateUpdate` message is sent on initial load and after state changes, making it the appropriate vehicle for delivering Claude settings detection status.

## Dependencies

- **Spec 018** (AI Provider Abstraction): Provides `AiService`, `AiProvider` interface, `ConnectionTestResult`, `AnalysisEvent` types.
- **Spec 019** (Settings Inheritance): Provides `detectClaudeSettings()` and `ClaudeSettingsDetection` type.
