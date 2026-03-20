# Feature Specification: Settings Inheritance and Configuration

**Feature Branch**: `019-settings-inheritance`
**Created**: 2026-03-20
**Status**: Draft
**Input**: User description: "Two-layer settings system where ~/.claude/settings.json is loaded as the default base layer, and VS Code settings serve as an optional override. Existing Claude Code users get zero-config AI."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Zero-Config AI for Claude Code Users (Priority: P1)

A developer who already uses Claude Code (and has `~/.claude/settings.json` configured with Bedrock credentials) installs the ASH Workbench extension. Without touching any VS Code settings, they trigger an AI-assisted finding analysis. The extension automatically inherits their existing Claude Code configuration — provider, region, model, and credential refresh — and the analysis succeeds on the first attempt.

**Why this priority**: This is the primary value proposition. The vast majority of target users are existing Claude Code users. Zero-config onboarding eliminates the #1 barrier to AI feature adoption.

**Independent Test**: Install extension with a valid `~/.claude/settings.json` containing Bedrock config. Trigger AI analysis on a finding without changing any VS Code settings. Analysis should complete successfully using inherited configuration.

**Acceptance Scenarios**:

1. **Given** a user has `~/.claude/settings.json` with Bedrock credentials configured, **When** they install the extension and trigger AI analysis without changing any settings, **Then** the analysis uses the inherited Claude Code configuration and completes successfully.
2. **Given** a user has `~/.claude/settings.json` with an `awsAuthRefresh` command configured, **When** their AWS credentials expire during an analysis session, **Then** the extension automatically rotates credentials using the inherited refresh command.
3. **Given** a user has `~/.claude/settings.json` but the `useClaudeSettings` setting is set to `false`, **When** they trigger AI analysis, **Then** the extension does not load Claude Code settings and uses only VS Code-configured values.

---

### User Story 2 - Override Specific Settings via VS Code (Priority: P2)

A developer inherits most of their AI configuration from Claude Code but needs to use a different model or region specifically for ASH Workbench security analysis. They set `ashWorkbench.llm.modelId` in their VS Code workspace settings to a specific value. The extension uses the overridden model while still inheriting all other settings (provider, region, credentials) from Claude Code.

**Why this priority**: Power users and teams need the ability to customize AI behavior for security analysis without changing their global Claude Code configuration. This supports enterprise workflows where security analysis may require a specific model or region.

**Independent Test**: With valid `~/.claude/settings.json`, set a single VS Code override (e.g., `modelId`). Verify the overridden value is used while other settings still inherit from Claude Code.

**Acceptance Scenarios**:

1. **Given** a user has Claude Code settings and sets `ashWorkbench.llm.modelId` to a specific model in VS Code settings, **When** they trigger AI analysis, **Then** the specified model is used while provider and region are inherited from Claude Code.
2. **Given** a user sets `ashWorkbench.llm.region` to a non-empty value in VS Code workspace settings, **When** they trigger AI analysis, **Then** the workspace-level region overrides both the user-level VS Code setting and the Claude Code inherited value.
3. **Given** a user sets `ashWorkbench.llm.awsAuthRefresh` to a custom command, **When** credential rotation is needed, **Then** the VS Code-configured command is used instead of the one from `~/.claude/settings.json`.
4. **Given** a user leaves all `ashWorkbench.llm.*` override fields empty (default), **When** they trigger AI analysis, **Then** all configuration values are inherited from Claude Code settings.

---

### User Story 3 - Dashboard Guidance for New Users (Priority: P3)

A developer who does not have Claude Code installed opens ASH Workbench. The dashboard displays guidance indicating that Claude Code settings were not detected and provides instructions on how to configure AI settings manually through VS Code settings.

**Why this priority**: While most users will have Claude Code, new users or those in restricted environments need clear guidance on manual configuration. This prevents confusion and support requests.

**Independent Test**: Remove or rename `~/.claude/settings.json`. Open the extension dashboard. Verify contextual guidance appears explaining how to configure AI settings manually.

**Acceptance Scenarios**:

1. **Given** `~/.claude/settings.json` does not exist, **When** the extension activates, **Then** a flag indicates Claude settings are not detected and the dashboard displays manual configuration guidance.
2. **Given** `~/.claude/settings.json` exists but contains no AI provider configuration (no `CLAUDE_CODE_USE_BEDROCK`, no `awsAuthRefresh`, no `ANTHROPIC_API_KEY`), **When** the extension activates, **Then** the detection flag indicates provider settings are not present.
3. **Given** `~/.claude/settings.json` exists and contains Bedrock configuration, **When** the extension activates, **Then** the detection flag indicates Claude settings are available and the dashboard displays a confirmation that AI is ready to use.
4. **Given** `~/.claude/settings.json` exists and contains an Anthropic API key (but no Bedrock config), **When** the extension activates, **Then** the detection flag indicates Claude settings are available and the dashboard displays a confirmation that AI is ready to use.

---

### User Story 4 - Budget and Safety Controls Always Applied (Priority: P2)

Regardless of whether settings are inherited or manually configured, the extension enforces per-analysis budget limits and tool access restrictions. A user sets `maxBudgetUsd` to $0.50 and `toolMode` to "read-only". Every AI analysis respects these limits even when all other settings come from Claude Code.

**Why this priority**: Safety controls must never be bypassed through inheritance. Budget and tool restrictions are security-critical and must always be explicit VS Code settings, never inherited from external sources.

**Independent Test**: Set `maxBudgetUsd` to a low value and `toolMode` to "read-only". Trigger analysis. Verify the budget limit is enforced and AI cannot perform write operations.

**Acceptance Scenarios**:

1. **Given** `maxBudgetUsd` is set to $0.50, **When** an AI analysis approaches this limit, **Then** the analysis is terminated before exceeding the budget.
2. **Given** `toolMode` is "read-only", **When** AI analysis runs, **Then** the AI agent can only read files and search — no file editing or shell commands are permitted.
3. **Given** `toolMode` is "full", **When** AI analysis runs, **Then** the AI agent can read, write, edit files, and execute shell commands within the workspace.
4. **Given** any combination of inherited and overridden settings, **When** AI analysis runs, **Then** `maxBudgetUsd`, `toolMode`, and `maxTurns` always use the VS Code-configured values (never inherited from Claude Code settings).

---

### Edge Cases

- What happens when `~/.claude/settings.json` exists but is malformed JSON? The extension treats it as if the file doesn't exist and falls back to VS Code-only settings, logging a warning.
- What happens when `useClaudeSettings` is true but `~/.claude/settings.json` doesn't exist? The extension operates with VS Code settings only; no error is raised since the SDK handles missing files gracefully.
- What happens when a user sets `provider` to "bedrock" in VS Code but has no Bedrock credentials in either location? The AI analysis fails with a clear credential-not-found error message directing the user to configure credentials.
- What happens when VS Code settings change while an analysis is in progress? The running analysis continues with the configuration captured at start time. The new settings apply to the next analysis.
- What happens when `maxBudgetUsd` is set below the minimum cost of a single API call? The analysis is attempted but may fail immediately with a budget-exceeded error after the first turn.
- What happens when a workspace `.vscode/settings.json` attempts to set `awsAuthRefresh`? The workspace-level value is ignored; only user-level settings are honored for this setting to prevent command injection attacks.

## Clarifications

### Session 2026-03-20

- Q: Should `awsAuthRefresh` be restricted to user-level settings only (not workspace-level)? → A: Yes — restrict to user-level only. Workspace settings cannot set `awsAuthRefresh` to prevent command injection via malicious `.vscode/settings.json`.
- Q: Should the detection flag also cover Anthropic API key configuration, or remain Bedrock-only? → A: Detect both — flag is true if either Bedrock config or Anthropic API key is found in Claude Code settings.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The extension MUST provide a `useClaudeSettings` toggle (default: enabled) that controls whether the user's Claude Code configuration file is loaded as a base layer.
- **FR-002**: When `useClaudeSettings` is enabled, the extension MUST load configuration from the user's Claude Code settings file, including provider, region, model, credentials, and credential refresh settings.
- **FR-003**: The following settings MUST default to empty and act as override-only: `provider`, `region`, `modelId`, `awsProfile`. When empty, they inherit from the Claude Code base layer. When non-empty, they override the inherited value.
- **FR-004**: The extension MUST provide an `awsAuthRefresh` setting (default: empty) that specifies a shell command for credential rotation. When non-empty, it overrides the equivalent value from Claude Code settings. This setting MUST be restricted to user-level scope only — workspace-level settings MUST NOT be able to set this value, to prevent command injection via malicious `.vscode/settings.json` files.
- **FR-005**: The extension MUST provide a `maxBudgetUsd` setting (default: $1.00, minimum: $0.01) that caps the cost of each individual AI analysis. This setting is always applied from VS Code configuration, never inherited.
- **FR-006**: The extension MUST provide a `toolMode` setting with values "read-only" (default) or "full" that controls what actions the AI agent may perform. This setting is always applied from VS Code configuration, never inherited.
- **FR-007**: The extension MUST resolve the final merged configuration by: (a) loading Claude Code settings as the base layer when enabled, (b) overlaying any non-empty VS Code settings as overrides, and (c) applying standard VS Code settings precedence (workspace > user > default).
- **FR-008**: On extension activation, the extension MUST detect whether the Claude Code settings file exists and contains usable AI provider configuration (Bedrock or Anthropic API), storing the result as a boolean flag accessible to the dashboard.
- **FR-009**: The provider detection MUST check for either: (a) Bedrock configuration — presence of `CLAUDE_CODE_USE_BEDROCK` in the environment configuration or an `awsAuthRefresh` key, or (b) Anthropic API configuration — presence of an `ANTHROPIC_API_KEY` in the environment configuration. The flag is true if either provider is detected.
- **FR-010**: Settings MUST be read via the standard VS Code configuration API, following the existing configuration reading pattern used elsewhere in the extension.
- **FR-011**: The extension MUST capture configuration at analysis start time. Configuration changes during an in-progress analysis MUST NOT affect the running analysis.

### Key Entities

- **Claude Code Settings**: The user's `~/.claude/settings.json` file containing provider credentials, model preferences, and credential rotation configuration. Serves as the default base layer.
- **VS Code Extension Settings**: The `ashWorkbench.llm.*` settings declared in the extension's package manifest. Serve as optional overrides on top of the base layer.
- **Merged Configuration**: The resolved set of configuration values produced by combining the base layer with overrides, used to initialize AI analysis sessions.
- **Detection Flag**: A boolean value (`claudeSettingsDetected`) computed at activation time indicating whether usable AI provider configuration (Bedrock or Anthropic API) exists in the Claude Code settings file.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Existing Claude Code users with Bedrock configuration can trigger AI analysis immediately after extension installation with zero additional configuration steps.
- **SC-002**: Users can selectively override individual settings (model, region, provider) without losing inheritance of other settings from Claude Code.
- **SC-003**: Budget limits and tool access restrictions are enforced on 100% of AI analyses regardless of configuration source.
- **SC-004**: The dashboard accurately reflects whether Claude Code settings were detected within 2 seconds of extension activation.
- **SC-005**: When Claude Code settings are unavailable, users receive clear guidance on manual configuration rather than cryptic errors.

## Assumptions

- The Claude Code settings file is always located at `~/.claude/settings.json` (standard Claude Code convention).
- The Claude Agent SDK's `settingSources: ['user']` parameter handles loading and parsing the Claude Code settings file, including credential rotation via `awsAuthRefresh`.
- The SDK gracefully handles the case where `~/.claude/settings.json` does not exist (no crash, no error — settings simply not loaded).
- VS Code's standard settings precedence (workspace > user > default) is the correct override hierarchy for extension settings.
- `maxBudgetUsd`, `toolMode`, and `maxTurns` are safety-critical settings that should never be inherited from external sources.

## Dependencies

- **Spec 018 (Claude Agent SDK Integration)**: The AI provider that consumes the merged configuration must be implemented first. Settings resolution feeds into the provider's initialization.
