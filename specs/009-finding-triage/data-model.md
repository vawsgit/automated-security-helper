# Data Model: Finding Triage

**Branch**: `009-finding-triage` | **Date**: 2026-03-17

## Summary

One schema change: add a nullable `notes` column to the Finding model. No new entities.

## Schema Change

### Finding Model -- Add notes Column

| Field | Type | Nullable | Default | Change |
|-------|------|----------|---------|--------|
| notes | String | Yes | null | **NEW** |

**Prisma schema addition**:
```prisma
notes       String?
```

Inserted after `snippet` and before `disposition` in the Finding model.

**Migration**: `npx prisma db push` (non-destructive, PGLite push-based)

## Existing Entities (Unchanged)

### Finding (Prisma Model)

Existing fields used by this feature:

| Field | Type | Usage |
|-------|------|-------|
| id | String (UUID) | Lookup key for setDisposition/setNotes |
| disposition | Disposition (enum) | Updated by setDisposition; already exists |
| notes | String? | **NEW** -- Updated by setNotes |

### Disposition (Enum)

Unchanged: `PENDING`, `FIX`, `SUPPRESS`, `DEFER`

All transitions are valid (any state to any state).

## View Type Mapping

`mapFindingToRow()` change:

| FindingRow field | Before | After |
|-----------------|--------|-------|
| notes | `''` (hardcoded) | `finding.notes ?? ''` |

## Message Protocol Changes

### New Messages

| Direction | Type | Payload |
|-----------|------|---------|
| WebView -> Extension | `setNotes` | `{ findingId: string; notes: string }` |
| Extension -> WebView | `notesUpdated` | `{ findingId: string; notes: string }` |

### Existing Messages (Unchanged)

| Direction | Type | Notes |
|-----------|------|-------|
| WebView -> Extension | `setDisposition` | Already exists; handler routes through service |
| Extension -> WebView | `dispositionUpdated` | Already exists; no change |
