# Research: Finding Analysis — Core AI Feature

**Branch**: `022-finding-analysis` | **Date**: 2026-03-20

## Phase 0 Research Findings

### R-001: Existing Infrastructure Assessment

**Decision**: The majority of the Finding Analysis pipeline is already implemented across Specs 018-021. This spec focuses on completing the end-to-end flow rather than building from scratch.

**Rationale**: Thorough codebase exploration reveals the following are already built and working:

| Component | File | Status |
|-----------|------|--------|
| AiService orchestrator | `vsix/src/services/aiService.ts` | Complete: concurrency, cancellation, config loading, event loop |
| ClaudeAgentProvider | `vsix/src/services/claudeAgentProvider.ts` | Complete: SDK query, structured output, prompt building, error categorization |
| AiProvider interface | `vsix/src/services/aiProvider.ts` | Complete: types, events, params |
| Message protocol types | `vsix/src/models/messages.ts` | Complete: all 7 AI message types defined |
| FindingsPanelManager handlers | `vsix/src/providers/findingsPanelManager.ts` | Complete: analyzeFinding, cancelAiAnalysis, testAiConnection handlers |
| FindingsService persistence | `vsix/src/services/findings.ts` | Complete: setAiAnalysis, clearAiAnalysis, getFindingDetail |
| DB schema (Finding.aiAnalysis) | `vsix/prisma/schema.prisma` | Complete: JSON column, indexes |
| Type definitions | `vsix/src/models/types.ts` | Complete: AiAnalysis, AnalysisMetadata, StoredAiAnalysis |
| AiAnalysisPanel (results display) | `webview/src/components/AiAnalysisPanel.tsx` | Complete: accordion with explanation, risk, fix, references |
| FindingDetailView integration | `webview/src/components/FindingDetailView.tsx` | Partial: renders AiAnalysisPanel if analysis exists, no trigger button |
| App.tsx reducer (AI messages) | `webview/src/App.tsx` | Partial: aiAnalysisResult updates state; started/progress/error are no-ops |
| Extension wiring | `vsix/src/extension.ts` | Complete: AiService init, injected into panel manager |
| Settings (package.json) | `vsix/package.json` | Complete: all LLM settings declared |
| SDK dependency | `vsix/package.json` | Complete: `@anthropic-ai/claude-agent-sdk ^0.2.80` installed |
| buildQueryOptions tests | `vsix/src/test/unit/buildQueryOptions.test.ts` | Complete: config merging verified |

**Alternatives considered**: Building from scratch — rejected because the infrastructure is solid and tested.

### R-002: Custom MCP Tools Implementation

**Decision**: Implement two custom MCP tools using the Claude Agent SDK's `McpServer` pattern and register them in the query options.

**Rationale**: The SDK supports MCP servers via the `mcpServers` option in `query()`. Custom tools give the agent access to structured finding data beyond what's in the prompt, improving analysis quality.

**Tool definitions**:

1. **`get_finding_context`**: Accepts `findingId`, returns full finding details plus surrounding code lines (±20 lines around the finding's line range). Uses `FindingsService.getFindingDetail()` for DB data and `fs.readFile` for source code.

2. **`list_related_findings`**: Accepts `findingId`, returns findings from the same scan with matching `ruleId`, `scanner`, or `file`. Uses Prisma query with OR conditions scoped to `scanId` of the target finding.

**Alternatives considered**:
- Embedding all context in the system prompt — rejected because it bloats the prompt for large files and doesn't allow the agent to explore selectively.
- Using filesystem tools only — rejected because the agent can't access DB-stored finding metadata or discover related findings.

### R-003: WebView Progress/Cancel UI Approach

**Decision**: Add analysis state tracking per-finding in the WebView reducer. Render an "Analyze" button, a progress indicator with cancel, and metadata section directly in `FindingDetailView`.

**Rationale**: The current reducer acknowledges `aiAnalysisStarted`, `aiAnalysisProgress`, and `aiAnalysisError` but does nothing with them (returns `state` unchanged). These need to update a per-finding analysis state that the UI can render.

**State model**: A `Map<string, AnalysisUIState>` keyed by findingId, where `AnalysisUIState` is `{ status: 'analyzing' | 'error', message?: string, toolName?: string, errorType?: string }`. Cleared on result or navigation reset.

**Alternatives considered**:
- Global singleton progress state — rejected because multiple concurrent analyses need independent tracking.
- Separate progress panel — rejected per constitution (Simplicity First).

### R-004: Metadata Display in AiAnalysisPanel

**Decision**: Extend `AiAnalysisPanel` to accept and display `AnalysisMetadata` (model, cost, timestamp, tools used) in a collapsible section.

**Rationale**: The current panel only receives `AiAnalysis` (the content). The `StoredAiAnalysis` type already bundles `{ analysis, metadata }` in the DB. The `FindingRow` type needs to carry metadata through to the WebView so the panel can display it.

**Alternatives considered**:
- Separate metadata component — rejected because metadata is contextually part of the analysis display.
- Omitting metadata for MVP — rejected because the spec lists it as FR-014.

### R-005: Claude Agent SDK MCP Server API

**Decision**: Use the SDK's `McpServer` class to create an in-process MCP server with custom tools.

**Rationale**: The `@anthropic-ai/claude-agent-sdk` exports `McpServer` which accepts tool definitions with input schemas and handler functions. The server is passed to `query()` via the `mcpServers` option. This is the idiomatic way to extend agent capabilities.

**Implementation pattern**:
```
const server = new McpServer({ tools: [...] });
query({ ..., mcpServers: [server] });
```

**Alternatives considered**:
- Standalone MCP server process — rejected per constitution (VS Code Native, no external processes beyond ASH CLI).
- Injecting context only via prompt — see R-002.

### R-006: FindingRow Metadata Propagation

**Decision**: Extend `FindingRow` to include `analysisMetadata: AnalysisMetadata | null` alongside the existing `aiAnalysis` field. Update mappers to extract both from `StoredAiAnalysis`.

**Rationale**: Currently `mapFindingToRow` maps `Finding.aiAnalysis` (JSON) to `FindingRow.aiAnalysis` but only extracts the `analysis` portion. The `metadata` is stored but never surfaced to the WebView. Both `types.ts` files (vsix and webview) need the new field, and the mapper needs to extract `stored.metadata`.

**Alternatives considered**:
- Passing metadata as a separate message — rejected because it's already persisted alongside the analysis and should travel with the finding data.
