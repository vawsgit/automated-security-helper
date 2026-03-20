# Data Model: AI Analysis Persistence

**Feature**: 021-ai-analysis-persistence
**Date**: 2026-03-20

## Entity Changes

### Finding (Extended)

The existing `Finding` entity gains one new field:

| Field | Type | Nullable | Default | Description |
|-------|------|----------|---------|-------------|
| `aiAnalysis` | JSON | Yes | `null` | Stores the `StoredAiAnalysis` envelope containing both analysis content and metadata |

**Lifecycle**:
- `null` → Finding has never been analyzed
- `StoredAiAnalysis` → Finding has a persisted analysis result
- `null` (after clear) → Analysis was explicitly removed

**Cascade**: When a `Finding` is deleted (e.g., via `Scan` cascade delete with `onDelete: Cascade`), the `aiAnalysis` data is automatically removed as part of the row deletion.

### StoredAiAnalysis (JSON Schema)

Not a database table — this is the TypeScript-enforced shape of the JSON stored in `Finding.aiAnalysis`.

```
StoredAiAnalysis
├── analysis: AiAnalysis
│   ├── explanation: string
│   ├── riskAssessment: RiskAssessment
│   │   ├── exploitability: RiskLevel
│   │   ├── exploitabilityRationale: string
│   │   ├── impact: RiskLevel
│   │   ├── impactRationale: string
│   │   ├── likelihood: RiskLevel
│   │   └── likelihoodRationale: string
│   ├── suggestedFix: SuggestedFix | null
│   │   ├── description: string
│   │   ├── diffText: string
│   │   └── language: string
│   └── references: AiReference[]
│       ├── title: string
│       └── url: string
└── metadata: AnalysisMetadata
    ├── analyzedAt: string (ISO 8601)
    ├── modelId: string
    ├── costUsd: number
    └── toolsUsed: string[]
```

### Enumerations Referenced

- `RiskLevel`: `CRITICAL | HIGH | MEDIUM | LOW | NONE`

## State Transitions

```
┌──────────┐   analyze()    ┌───────────┐
│   null   │ ──────────────>│ populated │
│ (no AI)  │                │ (has AI)  │
└──────────┘                └───────────┘
      ^                      │    │    │
      │    clearAiAnalysis() │    │    │ re-analyze()
      └──────────────────────┘    │    │ (overwrite)
                                  │    └──────>┐
                                  │            │
                                  └<───────────┘
```

## Indexes

No additional indexes required. The `aiAnalysis` column is read as part of whole-finding queries, not queried independently. Existing indexes on `Finding` (`scanTargetId, ruleId, file` and `scanId, severity`) are sufficient.

## Migration

Single additive SQL statement:

```sql
ALTER TABLE "Finding" ADD COLUMN "aiAnalysis" jsonb;
```

Migration file: `vsix/prisma/migrations/20260320000000_add_ai_analysis/migration.sql`
