# Message Contracts: Generate Suppression Message

**Feature**: 025-suppression-message-gen
**Date**: 2026-03-23

## WebView → Extension Host

### generateSuppressionMessage

Sent when the user clicks "Generate Message" or "Regenerate" in the suppression form.

```typescript
{
  type: 'generateSuppressionMessage';
  payload: {
    findingId: string;
    scope: SuppressionScope;       // Currently selected scope in form
    mode: 'generate' | 'regenerate';
  };
}
```

### refineSuppressionMessage

Sent when the user clicks "Refine" after editing a generated message.

```typescript
{
  type: 'refineSuppressionMessage';
  payload: {
    findingId: string;
    scope: SuppressionScope;
    existingMessage: string;       // User's edited text to improve
  };
}
```

## Extension Host → WebView

### suppressionMessageResult

Sent on successful generation.

```typescript
{
  type: 'suppressionMessageResult';
  payload: {
    findingId: string;
    message: string;               // Assembled structured text (plain text with labeled sections)
    sections: {
      finding: string;
      riskAssessment: string;
      rationale: string;
      scope: string;
    };
  };
}
```

### suppressionMessageError

Sent on generation failure.

```typescript
{
  type: 'suppressionMessageError';
  payload: {
    findingId: string;
    errorType: AiErrorType;        // Reuses existing error taxonomy
    message: string;               // User-facing error description
  };
}
```

## Message Flow Diagrams

### Generate / Regenerate

```
WebView                          Extension Host                    AI Service
  │                                    │                               │
  │─── generateSuppressionMessage ────>│                               │
  │    {findingId, scope, mode}        │                               │
  │                                    │── assembleContext(findingId) ──│
  │                                    │── callLLM(prompt, schema) ───>│
  │                                    │<── structuredResult ──────────│
  │<── suppressionMessageResult ───────│                               │
  │    {findingId, message, sections}  │                               │
  │                                    │                               │
  │  OR on error:                      │                               │
  │<── suppressionMessageError ────────│                               │
  │    {findingId, errorType, message} │                               │
```

### Refine

```
WebView                          Extension Host                    AI Service
  │                                    │                               │
  │─── refineSuppressionMessage ──────>│                               │
  │    {findingId, scope, existing}    │                               │
  │                                    │── assembleContext(findingId) ──│
  │                                    │── callLLM(refinePrompt) ─────>│
  │                                    │<── structuredResult ──────────│
  │<── suppressionMessageResult ───────│                               │
  │    {findingId, message, sections}  │                               │
```

## Error Handling

Reuses the existing `AiErrorType` taxonomy from `aiProvider.ts`:

| Error Type | Trigger | User Guidance |
|------------|---------|---------------|
| `credentials_missing` | No API key configured | "Configure AI service in settings" |
| `auth_failed` | Invalid credentials | "Check your API key or AWS profile" |
| `model_unavailable` | Model not accessible | "Verify model ID in settings" |
| `network_error` | Connection failure | "Check network connectivity" |
| `budget_exceeded` | Cost limit hit | "Increase budget in settings" |
| `cancelled` | User navigated away | Silent — no error shown |
| `unknown` | Unexpected failure | "Generation failed. You can type a justification manually." |
