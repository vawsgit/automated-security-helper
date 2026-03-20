# Message Protocol Contracts: Finding Analysis

**Branch**: `022-finding-analysis` | **Date**: 2026-03-20

## Existing Messages (No Changes)

All message types for AI analysis are already defined in `vsix/src/models/messages.ts` and `webview/src/types/messages.ts`. No new message types are needed.

### Extension Host → WebView

| Message Type | Payload | When Sent |
|-------------|---------|-----------|
| `aiAnalysisStarted` | `{ findingId: string, model: string }` | Immediately when analysis is triggered |
| `aiAnalysisProgress` | `{ findingId: string, message: string, toolName?: string }` | On each agent tool use or progress event |
| `aiAnalysisResult` | `{ findingId: string, analysis: AiAnalysis, metadata: AnalysisMetadata }` | On successful completion |
| `aiAnalysisError` | `{ findingId: string, errorType: string, message: string }` | On any failure |

### WebView → Extension Host

| Message Type | Payload | When Sent |
|-------------|---------|-----------|
| `analyzeFinding` | `{ findingId: string }` | User clicks "Analyze" or "Re-analyze" |
| `cancelAiAnalysis` | `{ findingId: string }` | User clicks "Cancel" during analysis |

## New Contract: Custom MCP Tool Schemas

### get_finding_context

```json
{
  "name": "get_finding_context",
  "description": "Retrieves full finding details including surrounding source code context from the project database. Use this to get comprehensive information about the finding being analyzed.",
  "inputSchema": {
    "type": "object",
    "properties": {
      "findingId": {
        "type": "string",
        "description": "The unique ID of the finding to retrieve context for"
      }
    },
    "required": ["findingId"]
  }
}
```

**Response shape**:
```json
{
  "finding": {
    "id": "string",
    "title": "string",
    "description": "string",
    "severity": "CRITICAL | HIGH | MEDIUM | LOW | INFO",
    "scanner": "string",
    "ruleId": "string",
    "filePath": "string",
    "startLine": "number",
    "endLine": "number | null",
    "codeSnippet": "string | null",
    "disposition": "PENDING | FIX | SUPPRESS | DEFER",
    "notes": "string | null"
  },
  "surroundingCode": "string (±20 lines around the finding)",
  "fileExists": "boolean"
}
```

### list_related_findings

```json
{
  "name": "list_related_findings",
  "description": "Lists findings from the current scan that are related to the target finding by sharing the same rule ID, scanner, or file. Use this to discover patterns and assess whether a vulnerability appears in multiple locations.",
  "inputSchema": {
    "type": "object",
    "properties": {
      "findingId": {
        "type": "string",
        "description": "The unique ID of the finding to find related findings for"
      }
    },
    "required": ["findingId"]
  }
}
```

**Response shape**:
```json
{
  "relatedFindings": [
    {
      "id": "string",
      "title": "string",
      "severity": "string",
      "scanner": "string",
      "ruleId": "string",
      "filePath": "string",
      "startLine": "number",
      "matchReason": "same_rule | same_scanner | same_file"
    }
  ],
  "totalCount": "number"
}
```

## Error Message Guidance Map

| errorType | User-Facing Message Template |
|-----------|------------------------------|
| `credentials_missing` | "AI provider credentials are not configured. Open Settings and configure ashWorkbench.llm.provider and credentials." |
| `auth_failed` | "Authentication failed. Check your API key or AWS credentials in Settings." |
| `model_unavailable` | "The configured model is not available. Check ashWorkbench.llm.modelId in Settings." |
| `budget_exceeded` | "Analysis stopped: cost reached the $X.XX budget limit. Increase ashWorkbench.llm.maxBudgetUsd in Settings to allow more." |
| `max_turns_exceeded` | "Analysis stopped after {N} reasoning iterations without completing. Increase ashWorkbench.llm.maxTurns in Settings and retry." |
| `network_error` | "Network error connecting to the AI provider. Check your connection and retry." |
| `cancelled` | "Analysis cancelled." |
| `format_error` | "The AI agent did not return a valid analysis format. Try again." |
| `unknown` | "An unexpected error occurred during analysis. Check the ASH Workbench output channel for details." |
