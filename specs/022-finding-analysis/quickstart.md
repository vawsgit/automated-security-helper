# Quickstart: Finding Analysis — Core AI Feature

**Branch**: `022-finding-analysis` | **Date**: 2026-03-20

## What This Feature Does

Adds the end-to-end AI finding analysis flow: a user clicks "Analyze" on a security finding, a Claude agent reads the source code and produces a structured vulnerability analysis that's displayed in the UI and saved to the database.

## Prerequisites

- ASH Workbench extension compiled and running in VS Code
- `@anthropic-ai/claude-agent-sdk` already installed (in `vsix/package.json`)
- AI credentials configured (via Claude Code inheritance or `ashWorkbench.llm.*` settings)
- At least one completed scan with findings in the database

## Implementation Summary

### What Already Exists (Specs 018-021)

All foundational infrastructure is built:
- `AiService` (orchestrator with concurrency, cancellation, config)
- `ClaudeAgentProvider` (SDK integration, prompt building, event streaming)
- Message protocol (7 AI message types)
- `FindingsPanelManager` handlers (analyze, cancel, test connection)
- Database persistence (`setAiAnalysis`, `clearAiAnalysis`)
- `AiAnalysisPanel` component (results display)
- Type definitions and settings

### What This Spec Adds

| Area | Change |
|------|--------|
| **Custom MCP Tools** | New `mcpTools.ts` — `get_finding_context` and `list_related_findings` tools |
| **MCP Registration** | Update `claudeAgentProvider.ts` — register MCP server in query options |
| **FindingRow.analysisMetadata** | Add metadata field to `types.ts` (both packages) and mapper |
| **WebView Reducer** | Update `App.tsx` — track per-finding analysis UI state (progress, error) |
| **FindingDetailView** | Add "Analyze" button, progress indicator, cancel button |
| **AiAnalysisPanel** | Add metadata section (model, cost, tools used) |
| **Error Guidance** | User-friendly error messages mapped to error types |

### File Change Map

```
vsix/src/
├── services/
│   ├── mcpTools.ts                    # NEW: Custom MCP tool definitions
│   └── claudeAgentProvider.ts         # MODIFY: Register MCP server in query()
├── models/
│   ├── types.ts                       # MODIFY: Add analysisMetadata to FindingRow
│   └── mappers.ts                     # MODIFY: Extract metadata in mapFindingToRow
webview/src/
├── types/
│   └── types.ts                       # MODIFY: Add analysisMetadata to FindingRow (sync)
├── components/
│   ├── FindingDetailView.tsx          # MODIFY: Add Analyze button, progress, cancel
│   └── AiAnalysisPanel.tsx            # MODIFY: Add metadata section
└── App.tsx                            # MODIFY: Handle progress/error in reducer
```

## How to Test

1. Open a workspace with a completed scan
2. Click on any finding in the findings list
3. Click the "Analyze" button in the finding detail view
4. Observe progress messages streaming (e.g., "Reading auth.py…")
5. Wait for the structured analysis to appear
6. Verify metadata section shows model, cost, and tools used
7. Navigate away and back — analysis should be persisted
8. Test cancellation: click "Analyze", then "Cancel" during progress
9. Test re-analysis: click "Re-analyze" on a finding with existing analysis
