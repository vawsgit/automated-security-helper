# Data Model: Finding Queries, Filters & Summary

## Existing Entities (No Schema Changes)

The Prisma schema already contains all required entities and fields. This feature adds no schema migrations — it builds query and mapping logic on top of the existing schema.

### Finding (existing)

| Prisma Field | Type | WebView Field (FindingRow) | Notes |
|-------------|------|---------------------------|-------|
| id | String | id | UUID primary key |
| scanId | String | scanId | FK to Scan |
| scanTargetId | String | scanTargetId | FK to ScanTarget |
| ruleId | String | ruleId | Scanner rule identifier |
| scanner | String | scanner | Scanner name (e.g., "bandit") |
| severity | Severity enum | severity | CRITICAL, HIGH, MEDIUM, LOW, INFO |
| disposition | Disposition enum | disposition | PENDING, FIX, SUPPRESS, DEFER |
| file | String | filePath | Renamed: `file` → `filePath` |
| startLine | Int | startLine | 1-based line number |
| endLine | Int? | endLine | Default to startLine if null |
| title | String | title | Finding title |
| description | String | description | Finding description |
| snippet | String? | codeSnippet | Default to `''` if null |

Fields in `FindingRow` not backed by database:
- `notes: string` — Always `''` (database persistence is out of scope)
- `firstDetectedAt: string` — Derived as current ISO timestamp (no DB field yet)
- `aiAnalysis: AiAnalysis | null` — Always `null` (out of scope)
- `suppression: SuppressionData | null` — Always `null` (out of scope)

### Scan (existing)

| Prisma Field | Type | WebView Field (ScanSummary) | Notes |
|-------------|------|----------------------------|-------|
| id | String | id | UUID primary key |
| projectId | String | projectId | FK to Project |
| scanTargetId | String | scanTargetId | FK to ScanTarget |
| sourceDir | String | sourceDirectory | Renamed: `sourceDir` → `sourceDirectory` |
| status | ScanStatus enum | status | RUNNING, COMPLETED, FAILED, CANCELLED |
| findingsCount | Int | findingCount | Renamed: `findingsCount` → `findingCount` |
| severityBreakdown | Json? | severityCounts | Parsed as Record<Severity, number> |
| startedAt | DateTime | startedAt | Serialized as ISO string |
| completedAt | DateTime? | completedAt | Serialized as ISO string, optional |

### ScanTarget (existing)

| Prisma Field | Type | WebView Field (ScanTarget) | Notes |
|-------------|------|---------------------------|-------|
| id | String | id | UUID primary key |
| path | String | path | File system path |
| displayName | String | displayName | Basename of path |

Computed fields in `ScanTarget` WebView type (not in Prisma):
- `lastScannedAt?: string` — `MAX(scan.startedAt)` for scans of this target
- `scanCount: number` — `COUNT(scan)` for this target
- `findingCount: number` — `COUNT(finding)` for this target
- `severityCounts: Record<Severity, number>` — `GROUP BY severity` on findings for this target
- `triageSummary: DispositionSummary` — `GROUP BY disposition` on findings for this target

## New Types

### FilterState

```typescript
interface FilterState {
  severity?: Severity[];        // e.g., ['CRITICAL', 'HIGH']
  scanner?: string;             // e.g., 'bandit'
  disposition?: Disposition[];  // e.g., ['PENDING']
  filePattern?: string;         // substring match against file path
}
```

All fields are optional. When multiple fields are set, they combine with AND logic.

### Prisma Query Mapping

| FilterState Field | Prisma Where Clause |
|-------------------|---------------------|
| `severity` | `severity: { in: severity }` |
| `scanner` | `scanner: { equals: scanner }` |
| `disposition` | `disposition: { in: disposition }` |
| `filePattern` | `file: { contains: filePattern }` |

## Message Protocol Changes

### stateUpdate (modified)

Current payload: `{ scans: ScanSummary[]; summary: DispositionSummary }`

New payload: `{ scans: ScanSummary[]; summary: DispositionSummary; scanTargets: ScanTarget[] }`

### applyFilters (new WebView → Extension)

```typescript
{ type: 'applyFilters'; payload: { scanId: string; filters: FilterState } }
```

Extension responds with `findingsUpdate` containing filtered results.

## Service Methods

### FindingsService

| Method | Input | Output | Prisma Queries |
|--------|-------|--------|----------------|
| `getFindings(scanId, filters?)` | scanId + optional FilterState | `FindingRow[]` | `finding.findMany` with dynamic `where` |
| `getSummary(projectId)` | projectId | `DispositionSummary` | `finding.groupBy` by disposition |
| `getScanSummaries(projectId)` | projectId | `ScanSummary[]` | `scan.findMany` ordered by startedAt DESC |
| `getScanTargets(projectId)` | projectId | `ScanTarget[]` | `scanTarget.findMany` + aggregation queries |
