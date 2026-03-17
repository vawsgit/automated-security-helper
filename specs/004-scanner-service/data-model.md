# Data Model: Scanner Service

**Feature**: 004-scanner-service
**Date**: 2026-03-16

---

## Entities

### ScanTarget

Represents a folder path that has been scanned. Uniquely identified by (projectId, path).

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| id | UUID | PK, auto-generated | |
| projectId | UUID | FK → Project.id, required | |
| path | String | required | Absolute path to scanned folder |
| displayName | String | required | Derived from folder name (e.g., `path.basename(path)`) |
| createdAt | DateTime | auto | |
| updatedAt | DateTime | auto | |

**Unique constraint**: `@@unique([projectId, path])`

**Relationships**:
- Belongs to Project (many-to-one)
- Has many Scans
- Has many Findings

### Scan

One execution of the ASH CLI scanner. Tracks lifecycle from initiation to completion.

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| id | UUID | PK, auto-generated | |
| projectId | UUID | FK → Project.id, required | |
| scanTargetId | UUID | FK → ScanTarget.id, required | |
| sourceDir | String | required | Absolute path passed to `--source-dir` |
| status | ScanStatus | required | Current scan state |
| severityThreshold | String | default "LOW" | Minimum severity to report |
| findingsCount | Int | default 0 | Total findings after parse |
| severityBreakdown | Json | nullable | `{ CRITICAL: n, HIGH: n, ... }` |
| startedAt | DateTime | auto (now) | When scan was initiated |
| completedAt | DateTime | nullable | When scan reached terminal state |
| errorMessage | String | nullable | Error details for FAILED scans |

**Index**: `@@index([projectId, startedAt(sort: Desc)])` — for scan history queries

**Relationships**:
- Belongs to Project (many-to-one)
- Belongs to ScanTarget (many-to-one)
- Has many Findings (cascade delete)

### Finding

A single security issue discovered by the scanner.

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| id | UUID | PK, auto-generated | |
| scanId | UUID | FK → Scan.id, onDelete: Cascade | |
| projectId | UUID | FK → Project.id, required | |
| scanTargetId | UUID | FK → ScanTarget.id, required | |
| ruleId | String | required | Scanner rule identifier |
| ruleIds | Json | nullable | Additional rule IDs (multi-scanner) |
| scanner | String | required | Scanner name (e.g., "bandit") |
| severity | Severity | required | CRITICAL/HIGH/MEDIUM/LOW/INFO |
| file | String | required | Relative file path |
| startLine | Int | required | First line of finding |
| endLine | Int | nullable | Last line (if range) |
| title | String | required | Short description |
| description | String | required | Full description |
| snippet | String | nullable | Source code snippet |
| disposition | Disposition | default PENDING | Triage state |

**Indexes**:
- `@@index([scanTargetId, ruleId, file])` — for dedup/lookup
- `@@index([scanId, severity])` — for severity breakdown queries

**Relationships**:
- Belongs to Scan (many-to-one, cascade delete)
- Belongs to Project (many-to-one)
- Belongs to ScanTarget (many-to-one)

## State Transitions

### ScanStatus

```text
  startScan()         exit 0/2 + parse OK
  ─────────► RUNNING ──────────────────────► COMPLETED
                │
                ├── cancelScan() ──────────► CANCELLED
                │
                ├── exit 1 / timeout / ────► FAILED
                │   ENOENT / parse error
                │
                └── crash recovery ────────► FAILED
                    (stale on init)
```

**Terminal states**: COMPLETED, FAILED, CANCELLED — no transitions out of these.

**Invariant**: At most one RUNNING scan per project at any time (FR-010).

## Enums

### ScanStatus
`RUNNING` | `COMPLETED` | `FAILED` | `CANCELLED`

### Severity
`CRITICAL` | `HIGH` | `MEDIUM` | `LOW` | `INFO`

### Disposition
`PENDING` | `FIX` | `SUPPRESS` | `DEFER`

## Notes

- All entities already exist in the Prisma schema (`vsix/prisma/schema.prisma`). No schema changes needed for this spec.
- The scanner service creates ScanTarget, Scan, and Finding records but does not modify the schema.
- Finding records are created in bulk after SARIF parsing (mapped from `ParsedFinding[]`).
