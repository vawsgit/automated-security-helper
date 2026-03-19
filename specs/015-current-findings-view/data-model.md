# Data Model: Unified Current Findings View

**Branch**: `015-current-findings-view` | **Date**: 2026-03-19

## Overview

No new database tables or schema migrations. All changes are to TypeScript view-layer types and the mapper that translates Prisma models to view models.

## Type Changes

### FindingRow (vsix/src/models/types.ts + webview/src/types/types.ts)

**Existing fields** (unchanged):

```typescript
interface FindingRow {
  id: string;
  scanId: string;
  scanTargetId: string;
  title: string;
  description: string;
  severity: Severity;
  disposition: Disposition;
  scanner: string;
  ruleId: string;
  filePath: string;
  startLine: number;
  endLine: number;
  codeSnippet: string;
  notes: string;
  firstDetectedAt: string;
  aiAnalysis: AiAnalysis | null;
  suppression: SuppressionData | null;  // ← Now gets populated by .ash.yaml matching
}
```

**New fields**:

```typescript
interface FindingRow {
  // ... existing fields ...
  isCurrentlySuppressed: boolean;       // Quick-check flag for UI filtering/rendering
  suppressionSource: 'ash_yaml' | null; // Origin of suppression (extensible for future SARIF source)
}
```

**Field semantics**:

| Field | Default | When Suppressed |
|-------|---------|-----------------|
| `suppression` | `null` | `{ justification, yamlEntry, expiresAt, createdAt: null }` |
| `isCurrentlySuppressed` | `false` | `true` |
| `suppressionSource` | `null` | `'ash_yaml'` |

### SuppressionData (unchanged interface, new population)

```typescript
interface SuppressionData {
  justification: string;   // ← from AshSuppression.reason
  yamlEntry: string;       // ← generated YAML representation of matched rule
  expiresAt: string | null; // ← from AshSuppression.expiration
  createdAt: string;       // ← set to '' (unknown for .ash.yaml rules)
}
```

### New Types

#### SuppressionSummary

```typescript
interface SuppressionSummary {
  total: number;      // Total findings in latest scan
  suppressed: number; // Findings matched by .ash.yaml
  active: number;     // total - suppressed (findings needing attention)
}
```

Location: vsix/src/models/types.ts + webview/src/types/types.ts

#### AshYamlConfigSummary

```typescript
interface AshYamlConfigSummary {
  suppressionCount: number;
  ignorePathCount: number;
  severityThreshold: string;
  projectName: string | null;
  enabledScanners: string[];
}
```

Location: vsix/src/models/types.ts + webview/src/types/types.ts

## Mapper Changes

### mapFindingToRow (vsix/src/models/mappers.ts)

**Current signature**: `(finding: Finding): FindingRow`

**New signature**: `(finding: Finding, suppression?: AshSuppression): FindingRow`

**Behavior**:
- When `suppression` is undefined (default): `isCurrentlySuppressed: false`, `suppressionSource: null`, `suppression: null` (existing behavior)
- When `suppression` is provided:
  - `isCurrentlySuppressed: true`
  - `suppressionSource: 'ash_yaml'`
  - `suppression: { justification: suppression.reason, yamlEntry: generateYamlEntry(suppression), expiresAt: suppression.expiration, createdAt: '' }`

### generateYamlEntry (new helper in mappers.ts)

```typescript
function generateYamlEntry(s: AshSuppression): string
```

Produces a YAML string representation of the suppression rule for display purposes:

```yaml
- path: "src/auth.ts"
  reason: "False positive - input is validated upstream"
  rule_id: "B105"
  line_start: 42
```

## Service Changes

### FindingsService (vsix/src/services/findings.ts)

**New method**:

```typescript
async getCurrentFindings(
  scanRootService: ScanRootService,
  ashYamlService: AshYamlService
): Promise<{ findings: FindingRow[]; summary: SuppressionSummary } | null>
```

**Logic**:
1. Get effective scan root from `scanRootService.getEffectiveScanRoot()`
2. Build path filter (same pattern as existing `getScanSummaries`)
3. Find latest COMPLETED scan: `db.scan.findFirst({ where: { projectId, status: 'COMPLETED', scanTarget: pathFilter }, orderBy: { startedAt: 'desc' } })`
4. If no scan found, return `null`
5. Fetch all findings for that scan: `db.finding.findMany({ where: { scanId } })`
6. Call `ashYamlService.getMatchingSuppressions(mappedFindings)` → `Map<string, AshSuppression>`
7. Map each finding via `mapFindingToRow(finding, suppressionMap.get(finding.id))`
8. Compute `SuppressionSummary`: `{ total, suppressed: suppressionMap.size, active: total - suppressionMap.size }`
9. Return `{ findings, summary }`

**New method for historical overlay**:

```typescript
async getFindingsWithSuppressionOverlay(
  scanId: string,
  ashYamlService: AshYamlService,
  filters?: FilterState
): Promise<FindingRow[]>
```

**Logic**:
1. Get findings for scanId (existing `getFindings` logic)
2. Map to FindingRow[] first (without suppression)
3. Call `ashYamlService.getMatchingSuppressions(mappedFindings)`
4. For each finding, if matched, set `isCurrentlySuppressed: true`, `suppressionSource: 'ash_yaml'`, populate `suppression` field
5. Return enriched FindingRow[]

## State Changes

### AppState (webview/src/App.tsx)

**New fields**:

```typescript
interface AppState {
  // ... existing fields ...
  currentFindings: FindingRow[];
  suppressionSummary: SuppressionSummary;
  showSuppressed: boolean;
}
```

**Initial values**: `currentFindings: []`, `suppressionSummary: { total: 0, suppressed: 0, active: 0 }`, `showSuppressed: false`

### AppAction (webview/src/App.tsx)

**New action**:

```typescript
| { type: 'TOGGLE_SHOW_SUPPRESSED' }
```

## Disposition Model

No changes to the `Disposition` type or Prisma enum. The `SUPPRESS` value remains but its semantics shift:

- **Before**: User explicitly sets disposition to SUPPRESS via triage controls
- **After**: Suppression is DERIVED from .ash.yaml matching. The SUPPRESS disposition button is disabled. Existing SUPPRESS dispositions in the DB remain but are not the source of truth for suppression status.

A finding can simultaneously have:
- `disposition: 'FIX'` (DB-persisted triage state)
- `isCurrentlySuppressed: true` (derived from .ash.yaml)

These are independent attributes.
