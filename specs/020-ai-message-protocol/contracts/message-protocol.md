# Contract: AI Message Protocol

**Feature**: 020-ai-message-protocol
**Date**: 2026-03-20

## Overview

Typed message contract between Extension Host and WebView for AI features. Uses the existing `postMessage` channel with discriminated unions keyed on `type`.

## Extension Host → WebView Messages

### aiTestResult

Sent in response to `testAiConnection`. Contains the outcome of a connection test.

```typescript
{
  type: 'aiTestResult';
  payload: {
    success: boolean;
    model?: string;        // Present on success
    latencyMs: number;
    error?: {
      type: string;        // AnalysisErrorType
      message: string;     // Human-readable
    };
  };
}
```

**Sent by**: `SidebarWebviewProvider.handleTestAiConnection()`
**Handled by**: WebView reducer → updates `aiTestStatus` and `aiTestResult`

### aiAnalysisStarted

Sent when an analysis begins for a finding.

```typescript
{
  type: 'aiAnalysisStarted';
  payload: {
    findingId: string;
    model: string;
  };
}
```

**Sent by**: `FindingsPanelManager` (before calling `AiService.analyzeFinding()`)
**Handled by**: WebView reducer → marks finding analysis as in-progress

### aiAnalysisProgress

Sent during analysis to report progress.

```typescript
{
  type: 'aiAnalysisProgress';
  payload: {
    findingId: string;
    message: string;       // Human-readable status text
    toolName?: string;     // Name of tool currently in use
  };
}
```

**Sent by**: `FindingsPanelManager` (relaying `AiService` progress events)
**Handled by**: WebView → updates progress indicator for the finding

### aiAnalysisResult

Sent when analysis completes successfully.

```typescript
{
  type: 'aiAnalysisResult';
  payload: {
    findingId: string;
    analysis: AiAnalysis;
    metadata: AnalysisMetadata;
  };
}
```

**Sent by**: `FindingsPanelManager` (relaying `AiService` result event)
**Handled by**: WebView reducer → stores analysis on the finding, clears progress state

### aiAnalysisError

Sent when analysis fails.

```typescript
{
  type: 'aiAnalysisError';
  payload: {
    findingId: string;
    errorType: string;     // AnalysisErrorType enum value
    message: string;       // Human-readable error
  };
}
```

**Sent by**: `FindingsPanelManager` (relaying `AiService` error event)
**Handled by**: WebView → displays categorized error for the finding

### stateUpdate (Extended)

Existing message with two new fields for AI configuration status.

```typescript
{
  type: 'stateUpdate';
  payload: {
    scans: ScanSummary[];
    summary: DispositionSummary;
    scanTargets: ScanTarget[];
    scanRoot: string;
    claudeSettingsDetected: boolean;            // NEW
    detectedProvider: 'bedrock' | 'anthropic-api' | 'none';  // NEW
  };
}
```

**Sent by**: `SidebarWebviewProvider.queryStateAndPost()`, `FindingsPanelManager.postStateUpdate()`
**Handled by**: WebView reducer → updates `claudeSettingsDetected` and `detectedProvider`

## WebView → Extension Host Messages

### testAiConnection

Triggers a connection test.

```typescript
{ type: 'testAiConnection' }
```

**Sent by**: Dashboard "Test Connection" button click
**Handled by**: `SidebarWebviewProvider.handleTestAiConnection()`

### analyzeFinding

Triggers AI analysis for a specific finding.

```typescript
{
  type: 'analyzeFinding';
  payload: { findingId: string };
}
```

**Sent by**: Finding detail view "Analyze" action
**Handled by**: `FindingsPanelManager` → `AiService.analyzeFinding()`

### cancelAiAnalysis

Cancels an in-progress analysis.

```typescript
{
  type: 'cancelAiAnalysis';
  payload: { findingId: string };
}
```

**Sent by**: Finding detail view "Cancel" action
**Handled by**: `FindingsPanelManager` → `AiService.cancelAnalysis()`

## Error Type Taxonomy

| Error Type | When Raised | User-Facing Message |
|---|---|---|
| `credentials_missing` | No API key or AWS config found | "No API credentials found. Configure your AI provider in Settings." |
| `auth_failed` | API key invalid or AWS auth rejected | "Authentication failed. Check your API key or AWS credentials." |
| `model_unavailable` | Model not enabled in region | "Model not available. Check your region and model settings." |
| `network_error` | Connection timeout or DNS failure | "Network error. Check your internet connection and try again." |
| `budget_exceeded` | Analysis cost exceeds maxBudgetUsd | "Analysis budget exceeded." |
| `max_turns_exceeded` | Agent hit maxTurns limit | "Analysis reached maximum turns limit." |
| `format_error` | AI response failed structured parsing | "AI response could not be parsed. Try again." |
| `cancelled` | User cancelled via cancelAiAnalysis | "Analysis cancelled." |
| `unknown` | Unclassified error | "An unexpected error occurred. Check the ASH output channel for details." |

## Handler Routing

| Message | Provider | Handler Method |
|---|---|---|
| `testAiConnection` | SidebarWebviewProvider | `handleTestAiConnection()` |
| `analyzeFinding` | FindingsPanelManager | inline in `handleMessage()` switch |
| `cancelAiAnalysis` | FindingsPanelManager | inline in `handleMessage()` switch |
