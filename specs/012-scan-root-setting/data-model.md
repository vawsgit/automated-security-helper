# Data Model: Scan Root Setting

**Branch**: `012-scan-root-setting` | **Date**: 2026-03-19

## Schema Changes

**None.** This feature does not modify the Prisma schema. The scan root is a runtime concept resolved from VS Code settings, not a persisted entity.

## Existing Entities (Relevant)

### ScanTarget (unchanged)

```prisma
model ScanTarget {
  id          String   @id @default(uuid())
  projectId   String
  project     Project  @relation(fields: [projectId], references: [id])
  path        String               // ← Filtered against effective scan root
  displayName String
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  scans       Scan[]
  findings    Finding[]

  @@unique([projectId, path])
}
```

**Filtering rule**: A ScanTarget is "in scope" when:
- `scanTarget.path === effectiveScanRoot`, OR
- `scanTarget.path` starts with `effectiveScanRoot + path.sep`

This is applied as a Prisma `where` clause using `startsWith` on the `path` field, combined with an `OR` for exact match.

### Scan (unchanged)

Scans inherit their ScanTarget's scope. A scan is "in scope" when its parent `ScanTarget` is in scope.

**Query pattern**: Filter via `scan.scanTarget.path` using the same startsWith rule.

### Finding (unchanged)

Findings inherit their ScanTarget's scope via `scanTargetId`.

**Query pattern**: Filter via `finding.scanTarget.path` using the same startsWith rule.

## Runtime Entity (New)

### Effective Scan Root

| Attribute | Type | Source |
|-----------|------|--------|
| configuredValue | string | `vscode.workspace.getConfiguration('ashWorkbench').get<string>('scanRoot', '')` |
| resolvedPath | string | If configuredValue is non-empty and valid: configuredValue. Otherwise: first workspace folder's fsPath |
| isDefault | boolean | True when configuredValue is empty or invalid (using workspace folder fallback) |

**Lifecycle**: Computed on activation and re-computed on every `onDidChangeConfiguration` event that affects `ashWorkbench.scanRoot`.

**Not persisted**: This is an in-memory runtime value. No database storage needed.

## Query Impact Summary

| FindingsService Method | Current Filter | Added Filter |
|------------------------|---------------|-------------|
| `getScanSummaries()` | `projectId` | + `scanTarget.path startsWith scanRoot` |
| `getScanTargets()` | `projectId` | + `path startsWith scanRoot` |
| `getSummary()` | `projectId` | + `scanTarget.path startsWith scanRoot` |
| `getFindings(scanId)` | `scanId` | No change (already scoped to a single scan) |
| `getFindingsByScanTarget(scanTargetId)` | `scanTargetId` | No change (already scoped to single target) |
| `getFindingDetail(findingId)` | `findingId` | No change (single finding lookup) |
| `deleteScan(scanId)` | `scanId` | No change (explicit user action) |
| `setDisposition(findingId)` | `findingId` | No change (explicit user action) |
| `setNotes(findingId)` | `findingId` | No change (explicit user action) |

Only the aggregate/list methods need scan root filtering. Single-record operations remain unchanged.
