# Data Model: Database Layer & Schema

**Feature**: 001-db-layer-schema
**Date**: 2026-03-16
**Source**: Feature spec FR-003 through FR-010, Technical Design Section 4.1

## Entity Relationship Diagram

```
Project 1──* ScanTarget
Project 1──* Scan
Project 1──* Finding

ScanTarget 1──* Scan
ScanTarget 1──* Finding

Scan 1──* Finding (CASCADE DELETE)
```

## Entities

### Project

The root aggregate. Scopes all data to a VS Code workspace.

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| id | UUID | PK, auto-generated | `@default(uuid())` |
| name | String | NOT NULL | User-provided, defaults to workspace folder name |
| rootPath | String | NOT NULL, UNIQUE | Absolute path to workspace root |
| createdAt | DateTime | NOT NULL, auto | `@default(now())` |
| updatedAt | DateTime | NOT NULL, auto | `@updatedAt` |

**Relationships**: Has many ScanTargets, Scans, Findings.

### ScanTarget

A directory path that ASH scans against. Dispositions are scoped per scan target.

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| id | UUID | PK, auto-generated | `@default(uuid())` |
| projectId | UUID | FK → Project.id, NOT NULL | |
| path | String | NOT NULL | Absolute path to scan target directory |
| displayName | String | NOT NULL | Derived from directory name |
| createdAt | DateTime | NOT NULL, auto | `@default(now())` |
| updatedAt | DateTime | NOT NULL, auto | `@updatedAt` |

**Unique constraint**: `(projectId, path)` — one ScanTarget per directory per project.
**Relationships**: Belongs to Project. Has many Scans, Findings.

### Scan

A single execution of the ASH scanner suite against a target directory.

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| id | UUID | PK, auto-generated | `@default(uuid())` |
| projectId | UUID | FK → Project.id, NOT NULL | |
| scanTargetId | UUID | FK → ScanTarget.id, NOT NULL | |
| sourceDir | String | NOT NULL | Relative path to scanned directory |
| status | ScanStatus | NOT NULL | Enum: RUNNING, COMPLETED, FAILED, CANCELLED |
| severityThreshold | String | NOT NULL, default "LOW" | Minimum severity to report |
| findingsCount | Int | NOT NULL, default 0 | Populated on completion |
| severityBreakdown | JSON | NULLABLE | `{ critical: N, high: N, medium: N, low: N, info: N }` |
| startedAt | DateTime | NOT NULL, auto | `@default(now())` |
| completedAt | DateTime | NULLABLE | Set on completion/failure/cancel |
| errorMessage | String | NULLABLE | Populated on failure |

**Index**: `(projectId, startedAt DESC)` — scan history ordering (FR-009).
**Relationships**: Belongs to Project, ScanTarget. Has many Findings (CASCADE DELETE).

### Finding

An individual security issue detected by a scanner.

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| id | UUID | PK, auto-generated | `@default(uuid())` |
| scanId | UUID | FK → Scan.id, NOT NULL, CASCADE | Deleted when parent scan deleted |
| projectId | UUID | FK → Project.id, NOT NULL | Denormalized for cumulative queries |
| scanTargetId | UUID | FK → ScanTarget.id, NOT NULL | Denormalized for target-scoped queries |
| ruleId | String | NOT NULL | Primary scanner rule ID (e.g., `CKV_AWS_18`) |
| ruleIds | JSON | NULLABLE | Array of all rule IDs if multiple scanners flagged same issue |
| scanner | String | NOT NULL | Scanner name (checkov, semgrep, etc.) |
| severity | Severity | NOT NULL | Enum: CRITICAL, HIGH, MEDIUM, LOW, INFO |
| file | String | NOT NULL | Relative path to affected file |
| startLine | Int | NOT NULL | |
| endLine | Int | NULLABLE | |
| title | String | NOT NULL | Short summary |
| description | String | NOT NULL | Scanner-provided description |
| snippet | String | NULLABLE | Code excerpt |
| disposition | Disposition | NOT NULL, default PENDING | Enum: PENDING, FIX, SUPPRESS, DEFER |

**Indexes**:
- `(scanTargetId, ruleId, file)` — deduplication and cumulative view queries (FR-008)
- `(scanId, severity)` — filtered finding lists (FR-010)

**Identity rule**: Two findings are the "same" issue when they share `(scanTargetId, ruleId, file)`.
**Relationships**: Belongs to Scan (cascade delete), Project, ScanTarget.

## Enums

### ScanStatus
`RUNNING` | `COMPLETED` | `FAILED` | `CANCELLED`

### Severity
`CRITICAL` | `HIGH` | `MEDIUM` | `LOW` | `INFO`

### Disposition
`PENDING` | `FIX` | `SUPPRESS` | `DEFER`

## Validation Rules

| Rule | Entity | Field(s) | Description |
|------|--------|----------|-------------|
| V1 | Project | rootPath | Must be unique across all projects |
| V2 | ScanTarget | (projectId, path) | Composite unique — one target per directory per project |
| V3 | Finding | scanId → Scan | Cascade delete: removing a Scan removes all its Findings |
| V4 | Scan | status | Must be one of the ScanStatus enum values |
| V5 | Finding | severity | Must be one of the Severity enum values |
| V6 | Finding | disposition | Must be one of the Disposition enum values, defaults to PENDING |

## Migration Tracking

A separate `_ash_migrations` table tracks applied migrations:

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| id | SERIAL | PK, auto-increment | |
| name | TEXT | NOT NULL, UNIQUE | Migration directory name (timestamp-prefixed) |
| applied_at | TIMESTAMP | NOT NULL, default NOW() | When the migration was applied |

This table is NOT a Prisma model — it is created and managed via raw SQL by the migration runner.
