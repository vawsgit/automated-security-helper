# Data Model: Generate Suppression Message

**Feature**: 025-suppression-message-gen
**Date**: 2026-03-23

## Entities

### SuppressionMessageRequest (transient — not persisted)

Input assembled by the extension host from existing data when the user requests generation.

| Field | Type | Source | Description |
|-------|------|--------|-------------|
| findingId | string | FindingRow.id | Target finding |
| scope | SuppressionScope | SuppressionForm selection | 'file_rule' \| 'rule_everywhere' \| 'file_all_rules' |
| title | string | FindingRow.title | Finding title |
| description | string | FindingRow.description | Scanner's description |
| severity | Severity | FindingRow.severity | CRITICAL \| HIGH \| MEDIUM \| LOW \| INFO |
| scanner | string | FindingRow.scanner | Scanner name |
| ruleId | string | FindingRow.ruleId | Rule identifier |
| filePath | string | FindingRow.filePath | Affected file |
| startLine | number | FindingRow.startLine | Start line |
| endLine | number | FindingRow.endLine | End line |
| codeSnippet | string | FindingRow.codeSnippet | Code excerpt |
| userNotes | string | FindingRow.notes | User-added triage notes |
| aiAnalysis | AiAnalysis \| null | FindingRow.aiAnalysis | AI enrichment if available |
| mode | GenerationMode | User action | 'generate' \| 'regenerate' \| 'refine' |
| existingMessage | string \| null | Justification field | Current text (for refine mode) |

### SuppressionMessageResult (transient — not persisted)

Output from the AI service, placed into the suppression form's justification field.

| Field | Type | Description |
|-------|------|-------------|
| findingId | string | Target finding |
| message | string | Assembled structured justification text |
| sections | StructuredJustification | Parsed sections for potential UI rendering |

### StructuredJustification (value object)

| Field | Type | Description |
|-------|------|-------------|
| finding | string | Brief identification: rule, scanner, file |
| riskAssessment | string | Contextual risk evaluation |
| rationale | string | Why suppression is appropriate |
| scope | string | What this suppression covers |

## Type Definitions

### New Types

```typescript
type GenerationMode = 'generate' | 'regenerate' | 'refine';

interface StructuredJustification {
  finding: string;
  riskAssessment: string;
  rationale: string;
  scope: string;
}

interface SuppressionMessageRequest {
  findingId: string;
  scope: SuppressionScope;
  mode: GenerationMode;
  existingMessage: string | null;
}

interface SuppressionMessageResult {
  findingId: string;
  message: string;
  sections: StructuredJustification;
}
```

### Existing Types Referenced (no changes)

- `FindingRow` — source of finding context, unchanged
- `SuppressionScope` — 'file_rule' | 'rule_everywhere' | 'file_all_rules', unchanged
- `AiAnalysis` — optional enrichment data, unchanged
- `SuppressionInput` — form submission payload, unchanged

## State Transitions

No new persistent state. The generated message flows through the system as follows:

```
User clicks "Generate" → WebView posts generateSuppressionMessage
  → Extension host assembles SuppressionMessageRequest from FindingRow + scope
  → AiService calls LLM with structured output schema
  → Extension host posts suppressionMessageResult with assembled text
  → WebView reducer stores message in suppressionGeneratedMessage field
  → SuppressionForm populates justification textarea with message
  → User edits (optional) → submits via existing suppressFinding flow
```

## WebView State Additions

New fields in `AppState`:

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| suppressionMessageGenerating | boolean | false | Loading state for generation |
| suppressionGeneratedMessage | string \| null | null | Last generated message text |

New reducer actions:

| Action | Effect |
|--------|--------|
| `SUPPRESSION_MESSAGE_GENERATING` | Set generating=true, clear previous message |
| `SUPPRESSION_MESSAGE_RECEIVED` | Set generating=false, store message |
| `SUPPRESSION_MESSAGE_ERROR` | Set generating=false, message stays null |
| `CLEAR_SUPPRESSION_MESSAGE` | Reset both fields to defaults |

## Database Impact

**None.** Generated messages are transient. They flow into the `reason` field of `AshSuppression` entries only when the user submits the suppression form, using the existing write path. No schema migration required.
