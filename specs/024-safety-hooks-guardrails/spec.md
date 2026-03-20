# Feature Specification: Safety Hooks and Tool Guardrails

**Feature Branch**: `024-safety-hooks-guardrails`
**Created**: 2026-03-20
**Status**: Draft
**Input**: User description: "Safety Hooks and Tool Guardrails — PreToolUse hook configuration to prevent the agent from reading sensitive files or executing dangerous commands."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Sensitive File Protection (Priority: P1)

A developer runs AI analysis on a security finding. The AI agent attempts to read a `.env` file or private key while investigating the finding's context. The system silently blocks the read before it executes and continues analysis without exposing sensitive data.

**Why this priority**: Preventing sensitive file exposure is the primary security concern. Without this, the AI agent could read credentials, API keys, and private keys during analysis — sending their contents to the LLM provider.

**Independent Test**: Can be fully tested by triggering an AI analysis on a finding in a project that contains `.env` and `.pem` files near the finding, then verifying the agent never receives those file contents and a deny log entry appears.

**Acceptance Scenarios**:

1. **Given** the AI agent is analyzing a finding, **When** it attempts to read a file matching `**/.env*`, **Then** the read is denied with reason "Sensitive file blocked by ASH Workbench" and the agent receives the denial instead of file contents.
2. **Given** the AI agent is analyzing a finding, **When** it attempts to read a file matching `**/*.pem`, **Then** the read is denied with the same reason.
3. **Given** the AI agent is analyzing a finding, **When** it attempts to read a file matching `**/*.key`, **Then** the read is denied.
4. **Given** the AI agent is analyzing a finding, **When** it attempts to read a file matching `**/credentials*`, **Then** the read is denied.
5. **Given** the AI agent is analyzing a finding, **When** it attempts to read a file matching `**/secrets.*`, **Then** the read is denied.
6. **Given** the AI agent is analyzing a finding, **When** it attempts to read a file matching `**/.aws/*`, **Then** the read is denied.
7. **Given** the AI agent is analyzing a finding, **When** it attempts to search (Glob or Grep) across sensitive file paths, **Then** those tool calls are also denied when their input references sensitive patterns.
8. **Given** the AI agent is analyzing a finding, **When** it reads a non-sensitive file like `src/app.ts`, **Then** the read proceeds normally with no interference.

---

### User Story 2 - Dangerous Command Protection (Priority: P2)

A developer has the tool mode set to "full" (which grants the AI agent Bash access). The AI agent attempts to run a destructive command like `rm -rf /` or `DROP TABLE`. The system blocks the command before execution.

**Why this priority**: Destructive commands can cause irreversible damage to the workspace or local databases. This is defense-in-depth — in "read-only" mode Bash is not available at all, but in "full" mode this guard prevents catastrophic mistakes.

**Independent Test**: Can be fully tested by configuring tool mode to "full", triggering AI analysis, and verifying that any Bash call containing a destructive pattern is denied while safe commands like `ls` or `cat` proceed.

**Acceptance Scenarios**:

1. **Given** tool mode is "full" and the AI agent is analyzing a finding, **When** it attempts to run a Bash command containing `rm -rf`, **Then** the command is denied with a reason indicating the command was blocked.
2. **Given** tool mode is "full", **When** the agent attempts a command containing `DROP TABLE`, **Then** it is denied.
3. **Given** tool mode is "full", **When** the agent attempts a command containing `DELETE FROM`, **Then** it is denied.
4. **Given** tool mode is "full", **When** the agent attempts a command containing `format` (filesystem format), **Then** it is denied.
5. **Given** tool mode is "full", **When** the agent attempts a command containing `mkfs`, **Then** it is denied.
6. **Given** tool mode is "full", **When** the agent runs a safe command like `grep -r "password" src/`, **Then** the command proceeds normally.
7. **Given** tool mode is "read-only", **When** Bash is not in the allowed tools list, **Then** the Bash hook is never invoked (no-op by design).

---

### User Story 3 - Transparent Logging of Blocked Operations (Priority: P3)

A developer wants to understand what the AI agent tried to do during analysis. Every blocked tool call is logged to the VS Code "ASH" output channel so the developer can audit what was denied and why.

**Why this priority**: Transparency builds trust. Without visible logging, developers cannot verify the guardrails are working or diagnose why an analysis might be incomplete (if the agent needed a blocked file).

**Independent Test**: Can be tested by triggering an analysis that hits a sensitive file, then checking the "ASH" output channel for a log entry containing the tool name, the blocked path/command, and the denial reason.

**Acceptance Scenarios**:

1. **Given** a tool call is denied by a safety hook, **When** the denial occurs, **Then** a log entry appears in the "ASH" output channel containing: the tool name, what was blocked (file path or command), and the denial reason.
2. **Given** a tool call is allowed (not blocked), **When** it executes normally, **Then** no extra log entry is generated by the safety hooks (existing logging is unaffected).

---

### User Story 4 - WebView Notification of Blocked Operations (Priority: P4)

While watching an analysis in progress, the developer sees a progress message in the WebView indicating that a tool call was blocked — for example, "Blocked: attempted to read .env file". This provides real-time visibility without requiring the developer to open the output channel.

**Why this priority**: Enhances the existing progress message experience. Lower priority because logging (P3) already provides the audit trail; this adds convenience.

**Independent Test**: Can be tested by triggering an analysis that hits a sensitive file, then verifying the WebView receives an analysis progress message with text indicating the blocked operation.

**Acceptance Scenarios**:

1. **Given** a tool call is denied during analysis, **When** the denial is processed, **Then** an analysis progress message is emitted containing "Blocked:" and a description of what was blocked.
2. **Given** the WebView is displaying analysis progress, **When** a blocked-operation progress message arrives, **Then** it is displayed to the user alongside other progress messages (e.g., "Using Read...", "Blocked: attempted to read .env file").

---

### Edge Cases

- What happens when the AI agent tries to read a file with a sensitive name nested deep in subdirectories (e.g., `src/config/.env.production`)? The pattern matching must work regardless of directory depth.
- What happens when a Bash command contains a destructive pattern as part of a harmless string (e.g., `echo "rm -rf"`)? The system should still deny it — false positives are acceptable for safety (err on the side of caution).
- What happens when the AI agent makes multiple blocked tool calls in rapid succession? Each one should be logged individually and a progress message emitted for each.
- What happens when the agent uses Glob to search for `**/.env*`? The Glob pattern itself contains the sensitive pattern and should be blocked.
- What happens when no tool calls are blocked during an analysis? The hooks have zero impact on the analysis flow — no logs, no progress messages, no performance overhead beyond the pattern check.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST intercept all tool calls before execution and evaluate them against defined safety rules.
- **FR-002**: System MUST deny Read, Glob, and Grep tool calls when their input references files matching any of these patterns: `**/.env*`, `**/credentials*`, `**/*.pem`, `**/*.key`, `**/secrets.*`, `**/.aws/*`.
- **FR-003**: System MUST deny Bash tool calls when the command text contains any of these destructive patterns: `rm -rf`, `DROP TABLE`, `DELETE FROM`, `format`, `mkfs`.
- **FR-004**: System MUST return a denial reason of "Sensitive file blocked by ASH Workbench" for file-based denials.
- **FR-005**: System MUST return a denial reason of "Dangerous command blocked by ASH Workbench" for command-based denials.
- **FR-006**: System MUST log every denied tool call to the VS Code output channel ("ASH") with: tool name, blocked input reference (file path or command snippet), and denial reason.
- **FR-007**: System MUST emit an analysis progress event for every denied tool call containing a "Blocked:" prefix and a human-readable description of what was blocked.
- **FR-008**: System MUST allow all tool calls that do not match any denial pattern to proceed without modification or delay.
- **FR-009**: File pattern matching MUST work regardless of directory depth (e.g., `src/config/.env.production` matches `**/.env*`).
- **FR-010**: Bash command filtering MUST apply only when tool mode is "full" (defense-in-depth). In "read-only" mode, Bash is not in the allowed tools list, so the hook is never invoked.
- **FR-011**: System MUST NOT require any user configuration to enable safety hooks — they are always active when AI analysis runs.
- **FR-012**: Denied tool information MUST be available in the analysis progress message stream so the WebView can optionally display it.

### Key Entities

- **Safety Rule**: A matching pattern paired with a denial reason. Rules are organized by tool category (file-access tools vs. command tools).
- **Blocked Operation**: A record of a denied tool call, containing: tool name, the input that triggered the denial (file path or command), the denial reason, and the finding being analyzed.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of tool calls targeting files matching the defined sensitive patterns are blocked before the AI agent receives file contents.
- **SC-002**: 100% of Bash commands containing defined destructive patterns are blocked before execution when tool mode is "full".
- **SC-003**: Every blocked operation produces a visible log entry in the VS Code output channel within the same analysis session.
- **SC-004**: Every blocked operation produces a progress message visible to the WebView within the same analysis session.
- **SC-005**: Analysis of findings that do not trigger any safety rules completes with zero measurable overhead from the hooks (no additional latency or altered behavior).
- **SC-006**: Safety hooks are active by default with no user configuration required — guardrails work out of the box.

## Assumptions

- The sensitive file patterns (`**/.env*`, `**/credentials*`, `**/*.pem`, `**/*.key`, `**/secrets.*`, `**/.aws/*`) cover the most common credential and secret file locations. Additional patterns can be added in future iterations.
- False positives (blocking a legitimate file that happens to match a pattern) are acceptable — security takes precedence over analysis completeness. Developers can view what was blocked in the output channel.
- The destructive command patterns (`rm -rf`, `DROP TABLE`, `DELETE FROM`, `format`, `mkfs`) use substring matching. This may produce false positives (e.g., a `grep` command searching for the text "rm -rf") but this is intentional for defense-in-depth.
- No sandboxing or containerization is needed — hook-based guardrails are sufficient for the current scope.
- This feature depends on the AI analysis provider (Spec 5 / ClaudeAgentProvider) being the sole entry point for agent tool execution.

## Dependencies

- **Spec 5**: ClaudeAgentProvider — hooks are configured in the provider that executes AI analysis queries.
- **Spec 20**: AI Message Protocol — progress messages for blocked operations use the existing `aiAnalysisProgress` message type.

## Scope Boundaries

**In scope**:
- PreToolUse hook implementation for file path filtering and command filtering
- Logging denied operations to VS Code output channel
- Emitting progress events for denied operations
- Always-on behavior (no configuration toggle)

**Out of scope**:
- User-configurable deny patterns (future enhancement)
- PostToolUse hooks (output filtering / redaction)
- Sandboxing or filesystem isolation
- Network access filtering
- Write/Edit tool filtering (the agent already operates in read-only mode by default; full mode is opt-in)
