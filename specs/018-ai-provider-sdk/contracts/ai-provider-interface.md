# Contract: AiProvider Interface

**Feature**: 018-ai-provider-sdk
**Date**: 2026-03-20

## Overview

The `AiProvider` interface is the abstraction boundary between the AI orchestration layer (`AiService`) and any AI backend implementation. All AI operations flow through this interface. The orchestration layer never references a concrete provider directly.

## Interface Definition

```typescript
interface AiProvider {
  /**
   * Analyze a security finding. Returns an async generator that yields
   * progress events during analysis and a final result or error event.
   * Supports cancellation via AbortSignal.
   */
  analyzeFinding(
    params: AnalyzeParams,
  ): AsyncGenerator<AnalysisEvent, void, undefined>;

  /**
   * Validate that the AI backend is reachable, authenticated, and the
   * configured model is available. Returns a result with diagnostics.
   */
  testConnection(): Promise<ConnectionTestResult>;

  /**
   * Report what capabilities this provider supports. The orchestration
   * layer may adjust behavior based on capabilities.
   */
  getCapabilities(): ProviderCapabilities;
}
```

## Parameter Types

```typescript
interface AnalyzeParams {
  /** The finding to analyze, loaded from the database */
  finding: FindingRow;
  /** Workspace root path for codebase navigation */
  workspaceRoot: string;
  /** Maximum cost allowed for this analysis in USD */
  maxBudgetUsd: number;
  /** Maximum reasoning iterations allowed */
  maxTurns: number;
  /** Tool access level */
  toolMode: 'read-only' | 'full';
  /** Cancellation signal */
  abortSignal: AbortSignal;
}
```

## Event Types

```typescript
/** Discriminated union of events yielded during analysis */
type AnalysisEvent =
  | AnalysisProgressEvent
  | AnalysisResultEvent
  | AnalysisErrorEvent;

interface AnalysisProgressEvent {
  type: 'progress';
  /** Human-readable status message (e.g., "Reading auth.py...") */
  message: string;
  /** Optional tool name being used */
  toolName?: string;
}

interface AnalysisResultEvent {
  type: 'result';
  /** The structured analysis output */
  analysis: AiAnalysis;
  /** Metadata about the analysis run */
  metadata: AnalysisMetadata;
}

interface AnalysisErrorEvent {
  type: 'error';
  /** Error category for UI display */
  errorType: AnalysisErrorType;
  /** Human-readable error message */
  message: string;
}

type AnalysisErrorType =
  | 'credentials_missing'
  | 'auth_failed'
  | 'model_unavailable'
  | 'budget_exceeded'
  | 'max_turns_exceeded'
  | 'format_error'
  | 'network_error'
  | 'cancelled'
  | 'unknown';
```

## Result Types

```typescript
interface ConnectionTestResult {
  success: boolean;
  /** Model identifier that responded */
  model?: string;
  /** Round-trip latency in milliseconds */
  latencyMs: number;
  /** Error details if success is false */
  error?: {
    type: AnalysisErrorType;
    message: string;
  };
}

interface ProviderCapabilities {
  /** Provider supports JSON schema validated output */
  structuredOutput: boolean;
  /** Provider can read/search the codebase autonomously */
  toolUse: boolean;
  /** Provider can edit files (requires full tool mode) */
  codeEditing: boolean;
  /** Provider can search the web for CVE/advisory info */
  webSearch: boolean;
  /** Provider supports session persistence across queries */
  sessionPersistence: boolean;
}

interface AnalysisMetadata {
  analyzedAt: string;    // ISO 8601
  modelId: string;
  costUsd: number;
  toolsUsed: string[];
}
```

## Contract Rules

1. **`analyzeFinding()` MUST yield at least one `progress` event** before yielding a `result` or `error` event. This ensures the UI can show immediate feedback (SC-003: first progress within 5 seconds).

2. **`analyzeFinding()` MUST yield exactly one terminal event** — either `result` or `error` — as the last event before the generator completes. The orchestration layer uses this to determine the final outcome.

3. **`analyzeFinding()` MUST respect the `abortSignal`**. When the signal fires, the generator should yield an `error` event with `errorType: 'cancelled'` and return promptly (within 5 seconds per SC-004).

4. **`testConnection()` MUST complete within 10 seconds** (SC-001). If the backend does not respond in time, return `{ success: false, error: { type: 'network_error', message: '...' } }`.

5. **`getCapabilities()` is synchronous and static**. It reflects the provider's inherent capabilities, not runtime state. It does not make network calls.

6. **Error categorization is the provider's responsibility**. The provider must map backend-specific errors to the `AnalysisErrorType` enum before yielding them. The orchestration layer does not interpret raw errors.
