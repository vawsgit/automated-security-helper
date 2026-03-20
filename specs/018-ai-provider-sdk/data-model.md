# Data Model: AI Provider Abstraction and Claude Agent SDK Integration

**Feature**: 018-ai-provider-sdk
**Date**: 2026-03-20

## Schema Changes

### Finding Model (Update)

Add one JSON column to the existing `Finding` model in `vsix/prisma/schema.prisma`:

```prisma
model Finding {
  // ... existing fields unchanged ...

  aiAnalysis   Json?    // StoredAiAnalysis object (analysis + metadata)
}
```

**Column details**:
- **Name**: `aiAnalysis`
- **Type**: `Json?` (nullable JSON, PGLite `jsonb`)
- **Default**: `null` (finding has no analysis yet)
- **Lifecycle**: Set on successful analysis, overwritten on re-analysis, remains null on error/cancel

### StoredAiAnalysis Structure (JSON Shape)

The `aiAnalysis` JSON column stores a wrapper containing both the analysis result and metadata:

```
StoredAiAnalysis
├── analysis: AiAnalysis          # The analysis payload (existing type)
│   ├── explanation: string       # Required — vulnerability explanation
│   ├── riskAssessment            # Required — risk ratings
│   │   ├── exploitability: RiskLevel + rationale
│   │   ├── impact: RiskLevel + rationale
│   │   └── likelihood: RiskLevel + rationale
│   ├── suggestedFix: object|null # Optional — fix description + diff
│   └── references: array         # Optional — title + URL pairs
└── metadata: AnalysisMetadata    # Persistence metadata
    ├── analyzedAt: ISO 8601 timestamp
    ├── modelId: string           # e.g., "claude-sonnet-4-20250514"
    ├── costUsd: number           # Actual cost incurred
    └── toolsUsed: string[]       # Tools the agent invoked
```

### Existing Types (No Changes)

These types already exist in both `vsix/src/models/types.ts` and `webview/src/types/types.ts`:

- **AiAnalysis**: `{ explanation, riskAssessment, suggestedFix, references }`
- **RiskAssessment**: `{ exploitability, exploitabilityRationale, impact, impactRationale, likelihood, likelihoodRationale }`
- **RiskLevel**: `'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'NONE'`
- **SuggestedFix**: `{ description, diffText, language }`
- **AiReference**: `{ title, url }`

### New Types

```
AnalysisMetadata
├── analyzedAt: string    # ISO 8601 timestamp
├── modelId: string       # Model identifier used for this analysis
├── costUsd: number       # Total cost in USD
└── toolsUsed: string[]   # List of tool names invoked (e.g., ["Read", "Grep"])

StoredAiAnalysis
├── analysis: AiAnalysis
└── metadata: AnalysisMetadata
```

## Entity Relationships

```
Project (1) ──── (N) ScanTarget (1) ──── (N) Scan (1) ──── (N) Finding
                                                              │
                                                              ├── aiAnalysis: Json? (StoredAiAnalysis)
                                                              ├── disposition: Disposition
                                                              └── notes: String?
```

No new entities. The AI analysis is a property of the existing Finding entity.

## State Transitions

### Finding AI Analysis State

```
[null]  ─── analyzeFinding ───> [in_progress]
                                      │
                          ┌───────────┼───────────┐
                          ▼           ▼           ▼
                     [completed]  [error]    [cancelled]
                          │           │           │
                          │           └───────────┘
                          │                 │
                          │            back to [null]
                          │
                     re-analyze ───> [in_progress]
                                          │
                              ┌───────────┼───────────┐
                              ▼           ▼           ▼
                         [completed]  [error]    [cancelled]
                              │           │           │
                         overwrites   preserves   preserves
                          old result   old result   old result
```

**Note**: The `in_progress` state is transient (in-memory only, not persisted). Only `null` and `completed` (with StoredAiAnalysis JSON) are database states.

## Migration

Single additive migration: `ALTER TABLE "Finding" ADD COLUMN "aiAnalysis" jsonb;`

No data backfill needed — existing findings start with `null` (unanalyzed). No breaking changes to existing queries (column is nullable and unused by existing code paths).

## Mapper Changes

`mapFindingToRow()` in `vsix/src/models/mappers.ts` currently hardcodes `aiAnalysis: null`. Update to:

1. Read `finding.aiAnalysis` from Prisma result (typed as `Prisma.JsonValue | null`)
2. If non-null, parse and extract the `analysis` field from the `StoredAiAnalysis` wrapper
3. Return as `FindingRow.aiAnalysis: AiAnalysis | null`

The metadata (model, cost, timestamp) is available from the same JSON but not included in `FindingRow` — it is sent separately in the `aiAnalysisResult` message when relevant.
