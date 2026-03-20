---
title: AI Integration
sidebar_position: 8
---

# AI Integration

ASH Workbench uses the Claude Agent SDK to provide AI-assisted security analysis of findings. The system supports per-finding analysis with streaming progress, batch analysis across all findings in a scan, and provider auto-detection from Claude Code settings.

## How It Works

### Analysis Flow

```mermaid
sequenceDiagram
    participant WV as WebView
    participant FPM as FindingsPanelManager
    participant AIS as AiService
    participant CAP as ClaudeAgentProvider
    participant MCP as MCP Server
    participant SDK as Claude Agent SDK

    WV->>FPM: analyzeFinding { findingId }
    FPM->>AIS: analyzeFinding(findingId, onEvent)
    AIS->>AIS: Load finding from database
    AIS->>MCP: Create MCP server with finding tools
    AIS->>CAP: analyzeFinding(finding, mcpServer)
    CAP->>SDK: query(systemPrompt, tools, mcpServers)

    loop Agent loop
        SDK->>MCP: get_finding_context / list_related_findings
        MCP-->>SDK: Finding data + code context
        SDK->>CAP: Progress event (tool usage)
        CAP-->>AIS: AnalysisEvent (progress)
        AIS-->>FPM: onEvent(progress)
        FPM-->>WV: aiAnalysisProgress
    end

    SDK-->>CAP: Structured output (AiAnalysis)
    CAP-->>AIS: AnalysisEvent (result)
    AIS->>AIS: Persist to database
    AIS-->>FPM: onEvent(result)
    FPM-->>WV: aiAnalysisResult
```

### Architecture

The AI system has four layers:

| Layer | File | Responsibility |
|-------|------|----------------|
| **Orchestration** | `aiService.ts` | Concurrency management, batch processing, event routing, database persistence |
| **Provider** | `claudeAgentProvider.ts` | Claude Agent SDK integration, system prompt construction, structured output schema |
| **Tools** | `mcpTools.ts` | MCP server with finding-analysis tools exposed to the agent |
| **Safety** | `safetyHooks.ts` | PreToolUse hooks blocking sensitive file access and dangerous commands |
| **Interface** | `aiProvider.ts` | `AiProvider` interface, `AnalysisEvent` types |

## AiService (Orchestration)

`vsix/src/services/aiService.ts`

### Single Finding Analysis

`analyzeFinding(findingId, onEvent)`:

1. Validates concurrency (max 5 concurrent analyses via `activeAnalyses` map)
2. Loads finding details from database
3. Creates an in-process MCP server with finding-analysis tools
4. Calls `provider.analyzeFinding()` with an async generator pattern
5. Streams events: `progress` (tool usage), `result` (structured output), `error`
6. On success: persists AI analysis to database via `findingsService.setAiAnalysis()`

### Batch Analysis

`analyzeAllFindings(scanId, onBatchEvent)`:

1. Queries unanalyzed findings for the scan
2. Creates batch state with shared `AbortController`
3. Iterates through findings sequentially:
   - Skips already-analyzed findings (idempotent)
   - Calls `analyzeFinding()` for each
   - Tracks consecutive failures
4. Stops on consecutive failure threshold (default: 3, configurable via `ashWorkbench.llm.batchConsecutiveFailureLimit`)
5. Emits batch events: `batch-started`, `batch-progress`, `batch-finding-event`, `batch-complete`
6. Supports session resumption for cross-finding context

### Error Types

```typescript
type AnalysisErrorType =
  | 'credentials_missing' | 'auth_failed' | 'model_unavailable'
  | 'budget_exceeded' | 'max_turns_exceeded' | 'format_error'
  | 'network_error' | 'cancelled' | 'unknown'
```

The WebView maps these error types to user-actionable guidance via `webview/src/lib/ai-errors.ts`.

## ClaudeAgentProvider (SDK Integration)

`vsix/src/services/claudeAgentProvider.ts`

### System Prompt

The provider constructs a system prompt for each finding that includes:

- Finding context: title, severity, scanner, rule ID, file path, line range, code snippet
- Task instructions: read relevant code, search for patterns, produce structured analysis
- Output format requirements

### Structured Output Schema

The agent produces structured output conforming to this schema:

```typescript
interface AiAnalysis {
  explanation: string;
  riskAssessment: {
    exploitability: RiskLevel;     // CRITICAL | HIGH | MEDIUM | LOW | NONE
    exploitabilityRationale: string;
    impact: RiskLevel;
    impactRationale: string;
    likelihood: RiskLevel;
    likelihoodRationale: string;
  };
  suggestedFix: {
    description: string;
    diffText: string;
    language: string;
  } | null;
  references: Array<{ title: string; url: string }>;
}

interface AnalysisMetadata {
  analyzedAt: string;    // ISO timestamp
  modelId: string;
  costUsd: number;
  toolsUsed: string[];
}
```

### Tool Configuration

The agent has access to different tool sets based on `ashWorkbench.llm.toolMode`:

| Mode | Tools |
|------|-------|
| `read-only` (default) | `Read`, `Glob`, `Grep`, `get_finding_context`, `list_related_findings` |
| `full` | All of the above plus `Write`, `Edit`, `Bash` |

### Safety Hooks

`vsix/src/services/safetyHooks.ts`

The provider attaches PreToolUse hooks to every `query()` call to prevent the agent from accessing sensitive files or running dangerous commands. Hooks are always active — no configuration needed.

#### How hooks are wired

```typescript
// In ClaudeAgentProvider.analyzeFinding()
const blockedOps: BlockedOperation[] = [];
options.hooks = buildSafetyHooks(
  (msg) => this.log(msg),
  blockedOps,
);
```

`buildSafetyHooks()` returns a hooks object with two PreToolUse matchers:

| Matcher | Hook | Blocks |
|---------|------|--------|
| `Read\|Glob\|Grep` | `createFilePathHook` | Any tool input string matching a sensitive file pattern |
| `Bash` | `createBashCommandHook` | `command` field matching a dangerous command pattern |

#### Sensitive file patterns

```typescript
/(^|[/\\])\.env/i    // .env, .env.local, .env.production
/credentials/i        // credentials.json, aws_credentials
/\.pem$/i             // server.pem, cert.pem
/\.key$/i             // private.key, tls.key
/secrets\./i          // secrets.json, secrets.yaml
/[/\\]\.aws[/\\]/i   // .aws/credentials, .aws/config
```

The file-path hook iterates all string values in `tool_input` (not just `file_path`) to catch patterns in `path`, `pattern`, and `glob` fields across Read, Glob, and Grep tools.

#### Dangerous command patterns

```typescript
/rm\s+-rf/i           // rm -rf
/drop\s+table/i       // DROP TABLE
/delete\s+from/i      // DELETE FROM
/\bformat\b/i         // format (word boundary)
/\bmkfs\b/i           // mkfs (word boundary)
```

#### Blocked operation queue

Hooks communicate with the async generator via a shared `BlockedOperation[]` array. When a hook denies a tool call, it pushes an entry to the queue. After each SDK message, the generator drains the queue and yields progress events:

```typescript
// In the generator loop
while (blockedOps.length > 0) {
  const op = blockedOps.shift()!;
  yield {
    type: 'progress',
    message: `Blocked: attempted to ${op.toolName.toLowerCase()} ${op.blockedInput}`,
    toolName: op.toolName,
  };
}
```

These progress events flow through the existing pipeline to the WebView as `aiAnalysisProgress` messages.

#### Error handling

All hooks are fail-closed — if the hook callback throws, it returns a deny result. The `safeLog()` helper wraps log calls in their own try/catch so a broken logger cannot prevent denial.

#### Structural typing

Hook types (`PreToolUseHookInput`, `HookCallback`, `HookResult`) are defined as structural matches in `safetyHooks.ts` rather than imported from `@anthropic-ai/claude-agent-sdk`. This avoids ESM import issues since the SDK is ESM-only and the extension host is CommonJS.

### Session Persistence

Batch analysis supports session resumption — the `ClaudeAgentProvider` passes a `resume` parameter to maintain context across findings in the same batch.

## MCP Tools

`vsix/src/services/mcpTools.ts`

An in-process MCP server exposes two tools to the Claude agent:

### `get_finding_context`

**Parameters:** `findingId: string`

Returns the finding details plus surrounding code context (20 lines before/after the finding's line range). Reads the actual file from disk.

### `list_related_findings`

**Parameters:** `findingId: string`

Finds up to 25 related findings that share the same rule ID, scanner, or file path. Useful for understanding patterns across the codebase.

## Configuration

### VS Code Settings

All AI settings are under `ashWorkbench.llm.*`:

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `provider` | `'bedrock' \| 'anthropic-api'` | `''` | AI provider |
| `region` | string | `''` | AWS region (Bedrock) |
| `modelId` | string | `''` | Claude model ID |
| `useClaudeSettings` | boolean | `true` | Inherit from `~/.claude/settings.json` |
| `maxBudgetUsd` | number | `1.00` | Max cost per analysis |
| `toolMode` | `'read-only' \| 'full'` | `'read-only'` | Agent tool access level |
| `maxTurns` | number | `15` | Max agent turns per analysis |
| `awsProfile` | string | `''` | AWS profile name |
| `awsAuthRefresh` | string | `''` | Shell command for credential refresh (application-scoped for security) |
| `batchConsecutiveFailureLimit` | number | `3` | Stop batch after N consecutive failures |

### Claude Code Settings Inheritance

`vsix/src/services/claudeSettingsDetector.ts` reads `~/.claude/settings.json` to auto-detect the AI provider:

1. Checks for Bedrock: `env.CLAUDE_CODE_USE_BEDROCK` or top-level `awsAuthRefresh`
2. Checks for Anthropic API: `env.ANTHROPIC_API_KEY`
3. Returns `{ claudeSettingsDetected: boolean, detectedProvider: 'bedrock' | 'anthropic-api' | 'none' }`

When `useClaudeSettings` is true (default), the provider inherits credential configuration from Claude Code, avoiding duplicate setup.

### Configuration Priority

Settings are resolved in `ClaudeAgentProvider.buildQueryOptions()`:

1. Base: `useClaudeSettings=true` sets `settingSources: ['user']`
2. Explicit `modelId` in extension settings overrides the inherited model
3. Environment variables set per-query: `AWS_REGION`, `CLAUDE_CODE_USE_BEDROCK`, `AWS_PROFILE`

## Connection Testing

`AiService.testConnection()` performs a lightweight query to verify credentials:

- Uses a 10-second timeout
- Returns `{ success, model?, latencyMs, error? }`
- Accessible from the dashboard via the "Test Connection" button
- WebView shows the result via `aiTestResult` message

## Extending / Maintaining

### Changing the structured output schema

1. Update the JSON Schema in `claudeAgentProvider.ts` (the `analysisSchema` object)
2. Update the `AiAnalysis` interface in `vsix/src/models/types.ts`
3. Copy to `webview/src/types/types.ts`
4. Update `AiAnalysisPanel.tsx` in the WebView to render new fields

### Adding a new MCP tool

1. Add the tool definition and handler in `mcpTools.ts`
2. The tool is automatically available to the agent on next analysis
3. Update both tool mode lists in `claudeAgentProvider.ts` if needed

### Modifying safety hooks

1. Add or update patterns in the `SENSITIVE_FILE_PATTERNS` or `DANGEROUS_COMMAND_PATTERNS` arrays in `safetyHooks.ts`
2. Add corresponding test cases in `vsix/src/test/unit/safetyHooks.test.ts`
3. No changes needed in `claudeAgentProvider.ts` — hooks are built dynamically from the pattern arrays

To add a new hook category (e.g., blocking Write to certain paths):

1. Create a new hook factory function in `safetyHooks.ts` (follow `createFilePathHook` as a template)
2. Add a new matcher entry in `buildSafetyHooks()` (e.g., `{ matcher: 'Write', hooks: [newHook] }`)
3. Add tests for the new hook

### Adding a new AI provider

1. Implement the `AiProvider` interface from `aiProvider.ts`
2. Add provider selection logic in `AiService.ensureProvider()`
3. Add the new provider option to `ashWorkbench.llm.provider` enum in `package.json`
