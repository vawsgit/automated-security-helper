# Message Contract: Extension → WebView (Triage)

**Feature**: 026-repairability-triage | **Date**: 2026-03-23

These messages are added to the existing `ExtToWebviewMessage` discriminated union in `vsix/src/models/messages.ts` and mirrored in `webview/src/types/messages.ts`.

## New Message Types

### triageSummaryUpdate

Sent when the triage dashboard loads or when a triage action changes counts. Contains aggregated counts for the dashboard charts.

```typescript
{
  type: 'triageSummaryUpdate';
  payload: {
    summary: TriageSummary;
  };
}
```

### triageClassificationStarted

Sent when batch triage classification begins. Provides total count for progress bar.

```typescript
{
  type: 'triageClassificationStarted';
  payload: {
    totalFindings: number;
    findingIds: string[];
  };
}
```

### triageClassificationProgress

Sent after each finding is processed during batch classification. Drives the progress indicator.

```typescript
{
  type: 'triageClassificationProgress';
  payload: {
    currentIndex: number;      // 1-based
    totalFindings: number;
    currentFindingId: string;
    status: 'classifying' | 'skipped' | 'failed';
    message?: string;          // Human-readable status (e.g., "Classifying: SQL injection in auth.ts")
  };
}
```

### triageClassificationResult

Sent when a single finding's triage classification completes successfully.

```typescript
{
  type: 'triageClassificationResult';
  payload: {
    findingId: string;
    analysis: TriageClassification;
    metadata: TriageMetadata;
  };
}
```

### triageClassificationError

Sent when classification fails for a specific finding.

```typescript
{
  type: 'triageClassificationError';
  payload: {
    findingId: string;
    errorType: string;         // e.g., 'provider_error', 'budget_exceeded', 'timeout'
    message: string;
  };
}
```

### triageClassificationComplete

Sent when the entire batch classification finishes (success, cancelled, or failed).

```typescript
{
  type: 'triageClassificationComplete';
  payload: {
    analyzedCount: number;
    failedCount: number;
    skippedCount: number;      // Already classified + cache hits
    status: 'completed' | 'cancelled' | 'consecutive-failures' | 'error';
  };
}
```

### triageFixApplied

Sent when an easy fix is successfully applied to a source file.

```typescript
{
  type: 'triageFixApplied';
  payload: {
    findingId: string;
    filePath: string;          // Relative path of modified file
    disposition: 'FIX';        // Finding disposition after fix
  };
}
```

### triageFixError

Sent when applying an easy fix fails (stale code, file not found, write error).

```typescript
{
  type: 'triageFixError';
  payload: {
    findingId: string;
    errorType: 'stale_code' | 'file_not_found' | 'write_error' | 'path_validation';
    message: string;
  };
}
```

### triageSuppressed

Sent when a one-click suppression from triage is successfully written.

```typescript
{
  type: 'triageSuppressed';
  payload: {
    findingId: string;
    disposition: 'SUPPRESS';   // Finding disposition after suppression
  };
}
```

### triageSuppressionError

Sent when one-click suppression fails.

```typescript
{
  type: 'triageSuppressionError';
  payload: {
    findingId: string;
    errorType: string;
    message: string;
  };
}
```

## Integration with Existing Messages

The existing `stateUpdate` message remains unchanged. The `triageSummaryUpdate` is a separate message to avoid coupling triage state with the general state update lifecycle.

The existing `findingsUpdate` message may carry findings with populated `triageAnalysis` fields after classification — the WebView uses these for rendering triage badges in the drill-down list.
