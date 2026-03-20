# Feature Specification: AI Provider Abstraction and Claude Agent SDK Integration

**Feature Branch**: `018-ai-provider-sdk`
**Created**: 2026-03-20
**Status**: Draft
**Input**: User description: "AI Provider Abstraction and Claude Agent SDK Integration — foundational AI service architecture with AiProvider interface and ClaudeAgentProvider implementation."

## Clarifications

### Session 2026-03-20

- Q: How should the system handle concurrent analysis requests for different findings? → A: Parallel with isolation — allow multiple concurrent analyses with independent state per finding, capped at 5 simultaneous analyses to support bulk use cases while preventing resource exhaustion.
- Q: How should the system handle re-analysis of a finding that already has a completed result? → A: Single "Re-analyze" action that overwrites the previous result. No versioning or two-step clear flow.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Validate AI Connection (Priority: P1)

A user who has ASH Workbench installed wants to confirm that their AI backend is properly configured and reachable before attempting any analysis. They trigger a connection test and receive clear feedback about whether the AI service is operational — including which model was reached and how responsive it is — or a specific explanation of what went wrong.

**Why this priority**: Without a working, validated connection to the AI backend, no AI feature is usable. This is the gateway to all AI functionality and the first thing a user must succeed at.

**Independent Test**: Can be fully tested by triggering the connection test action and observing that it returns a success/failure result with meaningful details (model name, response time, or categorized error).

**Acceptance Scenarios**:

1. **Given** the user has valid AI backend credentials configured, **When** they trigger a connection test, **Then** the system reports success with the model name and response latency.
2. **Given** the user has no credentials configured, **When** they trigger a connection test, **Then** the system reports a clear "credentials missing" error with guidance on what to configure.
3. **Given** the user has expired credentials, **When** they trigger a connection test, **Then** the system reports an "authentication failed" error distinguishable from a missing-credentials error.
4. **Given** the AI backend is unreachable (network issue), **When** they trigger a connection test, **Then** the system reports a "network/connectivity" error within a reasonable timeout period.

---

### User Story 2 - Analyze a Single Security Finding (Priority: P1)

A user reviewing security scan results selects a finding and requests AI analysis. The system sends the finding context to the AI backend, which autonomously examines the relevant source code, searches for related patterns, and returns a structured analysis. The analysis includes an explanation of the vulnerability, a risk assessment, an optional suggested fix, and reference links. The user sees real-time progress as the AI works.

**Why this priority**: This is the core value proposition of the AI integration — transforming raw scanner findings into actionable, contextualized security intelligence. Equal priority with Story 1 because connection validation is a prerequisite, but analysis is the reason users want AI at all.

**Independent Test**: Can be fully tested by selecting a finding, triggering analysis, observing progress updates, and receiving a complete structured analysis result that displays in the UI.

**Acceptance Scenarios**:

1. **Given** a finding exists with a valid file path and line numbers, **When** the user triggers analysis, **Then** the system returns a structured result containing at minimum an explanation and a risk assessment.
2. **Given** analysis is in progress, **When** the AI examines source files or searches the codebase, **Then** the user sees non-intrusive progress updates describing what the AI is doing (e.g., "Reading auth.py...", "Searching for injection patterns...").
3. **Given** analysis completes successfully, **When** the result is returned, **Then** the result is persisted so that re-opening the finding shows the cached analysis without re-running.
4. **Given** a finding already has a cached analysis, **When** the user views the finding, **Then** the previously computed analysis is displayed immediately without invoking the AI backend.
5. **Given** the analysis encounters an error (model unavailable, budget exceeded, etc.), **When** the error occurs, **Then** the user sees a categorized error message and the finding remains in an unanalyzed state (no partial or corrupt data persisted).
6. **Given** a finding already has a completed analysis, **When** the user triggers re-analysis, **Then** the system runs a fresh analysis and the new result overwrites the previous one upon completion. During re-analysis, the existing result remains visible until the new one succeeds.

---

### User Story 3 - Cancel an In-Progress Analysis (Priority: P2)

A user who has triggered an analysis realizes they selected the wrong finding, or the analysis is taking too long, and wants to stop it. They cancel the operation and the system halts the AI interaction promptly without leaving the finding in a broken state.

**Why this priority**: Cancellation is essential for user control but depends on the analysis flow (Story 2) existing first. Users should never feel trapped by a long-running AI operation.

**Independent Test**: Can be fully tested by starting an analysis, triggering cancellation during progress, and verifying that the operation stops and the finding remains in its pre-analysis state.

**Acceptance Scenarios**:

1. **Given** an analysis is in progress, **When** the user cancels it, **Then** the AI operation stops within a few seconds and no analysis result is persisted for that finding.
2. **Given** an analysis is cancelled, **When** the user views the finding afterward, **Then** the finding shows no analysis (same state as before the attempt) and the user can re-trigger analysis.

---

### User Story 4 - Cost-Controlled Analysis (Priority: P2)

A user wants assurance that AI analysis will not incur unbounded costs. The system enforces a configurable maximum spend per analysis. If the AI operation reaches the budget limit, it stops gracefully and reports that the budget was exceeded rather than silently producing an incomplete result.

**Why this priority**: Cost transparency and control are critical for enterprise adoption, but the core analysis must work first.

**Independent Test**: Can be fully tested by configuring a low budget limit, triggering an analysis, and verifying the system stops and reports budget exhaustion when the limit is reached.

**Acceptance Scenarios**:

1. **Given** a maximum cost-per-analysis is configured, **When** an analysis reaches that budget, **Then** the system stops the analysis and reports "budget exceeded" to the user.
2. **Given** an analysis completes within budget, **When** the result is returned, **Then** the actual cost incurred is reported alongside the analysis result.

---

### User Story 5 - Swappable AI Backend (Priority: P3)

The system is designed so that the AI backend can be replaced or augmented in the future without rewriting the analysis orchestration or UI layers. A different AI provider (e.g., a direct cloud API, a multi-model gateway, or a local model) could be substituted by implementing the same provider contract.

**Why this priority**: Future-proofing against vendor lock-in is a strategic concern but not a user-facing feature today. The abstraction should exist from day one to avoid costly refactoring later, but only one provider implementation is needed now.

**Independent Test**: Can be tested by verifying that the orchestration layer interacts with the AI backend exclusively through a defined contract (interface), and that a second trivial provider (e.g., a mock/test provider) can be substituted without changes to the orchestration or UI code.

**Acceptance Scenarios**:

1. **Given** the system uses a provider interface for AI operations, **When** a mock provider is substituted, **Then** the orchestration layer functions identically (calls the same methods, receives the same event types) without any code changes outside the provider.
2. **Given** a provider reports its capabilities (e.g., supports structured output, supports tool use), **When** the orchestration layer queries capabilities, **Then** it can adjust behavior based on what the provider supports.

---

### Edge Cases

- What happens when the AI backend returns a response that does not match the expected structured format? The system must handle malformed responses gracefully — retrying if the backend supports it, or reporting a "response format error" to the user without crashing.
- What happens when the workspace has no source files at the paths referenced by a finding (e.g., files were deleted after the scan)? The analysis should still proceed with whatever context is available, noting the missing file rather than failing entirely.
- What happens when multiple analyses are triggered concurrently for different findings? The system runs them in parallel with isolated state per finding, up to a maximum of 5 simultaneous analyses. If the limit is reached, additional requests are rejected with a "too many analyses in progress" message until a slot frees up.
- What happens when the extension is deactivated (VS Code closes) while an analysis is in progress? The in-flight analysis should be terminated cleanly. On next activation, the finding should show no analysis (not a partial/corrupt result).
- What happens when the configured AI model is not available in the user's region? The connection test should detect this and report a specific "model not available in region" error.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST provide a connection test that validates AI backend reachability, authentication, and model availability, returning success with model identifier and response latency, or a categorized error (credentials missing, authentication failed, model unavailable, network error, unknown error).
- **FR-002**: System MUST accept a security finding as input and produce a structured analysis result containing: an explanation of the vulnerability (required), a risk assessment with exploitability/impact/likelihood ratings and rationales (required), an optional suggested fix with description and code diff, and optional reference links.
- **FR-003**: System MUST stream progress events during analysis so that the UI can display real-time status updates about what the AI is doing (e.g., which files it is reading, what patterns it is searching for).
- **FR-004**: System MUST support cancellation of an in-progress analysis, terminating the AI operation within a few seconds and leaving the finding in its pre-analysis state.
- **FR-005**: System MUST enforce a configurable maximum cost per analysis and halt the operation gracefully if the budget is exceeded, reporting the budget exhaustion to the user.
- **FR-006**: System MUST report the actual cost incurred for each completed analysis alongside the result.
- **FR-007**: System MUST persist successful analysis results so they survive across sessions and do not require re-computation when the same finding is viewed again.
- **FR-008**: System MUST interact with the AI backend exclusively through a provider abstraction that supports multiple implementations. Only one implementation (Claude Agent SDK) is required initially.
- **FR-009**: The provider abstraction MUST expose a capabilities query so the orchestration layer can discover what features a given provider supports (e.g., structured output, autonomous tool use, web search).
- **FR-010**: System MUST handle malformed or unexpected AI responses gracefully — retry if possible, otherwise report a clear error without persisting corrupt data.
- **FR-011**: System MUST limit the number of reasoning iterations the AI performs per analysis to prevent runaway computation, independent of the cost budget.
- **FR-012**: The AI provider instance MUST be created lazily (on first AI action, not on extension startup) to avoid impacting extension activation time.
- **FR-013**: System MUST support configurable AI tool access levels: a "read-only" mode where the AI can examine source code but not modify it, and a "full" mode where the AI can also edit files and run commands.
- **FR-014**: System MUST support up to 5 concurrent analyses running in parallel with isolated state per finding. Each analysis operates independently — progress, cancellation, errors, and results for one analysis do not affect others.
- **FR-015**: When the concurrency limit (5) is reached, the system MUST reject additional analysis requests with a clear "too many analyses in progress" message rather than silently queuing or dropping them.
- **FR-016**: System MUST allow users to re-analyze a finding that already has a completed analysis. The new result overwrites the previous one upon successful completion. During re-analysis, the existing result remains displayed until the new one is ready. If re-analysis fails or is cancelled, the previous result is preserved unchanged.

### Key Entities

- **AI Provider**: An abstraction representing an AI backend capable of analyzing security findings. Exposes methods for connection testing, finding analysis (as an event stream), and capability reporting. Multiple implementations can exist (e.g., Claude Agent SDK, direct API, mock).
- **AI Analysis Result**: A structured object containing: explanation (text), risk assessment (exploitability, impact, likelihood — each with a severity level and rationale), optional suggested fix (description, code diff, language), and optional references (title + URL pairs). Includes metadata: model used, cost incurred, timestamp.
- **Analysis Progress Event**: A real-time notification emitted during analysis indicating what the AI is currently doing. Includes a status message and optionally the name of the tool being used.
- **Provider Capabilities**: A descriptor reporting what features a provider supports — structured output, autonomous tool use, code editing, web search, session persistence.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can validate their AI configuration in under 10 seconds via the connection test, receiving either a success confirmation or a specific, actionable error message.
- **SC-002**: Users receive a complete, structured AI analysis for a typical security finding within 60 seconds of triggering analysis.
- **SC-003**: Users see at least one progress update within the first 5 seconds of triggering analysis, confirming the operation has started.
- **SC-004**: Cancellation of an in-progress analysis takes effect within 5 seconds of the user's cancellation request.
- **SC-005**: Cached analysis results load instantly (under 1 second) when revisiting a previously analyzed finding.
- **SC-006**: The cost reported per analysis is accurate to within the precision provided by the AI backend.
- **SC-007**: The system correctly enforces the budget limit — no analysis exceeds the configured maximum cost.
- **SC-008**: Extension activation time is not measurably impacted by the presence of the AI service layer (lazy initialization).
- **SC-009**: A mock/test AI provider can be substituted for the real provider with zero changes to the orchestration or UI layers, validating the abstraction.

## Assumptions

- The primary AI backend for the initial implementation is the Claude Agent SDK (`@anthropic-ai/claude-agent-sdk`), which supports AWS Bedrock, Google Vertex AI, Azure, and direct Anthropic API authentication paths.
- Most users will already have Claude Code configured with Bedrock credentials, making zero-config AI a realistic default experience.
- The `AiAnalysis` type, `RiskAssessment` type, `SuggestedFix` type, and related structures already exist in the codebase and do not need to be redefined — only consumed by the new service layer.
- The `FindingsService` and its `getFindingDetail()` method already exist and will be used to load finding context for analysis.
- Session persistence within a scan analysis batch (reusing the AI session across multiple findings in the same scan) is an optimization that improves efficiency but is not user-visible — individual finding analysis must work without session reuse.
- The extension host environment supports spawning subprocesses, as the Claude Agent SDK operates by spawning a subprocess for tool execution.
- Cost data is provided by the AI backend in the analysis result; the system does not independently meter API calls.

## Out of Scope

- **Batch analysis of multiple findings** — this spec covers single-finding analysis only. Batch analysis is a separate feature.
- **User-interactive AI conversations** — the AI operates autonomously without asking the user clarifying questions during analysis. Interactive Q&A is deferred.
- **Fix application** — the AI may suggest fixes, but automatically applying them to source code is not part of this spec.
- **Non-Claude AI providers** — only the Claude Agent SDK provider is implemented. The abstraction supports future providers, but no others are built.
- **AI settings UI** — configuration is done through VS Code settings. A dedicated settings panel or onboarding wizard is not included.
- **Safety hooks and guardrails** — blocking sensitive file reads or dangerous commands is a separate spec (safety layer).
- **User documentation** — setup guides and usage documentation are separate deliverables.
