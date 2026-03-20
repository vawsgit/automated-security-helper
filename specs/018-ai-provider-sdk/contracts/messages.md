# Contract: AI Message Protocol

**Feature**: 018-ai-provider-sdk
**Date**: 2026-03-20

## Overview

New message types added to the typed message protocol between extension host and WebView. These extend the existing `ExtToWebviewMessage` and `WebviewToExtMessage` discriminated unions.

## Extension Host → WebView (New Messages)

```typescript
// Add to ExtToWebviewMessage union:

| { type: 'aiAnalysisStarted'; payload: {
    findingId: string;
    model: string;
  }}

| { type: 'aiAnalysisProgress'; payload: {
    findingId: string;
    message: string;      // Human-readable status
    toolName?: string;    // Optional tool being used
  }}

| { type: 'aiAnalysisResult'; payload: {
    findingId: string;
    analysis: AiAnalysis;
    metadata: {
      analyzedAt: string;
      modelId: string;
      costUsd: number;
      toolsUsed: string[];
    };
  }}

| { type: 'aiAnalysisError'; payload: {
    findingId: string;
    errorType: string;    // AnalysisErrorType value
    message: string;      // User-facing error message
  }}

| { type: 'aiTestResult'; payload: {
    success: boolean;
    model?: string;
    latencyMs: number;
    error?: {
      type: string;
      message: string;
    };
  }}
```

## WebView → Extension Host (New Messages)

```typescript
// Add to WebviewToExtMessage union:

| { type: 'testAiConnection' }

| { type: 'analyzeFinding'; payload: {
    findingId: string;
  }}

| { type: 'cancelAiAnalysis'; payload: {
    findingId: string;
  }}
```

## Message Flow: Connection Test

```
WebView                    Extension Host
  │                              │
  ├── testAiConnection ────────> │
  │                              ├── AiService.testConnection()
  │                              │      └── provider.testConnection()
  │ <──── aiTestResult ─────────┤
  │                              │
```

## Message Flow: Finding Analysis

```
WebView                    Extension Host
  │                              │
  ├── analyzeFinding ──────────> │
  │                              ├── Check concurrency (< 5 active)
  │                              ├── AiService.analyzeFinding()
  │ <──── aiAnalysisStarted ────┤
  │                              │
  │ <──── aiAnalysisProgress ───┤  (repeated, from generator)
  │ <──── aiAnalysisProgress ───┤
  │ <──── aiAnalysisProgress ───┤
  │                              │
  │ <──── aiAnalysisResult ─────┤  (on success, result persisted to DB)
  │    OR                        │
  │ <──── aiAnalysisError ──────┤  (on failure)
  │                              │
```

## Message Flow: Cancellation

```
WebView                    Extension Host
  │                              │
  ├── cancelAiAnalysis ────────> │
  │                              ├── AbortController.abort()
  │                              │      └── SDK query terminates
  │ <──── aiAnalysisError ──────┤  (errorType: 'cancelled')
  │                              │
```

## Contract Rules

1. **Messages are keyed by `findingId`**. Multiple analyses can be in flight for different findings. The WebView uses `findingId` to route progress/result/error to the correct UI element.

2. **`aiAnalysisStarted` is sent immediately** when the analysis request is accepted (before the first SDK message). This allows the UI to transition to a loading state instantly.

3. **`aiAnalysisProgress` messages are fire-and-forget**. The WebView may receive 0 or many progress messages. It should display the most recent one, not accumulate them.

4. **Exactly one terminal message per analysis**: either `aiAnalysisResult` or `aiAnalysisError`. The WebView uses this to exit the loading state.

5. **`aiAnalysisError` with `errorType: 'cancelled'` is the expected response to `cancelAiAnalysis`**. The WebView should treat this as a clean stop, not a failure.

6. **Concurrency rejection** is returned as `aiAnalysisError` with `errorType: 'unknown'` and message "Too many analyses in progress (max 5). Please wait for one to complete." This is sent synchronously before any `aiAnalysisStarted`.

7. **All new types MUST be added to both** `vsix/src/models/messages.ts` and `webview/src/types/messages.ts` (manual sync per constitution principle IV).
