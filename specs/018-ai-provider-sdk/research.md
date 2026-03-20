# Research: AI Provider Abstraction and Claude Agent SDK Integration

**Feature**: 018-ai-provider-sdk
**Date**: 2026-03-20

## Decision 1: SDK Integration Pattern

**Decision**: Use `@anthropic-ai/claude-agent-sdk`'s `query()` function as an in-process npm library that spawns a Claude Code subprocess for tool execution.

**Rationale**: The SDK eliminates external CLI dependencies (unlike OpenCode), provides native structured output validation, autonomous tool execution, and session persistence. It is installed as a standard npm dependency — no global CLI requirement.

**Alternatives considered**:
- **OpenCode SDK**: HTTP client to external CLI server. Rejected: requires global CLI install, no structured output validation, no native subagent support.
- **Direct Bedrock Runtime API**: Raw `InvokeModelCommand` calls. Rejected: loses all agentic capabilities (tool use, codebase navigation). Only useful as a future lightweight fallback for non-Claude models.
- **Anthropic SDK (`@anthropic-ai/sdk`)**: Lower-level API client. Rejected: requires implementing the full agent loop, tool dispatch, and context management manually.

## Decision 2: Concurrency Model

**Decision**: Parallel execution with isolated state per finding, capped at 5 simultaneous analyses. A semaphore pattern tracks active slots. When all 5 are in use, new requests are rejected with a clear message.

**Rationale**: Parallel execution supports bulk analysis workflows and better user experience when analyzing multiple findings. The 5-slot cap prevents resource exhaustion (each analysis spawns a subprocess and makes API calls). Rejection (not queuing) keeps the UX simple and predictable — the user knows immediately whether their request was accepted.

**Alternatives considered**:
- **Sequential queue**: Simpler state management but poor UX for multi-finding workflows. Rejected per clarification session.
- **Unlimited parallel**: No resource protection. Rejected: subprocess memory and API rate limits are real constraints.
- **Queue with auto-drain**: Accepts all requests and processes in order. Rejected: harder to reason about, unclear when the user's analysis will start.

## Decision 3: Authentication and Settings Inheritance

**Decision**: Load `~/.claude/settings.json` via `settingSources: ['user']` as the default configuration layer. VS Code settings (`ashWorkbench.llm.*`) serve as an optional override. Empty VS Code setting values mean "inherit from Claude Code settings."

**Rationale**: Most target users already have Claude Code configured with Bedrock credentials. Inheriting `awsAuthRefresh`, model, region, and `CLAUDE_CODE_USE_BEDROCK` env var from the user's existing configuration provides zero-config AI for the majority case. The `awsAuthRefresh` setting automatically handles credential rotation (e.g., SSO token refresh) without the extension implementing any credential logic.

**Alternatives considered**:
- **VS Code settings only**: Requires every user to manually configure credentials. Rejected: unnecessary friction for existing Claude Code users.
- **Auto-detect credentials**: Probe AWS credential chain programmatically. Rejected: complex, doesn't handle SSO/MFA without `awsAuthRefresh`.

## Decision 4: Structured Output Strategy

**Decision**: Use the SDK's native `outputFormat: { type: 'json_schema', schema }` option with a JSON Schema matching the existing `AiAnalysis` TypeScript type. The SDK validates responses against the schema and retries automatically on validation failure.

**Rationale**: Native structured output eliminates fragile JSON extraction from markdown responses. The schema mirrors the existing `AiAnalysis` type (explanation, riskAssessment, suggestedFix, references) already defined in both `vsix/src/models/types.ts` and `webview/src/types/types.ts`. No new types needed for the analysis payload — only metadata types for persistence.

**Alternatives considered**:
- **Prompt-based JSON**: Embed schema in system prompt, parse response manually. Rejected: fragile, no automatic retry, no validation guarantee.
- **Tool-based extraction**: Define a custom tool that Claude calls with structured data. Rejected: unnecessary complexity when `outputFormat` exists.

## Decision 5: Persistence Strategy

**Decision**: Add a single `aiAnalysis` JSON column to the Prisma `Finding` model. Store the full analysis object plus metadata (timestamp, model ID, cost, tools used) in a wrapper structure. The mapper extracts the `AiAnalysis` portion for the `FindingRow` view type.

**Rationale**: A single JSON column is the simplest approach (constitution principle III). No schema migration complexity — one additive column. Metadata stays co-located with the analysis it describes. The existing `FindingRow.aiAnalysis: AiAnalysis | null` field is already typed and plumbed through the UI.

**Alternatives considered**:
- **Separate AiAnalysis table**: Normalized relational model. Rejected: over-engineered for a 1:1 relationship where the analysis is always loaded with the finding.
- **Multiple columns**: `aiExplanation`, `aiRiskAssessment`, etc. Rejected: schema bloat, harder to version or extend.

## Decision 6: Provider Abstraction Scope

**Decision**: Define a thin `AiProvider` interface with 3 methods: `analyzeFinding()` (returns `AsyncGenerator<AnalysisEvent>`), `testConnection()`, and `getCapabilities()`. Implement `ClaudeAgentProvider` as the sole implementation. The `AiService` orchestration layer depends on the interface, not the implementation.

**Rationale**: The interface is cheap to create (3 method signatures) and protects against the HIGH-risk Claude-only lock-in identified in the research document. Constitution principle III discourages abstractions for hypothetical requirements, but the research document's risk assessment justifies this as a minimal insurance policy. The mock provider for testing validates the abstraction works.

**Alternatives considered**:
- **No interface, direct SDK calls**: Tightest coupling, simplest code. Rejected: makes future provider swap a full rewrite of AiService.
- **Full provider framework with plugin discovery**: Over-engineered for one implementation. Rejected per constitution principle III.

## Decision 7: Tool Access Configuration

**Decision**: Two modes controlled by `ashWorkbench.llm.toolMode` setting:
- `"read-only"` (default): `allowedTools: ["Read", "Glob", "Grep"]` with `permissionMode: "dontAsk"`
- `"full"`: `allowedTools: ["Read", "Write", "Edit", "Bash", "Glob", "Grep"]` with `permissionMode: "acceptEdits"`

**Rationale**: Read-only is the safe default — Claude can navigate the codebase for context but cannot modify files. Full mode is an opt-in for users who want auto-fix capabilities. `permissionMode: "dontAsk"` auto-denies anything not in `allowedTools`, providing defense-in-depth.

**Alternatives considered**:
- **No tools (text-only)**: Loses the SDK's primary advantage. Rejected: dramatically worse analysis quality.
- **Custom per-tool toggles**: Maximum flexibility but complex settings UI. Rejected: two modes cover the use cases.

## Decision 8: Error Categorization

**Decision**: Classify errors into 6 categories based on SDK result subtypes and exception patterns:

| Category | Detection | User Message |
|----------|-----------|-------------|
| `credentials_missing` | No API key or AWS credentials in env | "No AI credentials configured. Configure in VS Code Settings or install Claude Code." |
| `auth_failed` | 401/403 from API, expired token | "Authentication failed. Check your credentials or run credential refresh." |
| `model_unavailable` | Model not found in region | "Model not available in your configured region." |
| `budget_exceeded` | `error_max_budget_usd` result | "Analysis stopped: cost limit reached ($X.XX budget)." |
| `network_error` | Connection timeout, DNS failure | "Cannot reach AI service. Check network connectivity." |
| `unknown` | All other errors | "Analysis failed: [original error message]" |

**Rationale**: These categories map to actionable user responses. Each error tells the user what to do, not just what went wrong.

## Decision 9: Re-analysis Behavior

**Decision**: Allow re-analysis of findings that already have results. The new analysis overwrites the previous one on success. During re-analysis, the existing result remains displayed. If re-analysis fails or is cancelled, the previous result is preserved unchanged.

**Rationale**: Users need to re-analyze when source code changes, when they want to try a different model, or when an initial analysis was unsatisfactory. Overwrite-on-success is the simplest model — no versioning complexity. Preserving the old result during re-analysis avoids a "blank state" UX gap.
