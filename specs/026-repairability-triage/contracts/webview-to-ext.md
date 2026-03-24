# Message Contract: WebView → Extension (Triage)

**Feature**: 026-repairability-triage | **Date**: 2026-03-23

These messages are added to the existing `WebviewToExtMessage` discriminated union in `vsix/src/models/messages.ts` and mirrored in `webview/src/types/messages.ts`.

## New Message Types

### requestTriageSummary

Sent when the triage dashboard view loads. Triggers the extension to compute and return a `triageSummaryUpdate`.

```typescript
{
  type: 'requestTriageSummary';
}
```

### startTriageClassification

Sent when the user initiates triage classification (auto on dashboard open for unanalyzed HIGH findings, or manual retry). The extension identifies eligible findings (HIGH severity, not suppressed, not already classified or stale), classifies them, and streams progress events.

```typescript
{
  type: 'startTriageClassification';
}
```

### retryTriageClassification

Sent when the user retries classification for a specific finding that previously failed.

```typescript
{
  type: 'retryTriageClassification';
  payload: {
    findingId: string;
  };
}
```

### cancelTriageClassification

Sent when the user cancels an in-progress batch classification.

```typescript
{
  type: 'cancelTriageClassification';
}
```

### applyTriageFix

Sent when the user clicks the "Fix" button on an easy-fix finding. The extension reads the file, validates the `codeBefore` match, applies the replacement, and responds with `triageFixApplied` or `triageFixError`.

```typescript
{
  type: 'applyTriageFix';
  payload: {
    findingId: string;
  };
}
```

### applyTriageSuppression

Sent when the user clicks the "Suppress" button on a suppress-category finding. The extension uses the pre-generated justification and scope from the triage classification to write the suppression entry. Responds with `triageSuppressed` or `triageSuppressionError`.

```typescript
{
  type: 'applyTriageSuppression';
  payload: {
    findingId: string;
  };
}
```

### requestRepairGuidance

Sent when the user views a systemic finding's repair guidance. The extension retrieves the stored guidance from the triage classification and returns it in a `triageClassificationResult` message (reusing the existing result message for the finding detail).

Note: The guidance is already stored in the `triageAnalysis` and available on the `FindingRow`. This message is only needed if the full guidance text exceeds what's sent in the standard `findingDetail` payload (future optimization).

```typescript
{
  type: 'requestRepairGuidance';
  payload: {
    findingId: string;
  };
}
```

## Message Flow Diagrams

### Dashboard Load Flow

```
WebView                          Extension Host
  │                                    │
  ├─ requestTriageSummary ───────────► │
  │                                    ├─ Compute TriageSummary from DB
  │  ◄──────────── triageSummaryUpdate ┤
  │                                    │
  ├─ startTriageClassification ──────► │
  │                                    ├─ Identify unanalyzed HIGH findings
  │  ◄─── triageClassificationStarted ┤
  │                                    │
  │  (for each finding)                │
  │  ◄── triageClassificationProgress ├─ Classify finding N of M
  │  ◄──── triageClassificationResult ├─ Store result, emit
  │                                    │
  │  ◄── triageClassificationComplete ┤
  │  ◄──────────── triageSummaryUpdate ┤  (updated counts)
  │                                    │
```

### One-Click Suppress Flow

```
WebView                          Extension Host
  │                                    │
  ├─ applyTriageSuppression ─────────► │
  │    { findingId }                   ├─ Read triage classification
  │                                    ├─ Extract justification + scope
  │                                    ├─ Call AshYamlWriteService.addSuppression()
  │                                    ├─ Set disposition = SUPPRESS
  │  ◄──────────────── triageSuppressed ┤
  │  ◄──────────── triageSummaryUpdate ┤  (updated counts)
  │                                    │
```

### One-Click Fix Flow

```
WebView                          Extension Host
  │                                    │
  ├─ applyTriageFix ─────────────────► │
  │    { findingId }                   ├─ Read triage classification
  │                                    ├─ Read source file
  │                                    ├─ Validate codeBefore matches
  │                                    ├─ Replace with codeAfter
  │                                    ├─ Write file
  │                                    ├─ Set disposition = FIX
  │  ◄───────────────── triageFixApplied ┤
  │  ◄──────────── triageSummaryUpdate ┤  (updated counts)
  │                                    │
```

### Systemic Guidance Copy Flow

```
WebView                          Extension Host
  │                                    │
  │  (No extension message needed)     │
  │  Guidance already in FindingRow    │
  │  from triageClassificationResult   │
  │                                    │
  │  navigator.clipboard.writeText()   │
  │  (local WebView operation)         │
  │                                    │
```
