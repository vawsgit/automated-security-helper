# Quickstart: AI Provider Abstraction and Claude Agent SDK Integration

**Feature**: 018-ai-provider-sdk
**Date**: 2026-03-20

## What This Feature Does

Adds AI-powered security finding analysis to ASH Workbench. Users click "Analyze" on a finding, the system sends it to a Claude AI backend which autonomously reads the relevant source code and returns a structured analysis: vulnerability explanation, risk assessment, suggested fix, and references.

## Prerequisites

- Working ASH Workbench development environment (`cd vsix && npm run compile`)
- Claude Code configured with Bedrock credentials (`~/.claude/settings.json` with `CLAUDE_CODE_USE_BEDROCK=1`), OR an Anthropic API key
- At least one completed scan with findings in the database

## Key Files

| File | Purpose |
|------|---------|
| `vsix/src/services/aiProvider.ts` | AiProvider interface + shared types |
| `vsix/src/services/claudeAgentProvider.ts` | Claude Agent SDK implementation |
| `vsix/src/services/aiService.ts` | Orchestration: concurrency, persistence, error handling |
| `vsix/src/models/types.ts` | StoredAiAnalysis, AnalysisMetadata types |
| `vsix/src/models/messages.ts` | AI message types (host side) |
| `webview/src/types/messages.ts` | AI message types (WebView side, synced) |
| `vsix/prisma/schema.prisma` | Finding.aiAnalysis JSON column |

## Architecture Overview

```
User clicks "Analyze"
  → WebView sends analyzeFinding message
    → FindingsPanelManager routes to AiService
      → AiService checks concurrency (max 5)
      → AiService calls AiProvider.analyzeFinding()
        → ClaudeAgentProvider wraps SDK query()
          → SDK spawns subprocess, calls Bedrock API
          → Agent reads files, searches code, analyzes
          → Returns structured AiAnalysis via outputFormat
        ← Generator yields progress + result events
      → AiService persists result to DB
    ← Sends aiAnalysisResult to WebView
  ← AiAnalysisPanel renders the result
```

## Development Workflow

1. **Install SDK**: `cd vsix && npm install @anthropic-ai/claude-agent-sdk`
2. **Run migration**: Apply Prisma migration for aiAnalysis column
3. **Compile**: `npm run compile` (or `npm run watch`)
4. **Test**: Press F5 in VS Code to launch Extension Development Host
5. **Verify**: Run a scan, open a finding, click "Analyze"

## Testing Strategy

- **Unit tests**: Mock `query()` to return canned SDKMessage sequences. Test AiService orchestration, error categorization, concurrency limits.
- **Integration tests**: Require real Bedrock credentials. Test end-to-end from message receipt to DB persistence.
- **Mock provider**: A `MockAiProvider` implementing the interface can substitute for real API calls in all non-integration tests.

## Configuration

Default: inherits from `~/.claude/settings.json` (zero config for Claude Code users).

Override via VS Code settings:
- `ashWorkbench.llm.provider`: `"bedrock"` or `"anthropic-api"`
- `ashWorkbench.llm.modelId`: Model identifier
- `ashWorkbench.llm.region`: AWS region
- `ashWorkbench.llm.maxBudgetUsd`: Cost cap per analysis (default: $1.00)
- `ashWorkbench.llm.toolMode`: `"read-only"` (default) or `"full"`
