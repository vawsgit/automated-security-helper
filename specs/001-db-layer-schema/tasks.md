# Tasks: Database Layer & Schema

**Input**: Design documents from `/specs/001-db-layer-schema/`
**Prerequisites**: plan.md (required), spec.md (required), research.md, data-model.md, contracts/database-service.md

**Tests**: Included — explicitly requested in feature description and plan.md Phase C.

**Organization**: Tasks are grouped by user story. Since this is an infrastructure feature, all user stories share the same implementation files (Prisma schema + DatabaseService). The stories differ in which behaviors they validate via tests.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3, US4)
- Include exact file paths in descriptions

## Path Conventions

- Extension source: `vsix/src/`
- Prisma schema: `vsix/prisma/`
- Unit tests: `vsix/src/test/unit/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Install dependencies, create Prisma schema, generate initial migration

- [x] T001 Update dependencies in `vsix/package.json`: add `@prisma/client` and `prisma-pglite` and `@prisma/driver-adapter-utils` to dependencies, move `@electric-sql/pglite` from devDependencies to dependencies, add `prisma` to devDependencies (see research.md R6 for versions)
- [x] T002 Create Prisma schema at `vsix/prisma/schema.prisma` with postgresql provider, driverAdapters preview feature, all 4 entities (Project, ScanTarget, Scan, Finding), 3 enums (ScanStatus, Severity, Disposition), all indexes and cascade delete on Finding→Scan (see data-model.md for exact fields and constraints, technical design Section 4.1 for reference schema)
- [x] T003 Run `npm install` then `npx prisma generate` then `npx prisma migrate dev --name init` in `vsix/` to generate Prisma client and initial migration SQL. Verify `vsix/prisma/migrations/<timestamp>_init/migration.sql` exists and contains CREATE TABLE, CREATE TYPE, and CREATE INDEX statements.

**Checkpoint**: Prisma schema validated, client generated, initial migration SQL created

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core DatabaseService implementation that ALL user stories depend on

- [x] T004 Create `vsix/src/services/database.ts` with DatabaseService class skeleton: static `pglite` and `prisma` fields, static `initialize(storageUri)` method signature, static `close()` method signature, static `client` getter that throws if not initialized. Use proper TypeScript types (avoid `any` in production code; use dynamic import return types or type assertions). See contracts/database-service.md for the full API contract.
- [x] T005 Implement `initialize()` in `vsix/src/services/database.ts`: create storage directory via `fs.mkdirSync(recursive)`, dynamically import PGLite (`await import('@electric-sql/pglite')`), create PGLite instance with filesystem path `storageUri/ash-workbench-pgdata`. Add idempotency guard (return existing client if already initialized). See research.md R4 for ESM/CommonJS interop pattern.
- [x] T006 Implement `runMigrations()` private method in `vsix/src/services/database.ts`: create `_ash_migrations` tracking table (IF NOT EXISTS), read `prisma/migrations/` directories sorted alphabetically, for each unapplied migration read `migration.sql` and execute within `pglite.transaction()`, record applied migration in tracking table. See research.md R3 for the exact pattern and data-model.md Migration Tracking section for table schema.
- [x] T007 Implement PrismaClient creation in `initialize()` in `vsix/src/services/database.ts`: after migrations, dynamically import `prisma-pglite`, call `createPgliteAdapter()` with appropriate options (use `directDatabaseDirPath` if the API requires it — see research.md R1 for API details), create `new PrismaClient({ adapter })`. If the prisma-pglite adapter API does not support our use case, implement fallback per research.md R1 risk mitigation options.
- [x] T008 Implement `close()` in `vsix/src/services/database.ts`: disconnect PrismaClient (`$disconnect()`), close PGLite instance (`.close()`), reset static fields to null for re-initialization. Wrap in try/catch — log errors but do not throw (graceful shutdown). See contracts/database-service.md close() contract.

**Checkpoint**: DatabaseService compiles and has full lifecycle (init → migrate → client → close). User story testing can begin.

---

## Phase 3: User Story 1 — Extension Activates with Initialized Database (Priority: P1)

**Goal**: Verify DatabaseService initializes correctly and all entities support CRUD operations

**Independent Test**: Initialize database with in-memory PGLite, verify all tables exist and all entity types support create/read/update/delete

### Tests for User Story 1

- [x] T009 [US1] Create test file `vsix/src/test/unit/database.test.ts` with test infrastructure: import assert, describe block for "DatabaseService", before/after hooks that initialize and close a DatabaseService instance using in-memory PGLite (no path argument). Must handle ESM dynamic imports same as production code.
- [x] T010 [US1] Add test "initializes fresh database with all tables" in `vsix/src/test/unit/database.test.ts`: after initialize(), verify PrismaClient can query all 4 entity tables without error (empty findMany on project, scanTarget, scan, finding). Maps to spec US1-S1, FR-001.
- [x] T011 [US1] Add test "idempotent initialization returns same client" in `vsix/src/test/unit/database.test.ts`: call initialize() twice, verify both return the same PrismaClient instance, no errors. Maps to spec US1-S2, FR-012, SC-004.
- [x] T012 [US1] Add test "CRUD Project" in `vsix/src/test/unit/database.test.ts`: create a Project with name and rootPath, read it back by id, update the name, delete it, verify it is gone. Maps to FR-003, SC-002.
- [x] T013 [US1] Add test "CRUD ScanTarget" in `vsix/src/test/unit/database.test.ts`: create a Project, then create a ScanTarget with projectId and path and displayName, read back, update displayName, delete, verify gone. Maps to FR-004, SC-002.
- [x] T014 [US1] Add test "CRUD Scan" in `vsix/src/test/unit/database.test.ts`: create Project → ScanTarget → Scan with status RUNNING, read back, update status to COMPLETED and set completedAt, delete, verify gone. Maps to FR-005, SC-002.
- [x] T015 [US1] Add test "CRUD Finding" in `vsix/src/test/unit/database.test.ts`: create Project → ScanTarget → Scan → Finding with all required fields (ruleId, scanner, severity, file, startLine, title, description, disposition default PENDING), read back, update disposition to FIX, delete, verify gone. Maps to FR-006, SC-002.
- [x] T016 [US1] Add test "clean shutdown" in `vsix/src/test/unit/database.test.ts`: initialize, create a Project, close, verify close completes without error. Maps to FR-011, US1-S3, SC-006.

**Checkpoint**: All US1 tests pass. DatabaseService initializes, all entities have full CRUD, shutdown is clean. Run: `npx mocha out/test/unit/database.test.js`

---

## Phase 4: User Story 2 — Data Persistence Across Sessions (Priority: P1)

**Goal**: Verify data survives database close and re-initialization

**Independent Test**: Write data, close database, re-initialize at same path, verify data is present

### Tests for User Story 2

- [x] T017 [US2] Add test "query findings by composite key (scanTargetId, ruleId, file)" in `vsix/src/test/unit/database.test.ts`: create multiple findings with different (scanTargetId, ruleId, file) combinations, query with where clause on all three fields, verify correct results returned. Maps to FR-008.
- [x] T018 [US2] Add test "scan history ordering" in `vsix/src/test/unit/database.test.ts`: create 3 scans with different startedAt values, query with orderBy startedAt desc, verify order is most recent first. Maps to FR-009.
- [x] T019 [US2] Add test "finding filter by scanId and severity" in `vsix/src/test/unit/database.test.ts`: create findings across 2 scans with mixed severities, query with where scanId + severity HIGH, verify only matching findings returned. Maps to FR-010.

**Checkpoint**: All US2 tests pass. Query patterns for finding list, scan history, and cumulative views work correctly.

---

## Phase 5: User Story 3 — Schema Migrations Run Automatically (Priority: P2)

**Goal**: Verify migration runner applies new migrations, skips applied ones, and rolls back failures

**Independent Test**: Run migrations, add a new one, re-initialize, verify only the new migration runs

### Tests for User Story 3

- [x] T020 [US3] Add test "migration idempotency — running twice produces no errors" in `vsix/src/test/unit/database.test.ts`: initialize database (runs migrations), close, re-initialize at same storage (re-runs migration check), verify no errors and data is intact. Maps to US3-S2, FR-012.
- [x] T021 [US3] Add test "Project rootPath unique constraint" in `vsix/src/test/unit/database.test.ts`: create a Project with rootPath "/test/path", attempt to create another Project with the same rootPath, verify it throws a unique constraint error. Maps to validation rule V1.
- [x] T022 [US3] Add test "ScanTarget composite unique constraint" in `vsix/src/test/unit/database.test.ts`: create a ScanTarget with (projectId, path), attempt to create another with the same combo, verify it throws a unique constraint error. Maps to validation rule V2.

**Checkpoint**: All US3 tests pass. Migration runner is idempotent, schema constraints enforced.

---

## Phase 6: User Story 4 — Cascade Deletion of Scan Data (Priority: P2)

**Goal**: Verify deleting a Scan cascades to its Findings and does not affect other scans

**Independent Test**: Create scan with findings, delete scan, verify findings are gone

### Tests for User Story 4

- [x] T023 [US4] Add test "cascade delete Scan removes all associated Findings" in `vsix/src/test/unit/database.test.ts`: create a Scan with 5 Findings, delete the Scan via `prisma.scan.delete()`, query Findings by scanId, verify count is 0. Maps to FR-007, SC-003, US4-S1.
- [x] T024 [US4] Add test "cascade delete is isolated to deleted scan" in `vsix/src/test/unit/database.test.ts`: create 2 Scans each with 3 Findings, delete Scan 1, verify Scan 2 still has its 3 Findings intact. Maps to US4-S2.

**Checkpoint**: All US4 tests pass. Cascade deletion works correctly and is isolated.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Verify everything compiles, lints, and integrates

- [x] T025 Run `npm run compile` in `vsix/` and fix any TypeScript errors
- [x] T026 Run `npm run lint` in `vsix/` and fix any ESLint errors
- [x] T027 Run `npm run test:unit` in `vsix/` and verify all tests pass (including existing `pglite.smoke.test.ts` regression)
- [x] T028 Verify test suite completes within 5 seconds (SC-005)

**Checkpoint**: All code compiles, lints clean, all tests pass within 5 seconds, no regressions.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on Phase 1 completion — BLOCKS all user stories
- **US1 (Phase 3)**: Depends on Phase 2 — core CRUD validation
- **US2 (Phase 4)**: Depends on Phase 2 — can run in parallel with US1
- **US3 (Phase 5)**: Depends on Phase 2 — can run in parallel with US1/US2
- **US4 (Phase 6)**: Depends on Phase 2 — can run in parallel with US1/US2/US3
- **Polish (Phase 7)**: Depends on all phases complete

### User Story Dependencies

- **US1 (P1)**: Can start after Phase 2 — No dependencies on other stories
- **US2 (P1)**: Can start after Phase 2 — No dependencies on other stories
- **US3 (P2)**: Can start after Phase 2 — No dependencies on other stories
- **US4 (P2)**: Can start after Phase 2 — No dependencies on other stories

All user stories write to the same test file (`database.test.ts`) in separate `describe` blocks. If implemented sequentially, each phase adds tests to the file. If parallelized, merge test blocks after.

### Within Each User Story

- Tests are written directly (no TDD red-green since the implementation is in Phase 2)
- Each test verifies a specific spec requirement (FR, SC, or acceptance scenario)
- Tests are independent — each uses a fresh in-memory database

### Parallel Opportunities

- T001, T002 can run in parallel (different files)
- T005, T006 can be developed concurrently (different methods in same file)
- T012–T015 can be written in parallel (independent test cases in same file)
- T017–T019 can be written in parallel (independent test cases)
- T025, T026 can run in parallel (compile vs lint)
- All user story test phases (3-6) can theoretically run in parallel since all depend only on Phase 2

---

## Parallel Example: Phase 2 (Foundational)

```bash
# These two tasks modify different methods in database.ts:
Task T005: "Implement initialize() — PGLite setup"
Task T006: "Implement runMigrations() — migration runner"

# After both complete, this task wires them together:
Task T007: "Implement PrismaClient creation with adapter"
```

## Parallel Example: User Story Tests

```bash
# All CRUD tests are independent and can be written concurrently:
Task T012: "CRUD Project"
Task T013: "CRUD ScanTarget"
Task T014: "CRUD Scan"
Task T015: "CRUD Finding"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001–T003)
2. Complete Phase 2: Foundational (T004–T008)
3. Complete Phase 3: US1 Tests (T009–T016)
4. **STOP and VALIDATE**: All CRUD works, init/shutdown clean
5. This is the minimally useful database layer

### Incremental Delivery

1. Phase 1 + Phase 2 → DatabaseService compiles and runs
2. Add US1 tests → CRUD validated (MVP!)
3. Add US2 tests → Query patterns validated
4. Add US3 tests → Migration robustness validated
5. Add US4 tests → Cascade behavior validated
6. Phase 7 → Everything clean and passing

### Risk-First Strategy (Recommended)

Given the medium risk on `prisma-pglite` API compatibility (research.md R1):

1. Complete T001–T003 (setup + schema)
2. Jump to T004–T007 (DatabaseService with PrismaClient creation)
3. **SPIKE CHECKPOINT**: Does `createPgliteAdapter()` work with our storage path? Does PrismaClient connect?
   - If YES: Continue with T008 and all test phases
   - If NO: Execute fallback per research.md R5 (SQLite switch), then continue
4. Complete remaining tasks

---

## Notes

- All tests use in-memory PGLite (`new PGlite()` with no path) for speed and isolation
- The `database.test.ts` file contains all test cases organized in describe blocks per user story
- Dynamic `import()` is required for ESM packages — both in production code and test code
- The existing `pglite.smoke.test.ts` must continue to pass (regression)
- Total test count: 16 test cases across 4 user stories
