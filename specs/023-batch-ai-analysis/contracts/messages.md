# Message Protocol Contracts: Batch Analysis

**Feature Branch**: `023-batch-ai-analysis`
**Created**: 2026-03-20

## Overview

Batch analysis adds 5 new message types to the existing typed message protocol. Existing per-finding messages (`aiAnalysisStarted`, `aiAnalysisProgress`, `aiAnalysisResult`, `aiAnalysisError`) are unchanged and continue to fire for each finding within a batch.

## New: WebView → Extension Messages

### `analyzeAllFindings`

Triggers batch analysis of all unanalyzed findings in a scan.

```typescript
{ type: 'analyzeAllFindings'; payload: { scanId: string } }
```

**Preconditions**: No batch already in progress for this scan. At least one finding without `aiAnalysis`.
**Extension response**: Sends `batchAnalysisStarted`, then per-finding events, then `batchAnalysisComplete`.

### `cancelBatchAnalysis`

Cancels a running batch analysis.

```typescript
{ type: 'cancelBatchAnalysis'; payload: { scanId: string } }
```

**Behavior**: Aborts the currently-active finding's analysis. Remaining findings are skipped. All completed analyses are preserved.

## New: Extension → WebView Messages

### `batchAnalysisStarted`

Emitted once when a batch begins.

```typescript
{
  type: 'batchAnalysisStarted';
  payload: {
    scanId: string;
    totalFindings: number;    // Count of findings to analyze
    findingIds: string[];     // Ordered list of finding IDs
  }
}
```

### `batchAnalysisProgress`

Emitted when the batch moves to the next finding.

```typescript
{
  type: 'batchAnalysisProgress';
  payload: {
    scanId: string;
    currentIndex: number;       // 1-based (for display: "Analyzing 3 of 17")
    totalFindings: number;
    currentFindingId: string;
  }
}
```

### `batchAnalysisComplete`

Emitted once when the batch finishes (any terminal state).

```typescript
{
  type: 'batchAnalysisComplete';
  payload: {
    scanId: string;
    analyzedCount: number;      // Successfully completed
    failedCount: number;        // Per-finding errors
    skippedCount: number;       // Already analyzed or in-progress
    status: 'completed' | 'cancelled' | 'consecutive-failures' | 'error';
  }
}
```

## Message Sequence Diagrams

### Happy Path (3 findings)

```
WebView                    Extension
  │                           │
  │── analyzeAllFindings ────>│
  │                           │
  │<── batchAnalysisStarted ──│  { totalFindings: 3 }
  │<── batchAnalysisProgress ─│  { currentIndex: 1, currentFindingId: "f1" }
  │<── aiAnalysisStarted ────│  { findingId: "f1" }
  │<── aiAnalysisProgress ───│  { findingId: "f1", message: "Reading file..." }
  │<── aiAnalysisResult ─────│  { findingId: "f1", analysis: {...} }
  │                           │
  │<── batchAnalysisProgress ─│  { currentIndex: 2, currentFindingId: "f2" }
  │<── aiAnalysisStarted ────│  { findingId: "f2" }
  │<── aiAnalysisProgress ───│  { findingId: "f2", message: "Analyzing..." }
  │<── aiAnalysisResult ─────│  { findingId: "f2", analysis: {...} }
  │                           │
  │<── batchAnalysisProgress ─│  { currentIndex: 3, currentFindingId: "f3" }
  │<── aiAnalysisStarted ────│  { findingId: "f3" }
  │<── aiAnalysisResult ─────│  { findingId: "f3", analysis: {...} }
  │                           │
  │<── batchAnalysisComplete ─│  { analyzedCount: 3, status: "completed" }
```

### Cancellation Mid-Batch

```
WebView                    Extension
  │                           │
  │── analyzeAllFindings ────>│
  │<── batchAnalysisStarted ──│  { totalFindings: 5 }
  │<── batchAnalysisProgress ─│  { currentIndex: 1 }
  │<── aiAnalysisResult ─────│  { findingId: "f1" }
  │<── batchAnalysisProgress ─│  { currentIndex: 2 }
  │<── aiAnalysisStarted ────│  { findingId: "f2" }
  │                           │
  │── cancelBatchAnalysis ───>│
  │<── aiAnalysisError ──────│  { findingId: "f2", errorType: "cancelled" }
  │<── batchAnalysisComplete ─│  { analyzedCount: 1, status: "cancelled" }
```

### Consecutive Failure Threshold

```
WebView                    Extension
  │                           │
  │── analyzeAllFindings ────>│
  │<── batchAnalysisStarted ──│  { totalFindings: 10 }
  │<── batchAnalysisProgress ─│  { currentIndex: 1 }
  │<── aiAnalysisError ──────│  { findingId: "f1", errorType: "auth_failed" }
  │<── batchAnalysisProgress ─│  { currentIndex: 2 }
  │<── aiAnalysisError ──────│  { findingId: "f2", errorType: "auth_failed" }
  │<── batchAnalysisProgress ─│  { currentIndex: 3 }
  │<── aiAnalysisError ──────│  { findingId: "f3", errorType: "auth_failed" }
  │                           │
  │<── batchAnalysisComplete ─│  { failedCount: 3, status: "consecutive-failures" }
```

## Coexistence with Single-Finding Messages

During a batch, per-finding messages (`aiAnalysisStarted`, `aiAnalysisProgress`, `aiAnalysisResult`, `aiAnalysisError`) continue to fire for each finding individually. The WebView uses these to update per-finding analysis states in the existing `analysisStates` reducer.

Batch messages provide the overlay: overall progress counter and terminal status. The WebView tracks these in a separate `batchAnalysisState` field in `AppState`.

## Settings Contract

### New Setting

```json
"ashWorkbench.llm.batchConsecutiveFailureLimit": {
  "type": "number",
  "default": 3,
  "minimum": 1,
  "maximum": 100,
  "description": "Maximum consecutive analysis failures before stopping batch processing. Resets to zero after each successful analysis."
}
```
