# Data Model: Finding Detail & Code Navigation

**Branch**: `008-finding-detail-navigation` | **Date**: 2026-03-17

## Summary

No new entities, fields, or relationships are introduced by this feature. The existing `Finding` entity and `FindingRow` view type contain all fields needed for the detail view.

## Existing Entities (Unchanged)

### Finding (Prisma Model)

Used as-is from Spec 001/004. Key fields for this feature:

| Field | Type | Usage in Detail View |
|-------|------|---------------------|
| id | String (CUID) | Lookup key for `getFindingDetail()` |
| scanId | String | Context reference |
| scanTargetId | String | Context reference |
| ruleId | String | Displayed in detail |
| scanner | String | Displayed in detail |
| severity | String | Displayed in detail |
| file | String | Displayed + used for code navigation |
| startLine | Int | Displayed + used for code navigation |
| endLine | Int? | Displayed in detail |
| title | String | Displayed in detail |
| description | String | Displayed in detail |
| snippet | String? | Displayed in detail (may be empty) |
| disposition | String | Displayed in detail |

### FindingRow (View Type)

The mapper `mapFindingToRow()` in `models/mappers.ts` already translates all Prisma Finding fields to the `FindingRow` view type. This is the shape sent to the WebView via the `findingDetail` message. No changes needed.

## Runtime State (No Persistence Changes)

No new instance fields, no new database columns, no schema migration required.
