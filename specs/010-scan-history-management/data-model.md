# Data Model: Scan History & Management

**Branch**: `010-scan-history-management` | **Date**: 2026-03-17

## Summary

No schema changes. This feature uses existing entities and relationships. The cascade delete on Finding→Scan is already configured.

## Existing Entities (Unchanged)

### Scan (Prisma Model)

| Field | Type | Usage |
|-------|------|-------|
| id | String (UUID) | Lookup key for deleteScan |
| status | ScanStatus (enum) | Guard: only non-RUNNING scans can be deleted |
| startedAt | DateTime | Display ordering (DESC) |
| findingsCount | Int | Display in tree view |
| sourceDir | String | Display in tree view |

### Finding (Prisma Model)

| Field | Type | Usage |
|-------|------|-------|
| scanId | String (FK) | Cascade delete when parent Scan is removed |

**Existing relation**: `@relation(fields: [scanId], references: [id], onDelete: Cascade)`

### ScanStatus (Enum)

Unchanged: `RUNNING`, `COMPLETED`, `FAILED`, `CANCELLED`

Deletion guard: only `COMPLETED`, `FAILED`, or `CANCELLED` scans may be deleted.

## Message Protocol Changes

### New Messages

| Direction | Type | Payload |
|-----------|------|---------|
| WebView → Extension | `deleteScan` | `{ scanId: string }` |

### Existing Messages (Unchanged, Reused)

| Direction | Type | Notes |
|-----------|------|-------|
| Extension → WebView | `stateUpdate` | Already carries scan list + summary; reused after deletion |

### New VS Code Commands

| Command | Arguments | Notes |
|---------|-----------|-------|
| `ashWorkbench.deleteScan` | `ScanTreeItem` (from context menu) | Confirmation dialog before delete |

## View Type Mapping

No changes to `mapScanToSummary()` or `ScanSummary` type. Existing mapper already produces all fields needed for tree view display.
