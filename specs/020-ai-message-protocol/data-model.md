# Data Model: AI Message Protocol and Test Connection

**Feature**: 020-ai-message-protocol
**Date**: 2026-03-20

## Overview

This feature does not introduce new database entities. It extends the typed message protocol between extension host and WebView and adds UI state to the WebView's in-memory AppState. All data flows are transient (not persisted to the database) except AI analysis results, which are already persisted by the existing `FindingsService.setAiAnalysis()` from Spec 018.

## Entity: stateUpdate Payload (Extended)

**Location**: `ExtToWebviewMessage` discriminated union

**Existing fields** (unchanged):
- `scans: ScanSummary[]`
- `summary: DispositionSummary`
- `scanTargets: ScanTarget[]`
- `scanRoot: string`

**New fields**:
- `claudeSettingsDetected: boolean` — Whether `~/.claude/settings.json` contains usable AI provider configuration
- `detectedProvider: 'bedrock' | 'anthropic-api' | 'none'` — Which provider type was detected

**Lifecycle**: Computed at extension activation, included in every `stateUpdate` message. Defaults to `{ false, 'none' }` until detection completes.

## Entity: WebView AppState (Extended)

**Location**: `webview/src/App.tsx` AppState interface

**New fields**:

| Field | Type | Default | Source |
|-------|------|---------|--------|
| `claudeSettingsDetected` | `boolean` | `false` | `stateUpdate` message |
| `detectedProvider` | `'bedrock' \| 'anthropic-api' \| 'none'` | `'none'` | `stateUpdate` message |
| `aiTestStatus` | `'idle' \| 'testing' \| 'success' \| 'error'` | `'idle'` | Local UI state + `aiTestResult` message |
| `aiTestResult` | `AiTestResultPayload \| null` | `null` | `aiTestResult` message |

**State transitions for `aiTestStatus`**:
```
idle ──[user clicks Test]──> testing ──[aiTestResult success]──> success
                                      ──[aiTestResult failure]──> error
success ──[user clicks Test]──> testing
error ──[user clicks Test]──> testing
```

## Entity: AiTestResultPayload (New View Type)

**Location**: Inline in message type (already defined)

| Field | Type | Description |
|-------|------|-------------|
| `success` | `boolean` | Whether the connection test passed |
| `model` | `string \| undefined` | Model name (present on success) |
| `latencyMs` | `number` | Round-trip latency in milliseconds |
| `error` | `{ type: string; message: string } \| undefined` | Categorized error (present on failure) |

## Existing Entities (No Changes)

The following AI-related entities already exist from Spec 018 and require no modifications:

- **AiAnalysis** — explanation, riskAssessment, suggestedFix, references
- **AnalysisMetadata** — analyzedAt, modelId, costUsd, toolsUsed
- **ConnectionTestResult** — success, model, latencyMs, error (extension host side)
- **AnalysisEvent** — progress, result, error events (extension host side)
- **ClaudeSettingsDetection** — claudeSettingsDetected, detectedProvider (extension host side)
