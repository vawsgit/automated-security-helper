# Implementation Plan: Database Layer & Schema

**Branch**: `001-db-layer-schema` | **Date**: 2026-03-16 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-db-layer-schema/spec.md`

## Summary

Build the in-process database layer using PGLite (WASM PostgreSQL) with Prisma ORM. This creates the persistence foundation for the ASH Workbench extension: schema definition, migration runner, database service lifecycle, and unit tests. The database runs entirely within the VS Code extension host process with filesystem persistence at `context.globalStorageUri`.

## Technical Context

**Language/Version**: TypeScript 5.9, strict mode, ES2022 target, Node16 modules
**Primary Dependencies**: `@electric-sql/pglite` ^0.2.17, `prisma-pglite` ^2.0.2, `@prisma/client` ^7.5.0, `prisma` ^7.5.0
**Storage**: PGLite (in-process WASM PostgreSQL) with filesystem persistence
**Testing**: Mocha (unit tests via `.mocharc.yaml`), PGLite in-memory mode
**Target Platform**: VS Code extension host (Node.js), VS Code engine ^1.110.0
**Project Type**: VS Code extension (TypeScript, CommonJS output)
**Performance Goals**: Database initialization < 3 seconds, unit test suite < 5 seconds
**Constraints**: Single-connection only (WASM), ESM-only packages require dynamic import(), no network-accessible database
**Scale/Scope**: Single user, ~100-1000 findings per scan, ~10-50 scans per project

## Constitution Check

*No constitution file exists. Applying constraints from spec and technical design.*

| Gate | Status | Notes |
|------|--------|-------|
| Database runs in-process as WASM | PASS | PGLite runs in VS Code extension host |
| All data in `context.globalStorageUri` | PASS | PGLite path is `storageUri/ash-workbench-pgdata` |
| TypeScript strict mode | PASS | `tsconfig.json` has `strict: true` |
| No `any` types in production code | PASS | Tests may use `any` for dynamic imports; production code typed |
| Single developer maintainability | PASS | One service class, standard Prisma queries |

## Project Structure

### Documentation (this feature)

```text
specs/001-db-layer-schema/
├── plan.md              # This file
├── spec.md              # Feature specification
├── research.md          # Technology research findings
├── data-model.md        # Entity definitions and relationships
├── quickstart.md        # Developer setup guide
├── contracts/
│   └── database-service.md  # DatabaseService API contract
└── checklists/
    └── requirements.md  # Specification quality checklist
```

### Source Code (repository root)

```text
workbench/vsix/
├── prisma/
│   ├── schema.prisma                        # NEW: Prisma schema (entities, enums, indexes)
│   └── migrations/
│       └── <timestamp>_init/
│           └── migration.sql                # NEW: Generated initial migration SQL
├── src/
│   └── services/
│       └── database.ts                      # NEW: DatabaseService class
├── src/test/
│   └── unit/
│       ├── database.test.ts                 # NEW: Database unit tests
│       └── pglite.smoke.test.ts             # EXISTING: PGLite smoke test (keep as-is)
└── package.json                             # MODIFY: Add dependencies
```

**Structure Decision**: Files are added within the existing `vsix/` extension structure. The `prisma/` directory is placed at `vsix/prisma/` (standard Prisma convention). The `services/` directory is created under `src/` as specified in the technical design Section 2.

## Implementation Phases

### Phase A: Dependencies & Prisma Schema

**Goal**: Install packages, create Prisma schema, generate initial migration.

**Files**:
- `vsix/package.json` — Add production dependencies (`@prisma/client`, `prisma-pglite`, `@prisma/driver-adapter-utils`), move `@electric-sql/pglite` from devDependencies to dependencies, add `prisma` as devDependency
- `vsix/prisma/schema.prisma` — Create schema with all 4 entities, 3 enums, all indexes, cascade delete on Finding→Scan. Enable `driverAdapters` preview feature.

**Validation**: `npx prisma validate` passes. `npx prisma generate` produces client. `npx prisma migrate dev --name init` generates migration SQL.

**Key decisions**:
- Prisma provider is `postgresql` (PGLite is PostgreSQL-compatible)
- UUID generation via `@default(uuid())` which compiles to `gen_random_uuid()`
- JSONB columns for `severityBreakdown` and `ruleIds` (native PostgreSQL JSON)
- Cascade delete only on Finding→Scan (`onDelete: Cascade`), not on other relationships

### Phase B: DatabaseService Implementation

**Goal**: Create the DatabaseService class with initialization, migration runner, and shutdown.

**Files**:
- `vsix/src/services/database.ts` — DatabaseService static class

**Implementation details**:

1. **Dynamic imports** for ESM packages:
   ```typescript
   const { PGlite } = await import('@electric-sql/pglite');
   const { createPgliteAdapter } = await import('prisma-pglite');
   ```

2. **Migration runner** (`runMigrations` private method):
   - Creates `_ash_migrations` tracking table (IF NOT EXISTS)
   - Reads `prisma/migrations/` directories sorted alphabetically
   - For each unapplied migration: reads `migration.sql`, executes within `pglite.transaction()`, records in tracking table
   - Idempotent: skips already-applied migrations

3. **PrismaClient creation**:
   - After migrations, creates adapter via `createPgliteAdapter()`
   - Passes adapter to `new PrismaClient({ adapter })`
   - Note: The `prisma-pglite` API may take options rather than a PGLite instance. If `createPgliteAdapter` manages its own PGLite internally, the DatabaseService must adapt — either by using `directDatabaseDirPath` option or by creating the adapter at a lower level using `@prisma/driver-adapter-utils`.

4. **Singleton pattern**: `initialize()` is idempotent (returns existing client if already initialized). `close()` resets state for re-initialization.

5. **Error handling**: Migration failures are transactional (rollback per migration). Initialization failures throw descriptive errors.

**Risk mitigation**: If `prisma-pglite`'s `createPgliteAdapter` API does not support passing an existing PGLite instance or controlling the storage path, the fallback approach is:
- Option 1: Use `directDatabaseDirPath` option
- Option 2: Create a minimal adapter using `@prisma/driver-adapter-utils` directly
- Option 3: Switch to SQLite fallback (see research.md R5)

### Phase C: Unit Tests

**Goal**: Comprehensive tests for DatabaseService using PGLite in-memory mode.

**Files**:
- `vsix/src/test/unit/database.test.ts`

**Test cases** (mapped to spec acceptance scenarios):

| Test | Spec Reference | Description |
|------|----------------|-------------|
| Initialize fresh database | US1-S1, FR-001 | Initialize with in-memory PGLite, verify all tables exist |
| Idempotent initialization | US1-S2, FR-012 | Initialize twice, verify no errors, data preserved |
| CRUD Project | FR-003, SC-002 | Create, read, update, delete Project |
| CRUD ScanTarget | FR-004, SC-002 | Create with unique (projectId, path), read, update, delete |
| CRUD Scan | FR-005, SC-002 | Create with enum status, read, update, delete |
| CRUD Finding | FR-006, SC-002 | Create with all fields, read, update disposition, delete |
| Cascade delete Scan→Finding | FR-007, SC-003, US4-S1 | Create scan with findings, delete scan, verify findings gone |
| Isolated cascade | US4-S2 | Delete one scan, verify other scan's findings unaffected |
| Query by composite key | FR-008 | Query findings by (scanTargetId, ruleId, file) |
| Scan history ordering | FR-009 | Query scans ordered by startedAt DESC |
| Finding filter by severity | FR-010 | Query findings by scanId and severity |
| Migration idempotency | US3-S2, FR-012 | Run migrations twice, no errors |
| Clean shutdown | FR-011, US1-S3 | Initialize, write data, close, verify no errors |
| Project rootPath unique | V1 | Creating two projects with same rootPath fails |
| ScanTarget unique constraint | V2 | Creating duplicate (projectId, path) fails |

**Testing pattern**: Each test uses a fresh in-memory PGLite instance (`new PGlite()`) — no filesystem artifacts, fast initialization, fully isolated.

### Phase D: Integration Verification

**Goal**: Verify the full lifecycle works with the existing extension entry point.

**Tasks**:
- Compile the project (`npm run compile`) with no TypeScript errors
- Run lint (`npm run lint`) with no ESLint errors
- Run the full test suite (`npm run test:unit`) — all tests pass within 5 seconds
- Verify the existing `pglite.smoke.test.ts` still passes (regression check)
- Manual smoke test: add a temporary `DatabaseService.initialize()` call in `extension.ts` `activate()`, launch extension host, verify database initializes (check output channel)

## Complexity Tracking

No constitution violations to justify.

## Open Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| `prisma-pglite` API incompatible with our storage path control | Medium | High | Test early in Phase B. Fallback: direct `@prisma/driver-adapter-utils` or SQLite |
| ESM dynamic import fails at runtime in VS Code extension host | Low | High | Pattern already proven by existing smoke test |
| PGLite WASM binary size impacts extension load time | Low | Medium | Measure initialization time against 3-second target |
| Prisma 7.x compatibility issues with prisma-pglite | Low | Medium | Pin to known-good versions, test immediately |
