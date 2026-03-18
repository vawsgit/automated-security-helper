---
title: claude-code-recommended-specs
---

# Claude Agent SDK Integration: Recommended Specs

Ordered list of specifications to be implemented via `speckit.specify`. Each spec builds on the previous one. Implement in order.

**Source**: Derived from `claude-code-initial-research.md` findings and resolved decisions.

**Reference documents**:

- Research: `docs/docs/working/claude-code/initial/claude-code-initial-research.md`
- OpenCode research (comparison): `docs/docs/working/opencode/initial/opencode-research.md`
- Existing functional design: `docs/docs/working/app-design/functional-design.md`
- Existing technical design: `docs/docs/working/app-design/technical-design.md`

---

## Spec 1: AI Provider Abstraction and Claude Agent SDK Integration

**Scope**: Extension host service layer (`vsix/src/services/`)

**What this spec defines**: The foundational AI service architecture. An `AiProvider` interface that abstracts the AI backend, and a `ClaudeAgentProvider` implementation using `@anthropic-ai/claude-agent-sdk`. This is the core plumbing that all subsequent specs depend on.

**Key requirements**:

- Install `@anthropic-ai/claude-agent-sdk` as a standard npm dependency in `vsix/package.json`. No dynamic loading or on-demand installation -- install by default.
- Define an `AiProvider` TypeScript interface with methods: `analyzeFinding()` (returns `AsyncGenerator` of progress/result events), `testConnection()` (validates auth and model access), and `getCapabilities()` (reports available features like tool use, structured output).
- Implement `ClaudeAgentProvider` that wraps the SDK's `query()` function. It must:
  - Accept an `AbortController` for cancellation.
  - Yield progress events as the agent works (tool use notifications, status updates).
  - Return structured `AiAnalysis` results via the SDK's `outputFormat` option with JSON Schema validation.
  - Support session persistence within a scan analysis batch (reuse session for multiple findings in the same scan, clean up on scan completion).
- Implement `AiService` as the high-level orchestration layer. It takes `AiProvider` and `FindingsService` as dependencies. It is responsible for: loading finding context, invoking the provider, persisting results to the database, and handling errors. Follow the existing service layer pattern (`ScannerService`, `FindingsService`).
- The `AiService` should manage a single `ClaudeAgentProvider` instance per extension lifecycle, creating it lazily on first AI action.

**Depends on**: Nothing (foundation spec).

**Produces**: `vsix/src/services/aiService.ts`, `vsix/src/services/aiProvider.ts`, `vsix/src/services/claudeAgentProvider.ts`. Updated `vsix/package.json` with SDK dependency.

---

## Spec 2: Settings Inheritance and Configuration

**Scope**: Extension host settings, `package.json` contributes.configuration

**What this spec defines**: The two-layer settings system where `~/.claude/settings.json` is loaded as the default base layer via `settingSources: ['user']`, and VS Code settings serve as an optional override. Existing Claude Code users get zero-config AI.

**Key requirements**:

- Add `ashWorkbench.llm.useClaudeSettings` boolean setting (default: `true`). When true, the SDK loads `~/.claude/settings.json` which provides model, region, Bedrock credentials, and `awsAuthRefresh` credential rotation automatically. Existing Claude Code users get AI features with zero additional configuration.
- Update existing `ashWorkbench.llm.*` settings to be override-only: `provider`, `region`, `modelId`, `awsProfile` all default to empty string (`""`). Empty means "inherit from Claude Code settings." Only when a user explicitly sets a value does it override the inherited config.
- Add new settings: `ashWorkbench.llm.awsAuthRefresh` (string, default empty -- shell command to refresh AWS credentials, overrides the value from `~/.claude/settings.json`), `ashWorkbench.llm.maxBudgetUsd` (number, default `1.00` -- always applied, not inherited), `ashWorkbench.llm.toolMode` (enum `"read-only"` | `"full"`, default `"read-only"` -- always applied).
- Implement `buildQueryOptions()` function that resolves the merged configuration: loads `settingSources: ['user']` when `useClaudeSettings` is true, overlays non-empty VS Code settings as `env` overrides and `model` overrides. Explicit workspace-level VS Code settings always win over inherited Claude Code settings (standard VS Code precedence).
- On extension activation, detect whether `~/.claude/settings.json` exists and contains Bedrock-related config (check for `CLAUDE_CODE_USE_BEDROCK` in `env` or `awsAuthRefresh` key). Store result as a boolean `claudeSettingsDetected` flag for the dashboard to display contextual guidance.
- Read settings via `vscode.workspace.getConfiguration('ashWorkbench')`, following the existing `ScannerService.getConfig()` pattern.

**Depends on**: Spec 1 (settings are consumed by `ClaudeAgentProvider`).

**Produces**: Updated `vsix/package.json` contributes.configuration section. Settings resolution logic in `AiService` or a dedicated `AiConfigService`.

---

## Spec 3: AI Message Protocol and Test Connection

**Scope**: Extension host providers, WebView message types, Dashboard UI

**What this spec defines**: The message passing protocol between extension host and WebView for AI features, and the "Test AI Connection" button that validates the full pipeline end-to-end.

**Key requirements**:

- Add new Extension-to-WebView message types: `aiTestResult` (success/failure with model name, latency, error category), `aiAnalysisStarted` (finding ID, model), `aiAnalysisProgress` (finding ID, status text, optional tool name), `aiAnalysisResult` (finding ID, `AiAnalysis` object, cost), `aiAnalysisError` (finding ID, error message, error type classification).
- Add new WebView-to-Extension message types: `testAiConnection`, `analyzeFinding` (finding ID), `cancelAiAnalysis` (finding ID).
- Types must be defined in both `vsix/src/models/messages.ts` and `webview/src/types/messages.ts` (following the existing type duplication pattern).
- Include `claudeSettingsDetected` boolean in the `stateUpdate` message payload so the WebView knows whether the user has an existing Claude Code configuration.
- Wire `testAiConnection` handler in `SidebarWebviewProvider`: reads current settings, calls `AiService.testConnection()`, sends `aiTestResult` back to WebView. The test connection runs a minimal `query()` call to validate: SDK subprocess spawns, authentication succeeds (Bedrock or API key), model is accessible, response is received.
- Implement "Test AI Connection" button on the Dashboard (both `DashboardView` and `SidebarDashboard`). When `claudeSettingsDetected` is true, show "Claude Code settings detected -- click to test." When false, show setup guidance directing the user to VS Code Settings. The button triggers a modal/inline indicator showing spinner during test, then success (model name + latency) or categorized error (credentials missing, model unavailable, network error, etc.).
- Error categorization: detect and display human-readable messages for common failures -- no API key, expired credentials, model not enabled in region, network timeout.

**Depends on**: Spec 1 (AiService), Spec 2 (settings resolution).

**Produces**: Updated message type files. Test connection handler in providers. Dashboard UI updates for test button and settings detection indicator.

---

## Spec 4: AI Analysis Persistence (Database Schema)

**Scope**: Prisma schema, mappers, FindingsService

**What this spec defines**: Database persistence for AI analysis results so they survive across sessions and don't require re-analysis.

**Key requirements**:

- Add `aiAnalysis` JSON column to the `Finding` model in `vsix/prisma/schema.prisma`. The column stores the full `AiAnalysis` object (explanation, riskAssessment, suggestedFix, references) plus metadata: `analyzedAt` timestamp, `modelId` used, `costUsd` incurred, `toolsUsed` array.
- Create a Prisma migration for the new column. Since the project is in active development with no production data, this is a simple additive migration with no backwards compatibility concerns.
- Update the SARIF-to-Finding mapper (`vsix/src/models/mappers.ts`) to populate `FindingRow.aiAnalysis` from the database value instead of hardcoding `null`.
- Add `setAiAnalysis(findingId, analysis, metadata)` method to `FindingsService` for persisting analysis results after a successful AI analysis.
- Add `clearAiAnalysis(findingId)` method to `FindingsService` for clearing stale results (e.g., when a user wants to re-analyze).
- The `AiService.analyzeFinding()` flow should call `FindingsService.setAiAnalysis()` after receiving a successful structured output from the SDK, before sending the result to the WebView.

**Depends on**: Spec 1 (AiService calls FindingsService).

**Produces**: Updated Prisma schema and migration. Updated mappers. New FindingsService methods.

---

## Spec 5: Finding Analysis -- Core AI Feature

**Scope**: Extension host services, WebView `FindingDetailView`, `AiAnalysisPanel`

**What this spec defines**: The end-to-end finding analysis feature. User clicks "Analyze" on a finding, the Claude agent reads the source code, analyzes the vulnerability, and returns a structured analysis that is displayed in the UI and persisted to the database.

**Key requirements**:

- Implement the `AiService.analyzeFinding()` method end-to-end:
  - Load the finding from the database via `FindingsService.getFindingDetail()`.
  - Build a system prompt with the security analysis persona and finding context (title, description, severity, scanner, ruleId, file path, line numbers, code snippet).
  - Configure the SDK `query()` call with: `outputFormat` set to the `AiAnalysis` JSON Schema for validated structured output, `allowedTools` based on `toolMode` setting (read-only: `["Read", "Glob", "Grep"]`, full: `["Read", "Write", "Edit", "Bash", "Glob", "Grep"]`), `permissionMode: "dontAsk"` (auto-deny anything not in allowedTools), `maxBudgetUsd` from settings, `maxTurns: 15` (reasonable limit for analysis), `cwd` set to the workspace root.
  - Stream progress events from the SDK's message generator to the WebView via `aiAnalysisProgress` messages. Use the `Notification` hook to capture agent status. Show tool activity non-intrusively (e.g., "Reading auth.py...", "Searching for injection patterns...").
  - On `result` message with `structured_output`, validate and persist the `AiAnalysis` to the database via `FindingsService.setAiAnalysis()`.
  - Send `aiAnalysisResult` to WebView with the analysis and cost.
  - On error, send `aiAnalysisError` with categorized error message.
- Define custom MCP tools using `createSdkMcpServer()`: `get_finding_context` (retrieves full finding details + surrounding code from DB), `list_related_findings` (finds findings with same ruleId, scanner, or file). Register the MCP server in the `query()` options and add tools to `allowedTools`.
- Wire `analyzeFinding` message handler in `FindingsPanelManager`: receives finding ID from WebView, calls `AiService.analyzeFinding()`, forwards progress/result/error messages back.
- Update `FindingDetailView` in the WebView: show an "Analyze" button when `finding.aiAnalysis` is null. The button should display loading/progress state during analysis (spinner with status text from progress messages). On completion, the `AiAnalysisPanel` renders the result.
- Display analysis metadata: model used, tokens consumed, cost, and list of tools the agent invoked. Show this in a collapsible section of the `AiAnalysisPanel`.
- Support cancellation: "Cancel" button during analysis sends `cancelAiAnalysis` to extension host, which calls `abortController.abort()` on the SDK query.

**Depends on**: Spec 1 (AiProvider/AiService), Spec 2 (settings for tools/budget), Spec 3 (message types), Spec 4 (persistence).

**Produces**: Complete `AiService.analyzeFinding()` implementation. Custom MCP tools. FindingsPanelManager handler. Updated FindingDetailView with Analyze button and progress state. Updated AiAnalysisPanel with metadata display.

---

## Spec 6: Batch Analysis and Session Management

**Scope**: Extension host AiService, WebView scan-level UI

**What this spec defines**: Sequential batch analysis of all findings in a scan, with session persistence for efficiency and a scan-level UI for triggering and tracking batch progress.

**Key requirements**:

- Add `AiService.analyzeAllFindings(scanId)` method that sequentially analyzes every finding in a scan that does not already have an `aiAnalysis` result. Uses session resumption (capture `session_id` from the first query's init message, pass `resume: sessionId` for subsequent findings) to keep the subprocess warm and maintain cross-finding context.
- Progress reporting: emit progress at the scan level ("Analyzing finding 3 of 17...") in addition to per-finding tool activity. The WebView should show overall batch progress (e.g., a progress bar or counter).
- Session cleanup: after the batch completes (or is cancelled), the session is not resumed further. The SDK handles subprocess cleanup when the query generator is exhausted.
- Add "Analyze All Findings" button to the scan detail view or findings list header. Disabled when all findings already have analysis. Shows batch progress during execution.
- Cancellation: cancelling a batch analysis aborts the current finding's query and skips remaining findings. All already-completed analyses are preserved in the database.
- Add `cancelAiAnalysis` handling for batch context -- when `scanId` is provided instead of `findingId`, cancel the entire batch.
- Respect `maxBudgetUsd` across the batch, not per-finding. Track cumulative cost from `result.total_cost_usd` and stop the batch if the budget is exceeded.

**Depends on**: Spec 5 (single finding analysis).

**Produces**: `analyzeAllFindings()` method. Batch progress messages. Scan-level "Analyze All" button and progress UI.

---

## Spec 7: Safety Hooks and Tool Guardrails

**Scope**: Extension host `ClaudeAgentProvider`

**What this spec defines**: `PreToolUse` hook configuration to prevent the agent from reading sensitive files or executing dangerous commands.

**Key requirements**:

- Implement a `PreToolUse` hook in `ClaudeAgentProvider` that intercepts tool calls before execution:
  - **File path filtering**: Deny `Read` tool calls targeting files matching patterns: `**/.env*`, `**/credentials*`, `**/*.pem`, `**/*.key`, `**/secrets.*`, `**/.aws/*`. Return deny with reason "Sensitive file blocked by ASH Workbench".
  - **Bash command filtering**: In `"full"` tool mode where `Bash` is allowed, deny commands containing destructive patterns: `rm -rf`, `DROP TABLE`, `DELETE FROM`, `format`, `mkfs`. In `"read-only"` mode, `Bash` is not in `allowedTools` so this is defense-in-depth only.
- Register hooks in the `query()` options via the `hooks` field with matchers: `"Read|Glob|Grep"` for file path filtering, `"Bash"` for command filtering.
- Log all denied tool calls to the VS Code output channel ("ASH" channel) for transparency.
- Include denied tool information in the `aiAnalysisProgress` messages so the WebView can optionally display "Blocked: attempted to read .env file".
- No sandboxing configuration -- use the simplest approach. Hooks provide sufficient guardrails for the current scope.

**Depends on**: Spec 5 (hooks are configured in the provider used by analysis).

**Produces**: Hook callback functions. Updated `ClaudeAgentProvider` with hook configuration. Logging integration.

---

## Spec 8: User Documentation -- AI Analysis Setup

**Scope**: `docs/docs/user-docs/`

**What this spec defines**: End-user documentation for the AI analysis feature, covering two user paths: existing Claude Code users (zero-config) and new users (manual setup).

**Key requirements**:

- **Getting Started with AI Analysis** guide:
  - For existing Claude Code / Bedrock users: explain that ASH Workbench automatically inherits settings from `~/.claude/settings.json` including model, region, AWS credentials, and `awsAuthRefresh`. No additional configuration needed -- just click "Test AI Connection" to verify.
  - For new users: step-by-step guide to configure VS Code settings (`ashWorkbench.llm.*`), including how to set up Bedrock access, obtain an Anthropic API key, or configure `awsAuthRefresh` for credential rotation.
- **Using AI Analysis** guide:
  - How to analyze a single finding (Analyze button in FindingDetailView).
  - How to batch-analyze all findings in a scan.
  - Understanding the analysis output: explanation, risk assessment, suggested fix, references.
  - Cost awareness: what `maxBudgetUsd` controls, where to see cost per analysis.
  - Tool modes: what "read-only" vs "full" means, when to use each.
- **Settings Reference**: table of all `ashWorkbench.llm.*` settings with descriptions, defaults, and interaction with `useClaudeSettings` toggle.
- **Troubleshooting**: common errors (credentials expired, model not available in region, network timeout) with resolution steps.
- Follow existing user-docs conventions: Docusaurus markdown with `title:` frontmatter, kebab-case filenames, relative cross-links.

**Depends on**: Specs 1-7 (documents the implemented features).

**Produces**: New documentation pages in `docs/docs/user-docs/`.
