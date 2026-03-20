# Data Model: Batch Analysis and Session Management

**Feature Branch**: `023-batch-ai-analysis`
**Created**: 2026-03-20

## Overview

Batch analysis is a **transient operation** — no new database entities are created. The batch exists only in memory during execution. Individual finding analyses are persisted by the existing `FindingsService.setAiAnalysis()` mechanism (from Spec 022).

## Modified Interfaces

### AnalyzeParams (aiProvider.ts)

Add optional `resume` field for session resumption:

```typescript
export interface AnalyzeParams {
  finding: FindingRow;
  workspaceRoot: string;
  maxBudgetUsd: number;
  maxTurns: number;
  toolMode: 'read-only' | 'full';
  abortSignal: AbortSignal;
  mcpServers?: Record<string, Record<string, unknown>>;
  resume?: string;  // NEW: session ID to resume for batch context
}
```

### AnalysisResultEvent (aiProvider.ts)

Add optional `sessionId` field to surface SDK session for batch reuse:

```typescript
export interface AnalysisResultEvent {
  type: 'result';
  analysis: AiAnalysis;
  metadata: AnalysisMetadata;
  sessionId?: string;  // NEW: SDK session ID for batch resumption
}
```

### AiServiceConfig (aiService.ts)

Add batch setting:

```typescript
interface AiServiceConfig {
  // ... existing fields ...
  batchConsecutiveFailureLimit: number;  // NEW: default 3
}
```

## New Transient Types

### BatchAnalysisState (aiService.ts — internal)

In-memory state for tracking a running batch. Not persisted to database.

```typescript
interface BatchAnalysisState {
  scanId: string;
  findingIds: string[];          // Ordered list of findings to analyze
  currentIndex: number;          // 0-based index into findingIds
  totalFindings: number;         // findingIds.length
  analyzedCount: number;         // Successfully completed
  failedCount: number;           // Errored findings
  skippedCount: number;          // Already analyzed or in-progress
  consecutiveFailures: number;   // Reset to 0 on success
  sessionId?: string;            // Captured from first result
  abortController: AbortController;
  status: BatchStatus;
}

type BatchStatus = 'running' | 'completed' | 'cancelled' | 'consecutive-failures' | 'error';
```

### BatchEvent (aiService.ts — callback events)

Events emitted by `analyzeAllFindings()` to the caller:

```typescript
type BatchEvent =
  | BatchStartedEvent
  | BatchProgressEvent
  | BatchFindingEvent
  | BatchCompleteEvent;

interface BatchStartedEvent {
  type: 'batch-started';
  scanId: string;
  totalFindings: number;
  findingIds: string[];
}

interface BatchProgressEvent {
  type: 'batch-progress';
  scanId: string;
  currentIndex: number;       // 1-based for display
  totalFindings: number;
  currentFindingId: string;
}

interface BatchFindingEvent {
  type: 'batch-finding-event';
  findingId: string;
  event: AnalysisEvent;       // Existing per-finding event (progress/result/error)
}

interface BatchCompleteEvent {
  type: 'batch-complete';
  scanId: string;
  analyzedCount: number;
  failedCount: number;
  skippedCount: number;
  status: BatchStatus;
}
```

## State Transitions

```
BatchStatus state machine:

  'running' ──[all findings processed]──> 'completed'
  'running' ──[user cancels]────────────> 'cancelled'
  'running' ──[consecutive failures]────> 'consecutive-failures'
  'running' ──[unrecoverable error]─────> 'error'
```

Each finding within the batch has its own lifecycle (managed by existing single-finding analysis):

```
Finding within batch:

  queued ──> analyzing ──> completed (result persisted)
  queued ──> analyzing ──> failed (error recorded, batch continues)
  queued ──> skipped (already has analysis or in-progress)
```

## No Database Changes

- No new Prisma models
- No schema migrations
- Existing `Finding.aiAnalysis` and `Finding.analysisMetadata` JSON fields are populated by the per-finding flow (unchanged)
