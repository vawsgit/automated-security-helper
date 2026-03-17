# Data Model: Settings, Admin & Application Lifecycle

## Schema Changes

**No Prisma schema changes required.** This spec does not add, modify, or remove any database entities.

## Existing Entities Used

### _ash_migrations (raw SQL table, not Prisma-managed)

Already exists. Used for schema version reporting.

| Column | Type | Notes |
|--------|------|-------|
| id | SERIAL | Primary key, auto-increment |
| name | TEXT | Migration directory name (e.g., "20260101000000_init"), UNIQUE |
| applied_at | TIMESTAMP | When the migration was applied |

**Read by**: `DatabaseService.getSchemaVersion()` (new method) — queries latest applied migration name.

### Project, Scan, Finding (Prisma-managed)

Already exist. Used for aggregate counts in application info.

| Query | Purpose |
|-------|---------|
| `db.project.count()` | Total projects for stats |
| `db.scan.count()` | Total scans for stats |
| `db.finding.count()` | Total findings for stats |

## New View Types

### ApplicationInfo (computed, not persisted)

| Field | Type | Source |
|-------|------|--------|
| extensionVersion | string | `context.extension.packageJSON.version` |
| schemaVersion | string | Latest `_ash_migrations.name` |
| stats.projectCount | number | `db.project.count()` |
| stats.scanCount | number | `db.scan.count()` |
| stats.findingCount | number | `db.finding.count()` |

Defined in `vsix/src/models/types.ts` and mirrored in `webview/src/types/types.ts`.

## Configuration Properties (VS Code Settings, not DB)

Settings are stored by VS Code in its own settings infrastructure (settings.json). They are NOT database entities.

| Setting Key | Type | Default | Validation |
|-------------|------|---------|------------|
| ashWorkbench.ashPath | string | "ash" | Already exists |
| ashWorkbench.ashMode | enum | "local" | Already exists. Values: local, container |
| ashWorkbench.scanTimeout | number | 600 | Already exists. Minimum: 30 |
| ashWorkbench.defaultSeverityThreshold | enum | "LOW" | **New.** Values: CRITICAL, HIGH, MEDIUM, LOW, INFO |
| ashWorkbench.llm.provider | enum | "bedrock" | **New.** Values: bedrock |
| ashWorkbench.llm.region | string | "us-east-1" | **New.** |
| ashWorkbench.llm.modelId | string | "anthropic.claude-sonnet-4-20250514" | **New.** |
