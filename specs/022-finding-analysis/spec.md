# Feature Specification: Finding Analysis — Core AI Feature

**Feature Branch**: `022-finding-analysis`
**Created**: 2026-03-20
**Status**: Draft
**Input**: User description: "Finding Analysis -- Core AI Feature. End-to-end finding analysis: user clicks Analyze on a finding, Claude agent reads source code, analyzes the vulnerability, returns structured analysis displayed in UI and persisted to database."

## Clarifications

### Session 2026-03-20

- Q: Should `list_related_findings` return findings from the current scan only, or across all historical scans? → A: Current scan only — agent sees related findings from the same scan run.
- Q: When max turns is exceeded without valid structured output, should the system attempt to extract partial results or always error? → A: Always error — max turns exceeded is always an error; user can retry with a higher turns setting.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Analyze a Security Finding (Priority: P1)

A developer reviewing scan results wants to understand a specific finding in depth. They select a finding from the findings list, see its details, and click the "Analyze" button. The system invokes an AI agent that reads the relevant source code, assesses the vulnerability's risk, and returns a structured analysis — all without the developer needing to leave VS Code.

**Why this priority**: This is the core value proposition. Without triggering analysis and receiving results, no other AI feature delivers value.

**Independent Test**: Can be fully tested by selecting any finding with a valid file path, clicking "Analyze," and verifying the structured analysis appears. Delivers immediate value: the developer gets expert-level vulnerability assessment without manual triage.

**Acceptance Scenarios**:

1. **Given** a finding exists with `aiAnalysis` = null, **When** the user views the finding detail, **Then** an "Analyze" button is visible and enabled.
2. **Given** the user clicks "Analyze" on a finding, **When** the analysis starts, **Then** the button is replaced by a progress indicator showing the agent's current activity (e.g., "Reading auth.py…", "Searching for injection patterns…").
3. **Given** analysis completes successfully, **When** the result is returned, **Then** the AiAnalysisPanel displays the explanation, risk assessment, suggested fix, and references.
4. **Given** a finding already has a persisted `aiAnalysis`, **When** the user views the finding detail, **Then** the AiAnalysisPanel renders the stored result immediately without requiring a new analysis.
5. **Given** the user clicks "Analyze" on a finding that already has an analysis, **When** analysis completes, **Then** the previous analysis is overwritten with the new result.

---

### User Story 2 - Monitor Analysis Progress (Priority: P2)

While the AI agent is working, the developer wants visibility into what it's doing. Progress messages stream to the finding detail view so the developer knows the agent is actively reading files, searching code, and reasoning about the vulnerability — building confidence that the analysis is thorough.

**Why this priority**: Without progress feedback, the developer sees a spinner for 30+ seconds with no context, leading to uncertainty and premature cancellation. Progress indicators turn waiting time into trust-building transparency.

**Independent Test**: Can be tested by triggering analysis and verifying that progress messages appear in sequence, each reflecting a distinct agent activity, before the final result renders.

**Acceptance Scenarios**:

1. **Given** analysis is in progress, **When** the agent reads a file, **Then** a progress message appears (e.g., "Reading src/auth.py…").
2. **Given** analysis is in progress, **When** the agent uses a search tool, **Then** a progress message appears (e.g., "Searching for SQL injection patterns…").
3. **Given** multiple progress messages arrive, **When** a new message arrives, **Then** the most recent message replaces the previous one (no accumulating log).
4. **Given** analysis is in progress, **When** the developer switches to another finding and returns, **Then** the progress state is preserved (still showing the latest message if analysis is ongoing).

---

### User Story 3 - Cancel an In-Flight Analysis (Priority: P2)

A developer realizes they triggered analysis on the wrong finding, or decides the analysis is taking too long. They click the "Cancel" button to abort the analysis immediately and free up resources.

**Why this priority**: Without cancellation, the developer is stuck waiting for an analysis they no longer want, wasting budget and time. Cancellation is essential for a responsive, user-controlled experience.

**Independent Test**: Can be tested by triggering analysis, clicking "Cancel" during progress, and verifying the analysis stops and the UI returns to the pre-analysis state.

**Acceptance Scenarios**:

1. **Given** analysis is in progress, **When** the developer clicks "Cancel," **Then** the analysis stops, the progress indicator disappears, and the "Analyze" button becomes available again.
2. **Given** analysis is cancelled, **When** the cancellation completes, **Then** no partial result is persisted to the database.
3. **Given** analysis is cancelled, **When** the developer clicks "Analyze" again, **Then** a fresh analysis starts from scratch.

---

### User Story 4 - View Analysis Metadata (Priority: P3)

After analysis completes, the developer wants to know how much the analysis cost, which model was used, and what tools the agent employed. This metadata helps gauge the quality and cost-efficiency of the analysis.

**Why this priority**: Metadata supports informed decision-making (Is this model giving good results? Am I within budget?) but is not essential for core functionality.

**Independent Test**: Can be tested by completing an analysis and verifying the metadata section displays model, cost, and tools used.

**Acceptance Scenarios**:

1. **Given** analysis has completed, **When** the developer views the finding detail, **Then** a collapsible "Analysis Details" section shows the model name, cost, timestamp, and list of tools used.
2. **Given** the metadata section is rendered, **When** the developer collapses it, **Then** it remains collapsed until explicitly expanded (does not interfere with the main analysis content).
3. **Given** multiple findings have been analyzed, **When** the developer navigates between them, **Then** each finding displays its own metadata.

---

### User Story 5 - Handle Analysis Errors Gracefully (Priority: P3)

When analysis fails — due to missing credentials, exhausted budget, network issues, or model unavailability — the developer sees a clear, actionable error message instead of a generic failure.

**Why this priority**: Error handling ensures the feature degrades gracefully. Without it, failures are confusing and unrecoverable.

**Independent Test**: Can be tested by simulating each error condition and verifying the appropriate message appears with guidance.

**Acceptance Scenarios**:

1. **Given** analysis fails due to missing credentials, **When** the error is displayed, **Then** the message guides the developer to configure their provider credentials.
2. **Given** analysis fails due to budget exceeded, **When** the error is displayed, **Then** the message shows how much was spent and suggests increasing the budget setting.
3. **Given** analysis fails for any reason, **When** the error is displayed, **Then** the "Analyze" button becomes available again so the developer can retry.
4. **Given** analysis encounters a transient network error, **When** the error is displayed, **Then** the message suggests the developer retry.

---

### User Story 6 - AI Agent Accesses Finding Context via Custom Tools (Priority: P2)

The AI agent has access to custom tools that retrieve structured finding data from the extension's database. This gives the agent richer context than just the code snippet — it can see related findings, full finding metadata, and surrounding code — leading to more accurate and contextual analysis.

**Why this priority**: Without enriched context, the agent analyzes findings in isolation. Custom tools that surface related findings and full context significantly improve analysis quality by revealing patterns (e.g., the same vulnerability appearing in multiple files).

**Independent Test**: Can be tested by analyzing a finding and verifying that the agent's tool usage log includes the custom context tools (visible in the metadata section).

**Acceptance Scenarios**:

1. **Given** the agent is analyzing a finding, **When** it needs more context, **Then** it can retrieve the full finding details plus surrounding code lines from the database.
2. **Given** the agent is analyzing a finding, **When** it searches for patterns, **Then** it can list related findings from the current scan that share the same rule, scanner, or file.
3. **Given** the agent uses a custom context tool, **When** the tool executes, **Then** the progress indicator shows what the agent is doing (e.g., "Retrieving finding context…", "Searching for related findings…").

---

### Edge Cases

- What happens when the finding references a file that no longer exists or has been moved? The analysis proceeds with the available context (snippet, rule, description) and notes the file is inaccessible.
- What happens when multiple developers trigger analysis on the same finding simultaneously? The system rejects duplicate concurrent analyses on the same finding with a user-friendly message ("Analysis already in progress for this finding").
- What happens when the user navigates away from the finding detail mid-analysis? The analysis continues in the background; returning to the finding shows the latest progress or completed result.
- What happens when the workspace has no files (empty project)? The agent analyzes based on the finding metadata alone and notes the limited context.
- What happens when the maximum concurrent analysis limit (5) is reached? The system rejects new analysis requests with a message indicating the user should wait for an in-progress analysis to complete.
- What happens when the analysis exceeds the configured budget mid-execution? The analysis stops and returns a budget-exceeded error with the amount consumed.
- What happens when the analysis exceeds the configured maximum turns? The analysis stops and returns a max-turns-exceeded error. No partial results are displayed or persisted. The user can retry with a higher turns setting.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST display an "Analyze" button on any finding that has no existing AI analysis.
- **FR-002**: System MUST display both a "Re-analyze" option and the existing analysis for findings that already have an AI analysis.
- **FR-003**: System MUST stream real-time progress messages to the finding detail view during analysis, showing the agent's current activity.
- **FR-004**: System MUST display the final structured analysis (explanation, risk assessment, suggested fix, references) upon successful completion.
- **FR-005**: System MUST persist the analysis result and metadata to the database on successful completion.
- **FR-006**: System MUST overwrite any existing analysis when a new analysis completes successfully.
- **FR-007**: System MUST support cancellation of in-progress analysis via a "Cancel" button.
- **FR-008**: System MUST NOT persist partial results when analysis is cancelled.
- **FR-009**: System MUST display categorized error messages when analysis fails, with guidance appropriate to the error type (credentials, budget, network, model availability).
- **FR-010**: System MUST enforce a per-analysis budget limit as configured in settings, stopping analysis if the limit is exceeded.
- **FR-011**: System MUST enforce a maximum turns limit as configured in settings, stopping analysis if the limit is exceeded.
- **FR-012**: System MUST restrict the AI agent's tool access based on the configured tool mode (read-only or full).
- **FR-013**: System MUST provide the AI agent with custom tools to retrieve full finding context and list related findings from the current scan (same rule, scanner, or file).
- **FR-014**: System MUST display analysis metadata (model, cost, timestamp, tools used) in a collapsible section after analysis completes.
- **FR-015**: System MUST reject duplicate concurrent analysis requests on the same finding.
- **FR-016**: System MUST enforce a maximum of 5 concurrent analyses across all findings, rejecting additional requests with a user-friendly message.
- **FR-017**: System MUST continue background analysis when the user navigates away from the finding, showing results when the user returns.
- **FR-018**: System MUST build the analysis prompt with the finding's title, description, severity, scanner, rule ID, file path, line numbers, and code snippet.

### Key Entities

- **Finding**: A security vulnerability detected by a scanner. Contains rule information, severity, file location, code snippet, and optional AI analysis. The central entity that analysis is performed on.
- **AI Analysis**: The structured result of AI analysis. Contains an explanation of the vulnerability, a three-dimensional risk assessment (exploitability, impact, likelihood), an optional suggested fix with diff, and references. Stored as part of the finding.
- **Analysis Metadata**: Operational data about the analysis run. Contains the model used, cost incurred, timestamp, and list of tools the agent invoked. Stored alongside the AI analysis.
- **Analysis Progress Event**: A transient notification from the AI agent indicating its current activity. Contains a human-readable message and optionally the tool name being used. Not persisted.
- **Analysis Error**: A categorized failure notification. Contains an error type (credentials, auth, model, budget, turns, format, network, cancelled, unknown) and a human-readable message with guidance.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can trigger and receive a complete vulnerability analysis within 60 seconds for typical findings (files under 500 lines).
- **SC-002**: Users see the first progress message within 5 seconds of clicking "Analyze," confirming the agent has started working.
- **SC-003**: Cancellation takes effect within 3 seconds of clicking "Cancel," and the UI returns to its ready state.
- **SC-004**: 100% of completed analyses are persisted and survive extension restart — navigating back to the finding always shows the stored result.
- **SC-005**: Error messages are specific enough that users can resolve the issue without external support in at least 80% of failure cases (e.g., "Configure your AWS credentials in settings" rather than "Analysis failed").
- **SC-006**: Users can run up to 5 analyses concurrently without degradation of the UI or analysis quality.
- **SC-007**: Analysis cost stays within the user's configured budget for every analysis run — the system never exceeds the set limit.
- **SC-008**: Re-analyzing a finding produces a fresh result that overwrites the previous analysis, with no stale data visible.

## Assumptions

- The Claude Agent SDK is available as a dependency and supports structured output, tool use, and abort signals.
- The AI provider credentials are configured either directly in extension settings or inherited from Claude Code.
- The database with the finding AI analysis storage is already initialized and accessible (per Spec 021).
- The message protocol between extension host and WebView for AI analysis events is already defined (per Spec 020).
- The AiService, AiProvider interface, and ClaudeAgentProvider are already scaffolded (per Specs 018/019).
- The default budget of $1.00 per analysis is sufficient for most single-finding analyses.
- Read-only tool mode is the sensible default; full tool mode is an opt-in power-user setting.

## Dependencies

- **Spec 018 (AI Analysis)**: AiProvider interface, AiService scaffold, ClaudeAgentProvider base implementation.
- **Spec 019 (Settings Inheritance)**: Claude Code settings detection, configuration layering.
- **Spec 020 (AI Message Protocol)**: Message types for analysis events, connection test UI.
- **Spec 021 (AI Analysis Persistence)**: Database schema for AI analysis storage, persistence methods.

## Scope Boundaries

### In Scope

- End-to-end analysis flow: trigger, prompt building, agent execution, progress streaming, result persistence, display.
- Custom tools for finding context retrieval and related findings lookup.
- Message handler wiring between WebView and extension host.
- WebView "Analyze" button, progress state, and cancel button.
- Analysis metadata display (model, cost, tools used).
- Error categorization and user-facing error messages.
- Cancellation support.

### Out of Scope

- AI-assisted suppression justification generation (separate future spec).
- Batch analysis of multiple findings at once.
- Analysis quality scoring or feedback mechanisms.
- Custom prompt editing by users.
- Analysis history (only the most recent analysis is stored).
- Comparison between analysis runs.
- Export of analysis results.
