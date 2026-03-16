# Research: Database Layer & Schema

**Feature**: 001-db-layer-schema
**Date**: 2026-03-16

## R1: prisma-pglite Adapter Compatibility

### Decision
Use `prisma-pglite` v2.0.2 for the Prisma driver adapter, accessed via dynamic `import()` to handle its ESM-only module format in the extension's CommonJS context.

### Rationale
- `prisma-pglite` is the only community adapter connecting Prisma to PGLite
- The ESM-only constraint is solvable: the existing `pglite.smoke.test.ts` already uses `await import('@electric-sql/pglite')` for the same reason
- `@prisma/adapter-pg` (the official PostgreSQL adapter) requires the `pg` library (node-postgres), which PGLite does not implement
- No other Prisma adapter exists for in-process PostgreSQL

### Alternatives Considered
1. **@prisma/adapter-pg + PGLite** — Rejected: requires `pg ^8.16.3` (node-postgres). PGLite does not expose a `pg`-compatible client interface.
2. **Raw PGLite without Prisma** — Rejected: loses type-safe queries, schema-as-code, and migration generation. Would require hand-written SQL and manual type mapping.
3. **SQLite via better-sqlite3** — Documented fallback (see R5). Native Prisma support, proven path, but loses PostgreSQL JSON columns and enum types.

### Key Details
- **Package**: `prisma-pglite` v2.0.2
- **Import**: `import { createPgliteAdapter } from 'prisma-pglite'` (root, not subpath)
- **Peer dependencies**: `prisma >= 6.6.0`, `@electric-sql/pglite *`, `@prisma/driver-adapter-utils *`
- **Module format**: ESM-only (`type: "module"`), requires dynamic `import()` in CommonJS
- **Node.js**: Claims Node 22+, but only for the package's own tooling (migration CLI). The adapter itself should work in VS Code's Node.js runtime via dynamic import.
- **API difference from technical design**: `createPgliteAdapter()` takes an options object, not a PGLite instance directly. The adapter creates its own PGLite instance internally, or accepts configuration for where to store data.

### Risk
Medium. The `prisma-pglite` API differs from what the technical design assumed (`createPgliteAdapter(pglite)` vs options object). The DatabaseService implementation must adapt. If the adapter's internal PGLite management conflicts with our need to control the storage path, we may need to either:
- Pass a `directDatabaseDirPath` option to control persistence location
- Create a minimal custom adapter using `@prisma/driver-adapter-utils` directly
- Fall back to SQLite (R5)

---

## R2: PGLite Capabilities Validation

### Decision
PGLite fully supports all PostgreSQL features required by the schema: enums, UUIDs, JSON/JSONB, transactions, and multi-statement execution.

### Rationale
Validated through documentation review, existing smoke test evidence, and PGLite's architecture (full PostgreSQL WASM build, not a subset).

### Findings

| Feature | Supported | Evidence |
|---------|-----------|----------|
| `CREATE TYPE ... AS ENUM` | Yes | Core PostgreSQL feature, included in WASM build |
| `gen_random_uuid()` | Yes | Built-in since PostgreSQL 13, no extension needed |
| `uuid-ossp` extension | Yes | Bundled at `@electric-sql/pglite/contrib/uuid_ossp` |
| JSONB columns | Yes | Confirmed by existing `pglite.smoke.test.ts` (JSON query test) |
| Multi-statement `exec()` | Yes | Documented: "particularly useful for database migrations" |
| `transaction(callback)` | Yes | Auto-commit on resolve, auto-rollback on reject |
| Foreign key constraints | Yes | Core PostgreSQL feature |
| `CASCADE` on delete | Yes | Core PostgreSQL feature |
| Composite unique indexes | Yes | Core PostgreSQL feature |

### Risk
Low. All features validated. No PGLite-specific limitations affect this schema.

---

## R3: Migration Strategy Validation

### Decision
Use raw SQL execution via `pglite.exec()` with a custom `_ash_migrations` tracking table, exactly as designed in technical design Section 4.3. Do NOT use `prisma-pglite`'s built-in schema push (it only works on new databases and requires full reset for changes).

### Rationale
- Prisma Migrate's engine requires a network-accessible PostgreSQL (not PGLite)
- `prisma-pglite`'s built-in migration handling only supports schema push on new databases — incremental migrations require a database reset
- Raw SQL execution via `pglite.exec()` is fully supported and handles multi-statement migration files
- Transactions ensure atomic migration application (all-or-nothing per migration)

### Migration Execution Pattern
```
1. Create _ash_migrations tracking table (IF NOT EXISTS)
2. List prisma/migrations/ directories, sorted alphabetically (timestamp-prefixed)
3. For each migration directory:
   a. Check if name exists in _ash_migrations
   b. If not applied:
      - Read migration.sql
      - Execute within pglite.transaction()
      - Insert tracking record (atomically with schema changes)
4. After all migrations applied, create PrismaClient with adapter
```

### Prisma Migration File Structure
```
prisma/migrations/
├── 20260316000000_init/
│   └── migration.sql
├── 20260320000000_add_index/
│   └── migration.sql
└── migration_lock.toml
```

### Risk
Low. This pattern is well-documented in the technical design and validated by PGLite's API documentation.

---

## R4: ESM/CommonJS Interop Pattern

### Decision
Use dynamic `import()` for all ESM-only packages (`@electric-sql/pglite`, `prisma-pglite`). This pattern is already established in the codebase.

### Rationale
- VS Code extensions compile to CommonJS (Node16 modules, `tsconfig.json`)
- Both `@electric-sql/pglite` and `prisma-pglite` are ESM-only
- The existing `pglite.smoke.test.ts` successfully uses `await import('@electric-sql/pglite')`
- Dynamic `import()` is supported in Node.js CommonJS context for loading ESM modules

### Pattern
```typescript
// In DatabaseService (CommonJS context)
const { PGlite } = await import('@electric-sql/pglite');
const { createPgliteAdapter } = await import('prisma-pglite');
```

### Risk
Low. Pattern is proven in the existing codebase.

---

## R5: SQLite Fallback Assessment

### Decision
Document SQLite via `better-sqlite3` as the fallback if PGLite + Prisma integration fails within the first 1-2 days of implementation.

### Rationale
- `better-sqlite3` has native Prisma support (no adapter or preview features needed)
- Multiple VS Code extensions successfully use SQLite
- Full Prisma Migrate support (incremental migrations work correctly)
- Tradeoff: JSON columns become text fields parsed in application code

### What Changes on Fallback
| Component | PGLite | SQLite |
|-----------|--------|--------|
| Prisma schema `provider` | `postgresql` | `sqlite` |
| `previewFeatures` | `["driverAdapters"]` | None needed |
| JSON fields (`severityBreakdown`, `ruleIds`) | Native JSONB | String (parsed in app) |
| Enums | Native PostgreSQL enums | String with Prisma validation |
| UUID generation | `gen_random_uuid()` | Application-generated (uuid package) |
| Driver adapter | `prisma-pglite` | None (native) |
| Migration execution | Raw SQL via `pglite.exec()` | Standard `prisma migrate deploy` |

### What Stays the Same
- All Prisma queries and TypeScript types
- All service interfaces (DatabaseService API)
- All test structure and assertions
- Entity relationships and indexes

### Risk
None. This is the de-risking strategy.

---

## R6: Dependency Versions

### Decision
Use the following dependency versions:

| Package | Version | Type | Notes |
|---------|---------|------|-------|
| `@electric-sql/pglite` | `^0.2.17` | production | Move from devDependencies |
| `prisma-pglite` | `^2.0.2` | production | Prisma driver adapter |
| `@prisma/client` | `^7.5.0` | production | ORM client |
| `@prisma/driver-adapter-utils` | `^7.5.0` | production | Required peer dep |
| `prisma` | `^7.5.0` | dev | Schema tooling, migration generation |

### Rationale
- Use latest stable Prisma (7.5.0) rather than the technical design's `^6.x` — Prisma 7.x is current, and `prisma-pglite` requires `>=6.6.0`
- `@electric-sql/pglite` stays at `^0.2.17` (already in devDependencies, validated by smoke test)
- `@prisma/driver-adapter-utils` is a required peer dependency of `prisma-pglite`
