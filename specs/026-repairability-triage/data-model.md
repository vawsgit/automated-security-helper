# Data Model: Repairability Triage Analysis

**Feature**: 026-repairability-triage | **Date**: 2026-03-23

## Schema Changes

### Finding Model Extension

Add one nullable JSON field to the existing `Finding` model:

```prisma
model Finding {
  // ... existing fields unchanged ...
  aiAnalysis      Json?
  triageAnalysis  Json?    // NEW: Repairability triage classification result
}
```

No new indexes required. The existing `@@index([scanTargetId, ruleId, file])` and `@@index([scanId, severity])` are sufficient for triage queries (filter by severity, group by scan target).

### Migration SQL

```sql
ALTER TABLE "Finding" ADD COLUMN "triageAnalysis" TEXT;
```

PGLite stores JSON as TEXT (no native JSONB). Follows the same pattern as the existing `aiAnalysis` column.

## Type Definitions

### TriageAnalysis (Stored in `triageAnalysis` JSON field)

```typescript
/** Stored in Finding.triageAnalysis JSON field */
interface StoredTriageAnalysis {
  analysis: TriageClassification;
  metadata: TriageMetadata;
  fingerprint: string;          // SHA-256 hash for cache invalidation
}

interface TriageMetadata {
  classifiedAt: string;         // ISO 8601 timestamp
  modelId: string;              // e.g., "claude-sonnet-4-6"
  costUsd: number;              // AI call cost
}
```

### TriageClassification (Discriminated Union)

```typescript
type TriageCategory = 'suppress' | 'easy_fix' | 'systemic';

type TriageClassification =
  | TriageSuppressClassification
  | TriageEasyFixClassification
  | TriageSystemicClassification;

interface TriageClassificationBase {
  category: TriageCategory;
  explanation: string;          // What the issue is (plain text)
  risk: string;                 // Risk assessment (plain text)
}

interface TriageSuppressClassification extends TriageClassificationBase {
  category: 'suppress';
  suppressionRationale: string;       // Why safe to suppress
  suggestedScope: SuppressionScope;   // 'file_rule' | 'rule_everywhere' | 'file_all_rules'
  suggestedJustification: string;     // Pre-written justification for .ash.yaml
}

interface TriageEasyFixClassification extends TriageClassificationBase {
  category: 'easy_fix';
  fixDescription: string;             // How to fix (plain text)
  codeBefore: string;                 // Original code lines to replace
  codeAfter: string;                  // Replacement code lines
  filePath: string;                   // File to modify (relative to workspace)
  startLine: number;                  // Start line of codeBefore
  endLine: number;                    // End line of codeBefore
}

interface TriageSystemicClassification extends TriageClassificationBase {
  category: 'systemic';
  complexityRationale: string;        // Why it's hard to fix
  repairGuidance: RepairGuidance;     // Comprehensive guidance
}

interface RepairGuidance {
  affectedAreas: string[];            // List of affected code areas/files
  vulnerabilityNature: string;        // Detailed vulnerability description
  remediationApproach: string;        // Step-by-step remediation strategy
  sideEffects: string[];              // Potential side effects of the fix
  testingRecommendations: string;     // What to test after fixing
}
```

### TriageSummary (Computed, not stored)

```typescript
interface TriageSummary {
  bySeverity: Record<Severity, TriageSeverityBreakdown>;
  totalFindings: number;
  totalAnalyzed: number;
  totalUnanalyzed: number;
}

interface TriageSeverityBreakdown {
  total: number;
  suppress: number;
  easyFix: number;
  systemic: number;
  unanalyzed: number;       // Not yet classified (pending or out of POC scope)
  addressed: number;        // Suppressed or fixed (disposition != PENDING)
}
```

### FindingRow Extension (WebView type)

Extend the existing `FindingRow` interface:

```typescript
interface FindingRow {
  // ... existing fields unchanged ...

  // NEW: Triage classification
  triageAnalysis: TriageClassification | null;
  triageMetadata: TriageMetadata | null;
  triageFingerprint: string | null;
  isTriageStale: boolean;     // Computed: current fingerprint != stored fingerprint
}
```

## Fingerprint Calculation

```typescript
function computeTriageFingerprint(finding: {
  ruleId: string;
  file: string;
  snippet: string | null;
  severity: string;
  description: string;
}): string {
  const input = [
    finding.ruleId,
    finding.file,
    finding.snippet ?? '',
    finding.severity,
    finding.description,
  ].join('|');
  // SHA-256 hash (use Node.js crypto in extension host)
  return crypto.createHash('sha256').update(input).digest('hex');
}
```

## Entity Relationships

```
Finding (existing)
  ├── aiAnalysis: Json?           (existing - Spec 022 deep analysis)
  └── triageAnalysis: Json?       (NEW - triage classification)
        ├── analysis: TriageClassification
        │     ├── category: 'suppress' | 'easy_fix' | 'systemic'
        │     ├── explanation, risk (shared fields)
        │     └── category-specific action data
        ├── metadata: TriageMetadata
        └── fingerprint: string
```

## State Transitions

### Triage Classification Lifecycle

```
[No triageAnalysis]
    │
    ▼ (AI classification triggered)
[triageAnalysis = { analysis, metadata, fingerprint }]
    │
    ├── Finding unchanged → cache hit (reuse stored result)
    │
    ├── Finding changed (fingerprint mismatch) → [isTriageStale = true]
    │       │
    │       ▼ (re-classification triggered)
    │   [triageAnalysis replaced with new result]
    │
    └── Action taken:
        ├── Suppress → disposition set to SUPPRESS, .ash.yaml written
        ├── Easy Fix → code change applied, disposition set to FIX
        └── Systemic → guidance copied (no state change, finding remains PENDING)
```

### Finding Disposition After Triage Actions

| Triage Action | Disposition Change | Interface Update |
|---------------|-------------------|------------------|
| Suppress (one-click) | PENDING → SUPPRESS | Badge: "Suppressed", marked as addressed |
| Easy Fix (one-click) | PENDING → FIX | Badge: "Fix Applied", message: "status will be updated next scan" |
| Copy Guidance (systemic) | No change (stays PENDING) | No disposition change; finding remains in "unaddressed" |

## Query Patterns

### Triage Summary Computation

```sql
-- Get counts per severity × category for the triage dashboard
-- Uses the latest finding per (scanTargetId, ruleId, file) identity
SELECT
  f.severity,
  CASE
    WHEN f."triageAnalysis" IS NULL THEN 'unanalyzed'
    ELSE json_extract(f."triageAnalysis", '$.analysis.category')
  END AS triage_category,
  f.disposition,
  COUNT(*) as count
FROM "Finding" f
WHERE f.id IN (
  -- Latest finding per identity (most recent scan)
  SELECT f2.id FROM "Finding" f2
  INNER JOIN "Scan" s ON f2."scanId" = s.id
  WHERE s.status = 'COMPLETED'
  ORDER BY s."startedAt" DESC
  LIMIT 1
)
GROUP BY f.severity, triage_category, f.disposition;
```

Note: Actual implementation will use Prisma queries, not raw SQL. The SQL above illustrates the query logic.

### Cache Check (Fingerprint Comparison)

```typescript
// In TriageService
function isTriageStale(finding: Finding): boolean {
  if (!finding.triageAnalysis) { return true; }  // Never classified
  const stored = parseStoredTriageAnalysis(finding.triageAnalysis);
  if (!stored) { return true; }
  const currentFingerprint = computeTriageFingerprint(finding);
  return currentFingerprint !== stored.fingerprint;
}
```

## Mapper Extension

Add to `vsix/src/models/mappers.ts`:

```typescript
function parseStoredTriageAnalysis(json: unknown): StoredTriageAnalysis | null {
  if (!json || typeof json !== 'object') { return null; }
  const obj = json as Record<string, unknown>;
  if (!obj.analysis || !obj.metadata || !obj.fingerprint) { return null; }
  return obj as StoredTriageAnalysis;
}
```

Extend `mapFindingToRow()` to include triage fields:

```typescript
function mapFindingToRow(finding: Finding, suppression?: AshSuppression): FindingRow {
  // ... existing mapping ...
  const storedTriage = parseStoredTriageAnalysis(finding.triageAnalysis);
  const currentFingerprint = computeTriageFingerprint(finding);

  return {
    // ... existing fields ...
    triageAnalysis: storedTriage?.analysis ?? null,
    triageMetadata: storedTriage?.metadata ?? null,
    triageFingerprint: storedTriage?.fingerprint ?? null,
    isTriageStale: storedTriage
      ? currentFingerprint !== storedTriage.fingerprint
      : false,
  };
}
```
