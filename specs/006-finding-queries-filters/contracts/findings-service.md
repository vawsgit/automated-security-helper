# Contract: FindingsService

## Location

`vsix/src/services/findings.ts`

## Constructor

```typescript
class FindingsService {
  constructor(db: PrismaClient, projectId: string)
}
```

## Methods

### getFindings

```typescript
async getFindings(scanId: string, filters?: FilterState): Promise<FindingRow[]>
```

Queries findings for a specific scan, applying optional filters. Returns mapped `FindingRow[]`.

**Query construction**:
- Base: `{ scanId }`
- If `filters.severity` is non-empty: add `severity: { in: filters.severity }`
- If `filters.scanner` is set: add `scanner: { equals: filters.scanner }`
- If `filters.disposition` is non-empty: add `disposition: { in: filters.disposition }`
- If `filters.filePattern` is set: add `file: { contains: filters.filePattern }`
- All filter conditions use AND logic (Prisma default for `where` object)

**Mapping**: Each `Finding` record is mapped via `mapFindingToRow()`.

### getSummary

```typescript
async getSummary(projectId: string): Promise<DispositionSummary>
```

Computes project-wide disposition summary using `groupBy`.

**Query**: `db.finding.groupBy({ by: ['disposition'], where: { projectId }, _count: true })`

**Result assembly**:
```typescript
{
  total: sum of all counts,
  counts: {
    PENDING: count from groupBy or 0,
    FIX: count from groupBy or 0,
    SUPPRESS: count from groupBy or 0,
    DEFER: count from groupBy or 0,
  }
}
```

### getScanSummaries

```typescript
async getScanSummaries(projectId: string): Promise<ScanSummary[]>
```

Queries all scans for the project, ordered by `startedAt DESC`.

**Query**: `db.scan.findMany({ where: { projectId }, orderBy: { startedAt: 'desc' } })`

**Mapping**: Each `Scan` record is mapped via `mapScanToSummary()`.

### getScanTargets

```typescript
async getScanTargets(projectId: string): Promise<ScanTarget[]>
```

Queries scan targets enriched with computed aggregates.

**Algorithm**:
1. Fetch all `ScanTarget` records for the project
2. For each target:
   - Count scans: `db.scan.count({ where: { scanTargetId: target.id } })`
   - Get latest scan: `db.scan.findFirst({ where: { scanTargetId: target.id }, orderBy: { startedAt: 'desc' } })`
   - Count findings by severity: `db.finding.groupBy({ by: ['severity'], where: { scanTargetId: target.id }, _count: true })`
   - Count findings by disposition: `db.finding.groupBy({ by: ['disposition'], where: { scanTargetId: target.id }, _count: true })`
3. Assemble into `ScanTarget` view type with computed fields

**Optimization**: For projects with many targets, batch queries using `in` clauses. For the POC (typically 1–5 targets), sequential queries are acceptable.
