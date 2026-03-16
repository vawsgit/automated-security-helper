# Feature Specification: Database Layer & Schema

**Feature Branch**: `001-db-layer-schema`
**Created**: 2026-03-16
**Status**: Draft
**Input**: User description: "Database Layer & Schema — Foundation phase, no dependencies. The in-process database layer using PGLite (WASM PostgreSQL) with Prisma ORM. This is the persistence foundation for every subsequent spec."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Extension Activates with Initialized Database (Priority: P1)

When a developer opens a workspace with the ASH Workbench extension installed, the extension silently initializes an embedded database on first activation. The database is ready to accept data (projects, scans, findings) before any user-facing feature runs. The developer does not interact with the database directly — they simply experience a working extension.

**Why this priority**: Every subsequent feature (project management, scanning, finding triage) depends on a functioning database. Without this, the extension cannot persist any data.

**Independent Test**: Can be fully tested by activating the extension and verifying the database service returns a usable client that can perform basic CRUD operations on all entity types.

**Acceptance Scenarios**:

1. **Given** a fresh installation (no prior data), **When** the extension activates, **Then** the database is initialized with all required tables, enums, and indexes, and is ready to accept queries.
2. **Given** an extension that was previously activated (database directory already exists), **When** the extension activates again, **Then** the existing database is opened without data loss and without re-running already-applied migrations.
3. **Given** the extension is active, **When** the extension deactivates (VS Code closes), **Then** the database connection is closed cleanly without data corruption.

---

### User Story 2 - Data Persistence Across Sessions (Priority: P1)

A developer creates a project, runs a scan, and closes VS Code. When they reopen the workspace later, all their previous data (project, scans, findings, dispositions) is intact. The database persists data to the filesystem between sessions.

**Why this priority**: Data persistence is the core value proposition of an embedded database. Without it, the extension would lose all work on every restart.

**Independent Test**: Can be tested by writing data to the database, shutting down the service, reinitializing it, and verifying all previously written data is retrievable.

**Acceptance Scenarios**:

1. **Given** a project and scan data exist in the database, **When** the database service is closed and re-initialized at the same storage path, **Then** all previously stored data is present and queryable.
2. **Given** findings with non-default dispositions, **When** the database is restarted, **Then** disposition values are preserved exactly as set.

---

### User Story 3 - Schema Migrations Run Automatically (Priority: P2)

When a developer installs a new version of the extension that includes database schema changes, the migrations run automatically on activation. The developer sees their existing data preserved, with the schema updated to the new version. If a migration fails, the developer is not left with a corrupted database.

**Why this priority**: Automatic migrations are essential for a seamless upgrade experience, but this story is lower priority than initial setup because it only matters after the first version ships.

**Independent Test**: Can be tested by initializing a database, adding a new migration, re-running initialization, and verifying the new migration is applied while previously applied migrations are skipped.

**Acceptance Scenarios**:

1. **Given** a database with migrations 1 and 2 applied, **When** the extension activates with migrations 1, 2, and 3 available, **Then** only migration 3 is executed.
2. **Given** a database with all current migrations applied, **When** the extension activates with the same migrations, **Then** no migrations run and the database is unchanged (idempotent).
3. **Given** a migration that contains invalid SQL, **When** the migration is attempted, **Then** the database remains in its pre-migration state (no partial schema changes applied).

---

### User Story 4 - Cascade Deletion of Scan Data (Priority: P2)

When a developer deletes a past scan, all findings associated with that scan are automatically removed from the database. This prevents orphaned records and keeps storage clean.

**Why this priority**: Cascade deletion is a data integrity feature that becomes important once scan management is built, but the core loop works without it initially.

**Independent Test**: Can be tested by creating a scan with multiple findings, deleting the scan, and verifying all associated findings are removed.

**Acceptance Scenarios**:

1. **Given** a scan with 50 associated findings, **When** the scan is deleted, **Then** all 50 findings are automatically deleted.
2. **Given** two scans for the same project, **When** one scan is deleted, **Then** the other scan and its findings are unaffected.

---

### Edge Cases

- What happens when the storage directory does not exist yet? The database service creates it.
- What happens when the storage directory is read-only or on a full disk? The initialization fails with a clear error rather than corrupting data.
- What happens when two VS Code windows open the same workspace simultaneously? PGLite supports single-connection access only; the second instance receives a clear error.
- What happens when a migration file is missing or corrupted? The migration runner skips execution and reports the error, leaving the database in its last-known-good state.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST initialize an embedded database on extension activation using the extension's global storage directory as the persistence location.
- **FR-002**: The system MUST apply pending schema migrations automatically on each activation, tracking which migrations have been applied.
- **FR-003**: The system MUST support creating, reading, updating, and deleting Project records with fields: id (UUID), name, rootPath (unique), createdAt, updatedAt.
- **FR-004**: The system MUST support creating, reading, updating, and deleting ScanTarget records with fields: id (UUID), projectId, path, displayName, createdAt, updatedAt. The combination of projectId and path MUST be unique.
- **FR-005**: The system MUST support creating, reading, updating, and deleting Scan records with fields: id (UUID), projectId, scanTargetId, sourceDir, status (enum: RUNNING, COMPLETED, FAILED, CANCELLED), severityThreshold, findingsCount, severityBreakdown (structured data), startedAt, completedAt, errorMessage.
- **FR-006**: The system MUST support creating, reading, updating, and deleting Finding records with fields: id (UUID), scanId, projectId, scanTargetId, ruleId, ruleIds (structured data), scanner, severity (enum: CRITICAL, HIGH, MEDIUM, LOW, INFO), file, startLine, endLine, title, description, snippet, disposition (enum: PENDING, FIX, SUPPRESS, DEFER, default PENDING).
- **FR-007**: The system MUST cascade-delete all findings when their parent scan is deleted.
- **FR-008**: The system MUST support querying findings by the composite key (scanTargetId, ruleId, file) for deduplication and cumulative views.
- **FR-009**: The system MUST support querying scans ordered by startedAt descending within a project (for scan history).
- **FR-010**: The system MUST support querying findings filtered by scanId and severity (for filtered finding lists).
- **FR-011**: The system MUST cleanly shut down the database connection when the extension deactivates, without data loss.
- **FR-012**: Migration application MUST be idempotent — running the same set of migrations multiple times MUST produce the same result without errors.
- **FR-013**: The system MUST persist all data to the filesystem so that data survives across VS Code sessions.

### Key Entities

- **Project**: The root aggregate. Represents a workspace. Has a unique rootPath and a user-provided name. Parent of ScanTargets, Scans, and Findings.
- **ScanTarget**: A specific directory within a project that ASH scans against. Scopes findings and dispositions. Unique per (projectId, path).
- **Scan**: A single execution of the ASH scanner suite against a target. Tracks execution status, timing, and result counts. Parent of Findings.
- **Finding**: An individual security issue detected by a scanner. Contains rule info, location (file, lines), severity, and triage disposition. Identified across scans by the composite (scanTargetId, ruleId, file).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: The database initializes and is ready to accept queries within 3 seconds of extension activation on typical hardware.
- **SC-002**: All four entities (Project, ScanTarget, Scan, Finding) support full create, read, update, and delete operations.
- **SC-003**: Deleting a scan automatically removes all associated findings with no manual cleanup required.
- **SC-004**: Running the initialization sequence twice on the same database produces no errors and no data loss.
- **SC-005**: Unit tests covering all CRUD operations and migration scenarios pass within 5 seconds using in-memory mode.
- **SC-006**: The database cleanly shuts down on extension deactivation, and all data written during the session is available on the next activation.

## Assumptions

- The extension's `context.globalStorageUri` is a writable directory managed by VS Code, available on all supported platforms (macOS, Linux, Windows).
- PGLite WASM is compatible with VS Code's Node.js extension host environment (confirmed by existing smoke test `pglite.smoke.test.ts`).
- The `prisma-pglite` community adapter provides a stable Prisma driver adapter for PGLite. If this proves unreliable, the documented fallback is SQLite via `better-sqlite3` (affects only database initialization code and Prisma schema provider).
- A single-connection database model is acceptable since VS Code extensions run single-threaded per window.
- Migration files are generated during development using Prisma Migrate and bundled with the extension; they are not generated at runtime.

## Fallback

If PGLite + Prisma integration fails during the implementation spike, the documented fallback is SQLite via `better-sqlite3`. This switch affects only the database service initialization and Prisma schema provider — all entity definitions, queries, and tests remain the same. The fallback decision should be made within the first 1-2 days of implementation.
