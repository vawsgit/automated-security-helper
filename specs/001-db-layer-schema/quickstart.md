# Quickstart: Database Layer & Schema

**Feature**: 001-db-layer-schema

## Prerequisites

- Node.js 22+ (for Prisma migration generation tooling)
- VS Code 1.110+ (for extension development)
- npm

## Setup

```bash
cd workbench/vsix

# Install dependencies (includes new Prisma + PGLite packages)
npm install

# Generate Prisma client from schema
npx prisma generate

# Generate initial migration (development only)
npx prisma migrate dev --name init
```

## Key Files

| File | Purpose |
|------|---------|
| `vsix/prisma/schema.prisma` | Database schema (entities, enums, indexes) |
| `vsix/prisma/migrations/` | Generated SQL migration files |
| `vsix/src/services/database.ts` | DatabaseService (init, migrate, close) |
| `vsix/src/test/unit/database.test.ts` | Unit tests (in-memory PGLite) |

## Running Tests

```bash
# Compile and run unit tests (includes database tests)
npm run compile && npm run test:unit

# Run just the database tests
npx mocha out/test/unit/database.test.js
```

## Development Workflow

### Modifying the Schema

1. Edit `prisma/schema.prisma`
2. Generate migration: `npx prisma migrate dev --name describe_change`
3. Review generated SQL in `prisma/migrations/<timestamp>_describe_change/migration.sql`
4. Run tests to verify: `npm run test:unit`

### How Migrations Work at Runtime

The extension does NOT use `prisma migrate deploy` at runtime. Instead:

1. On activation, `DatabaseService.initialize()` reads migration SQL files from `prisma/migrations/`
2. Each unapplied migration is executed via `pglite.exec(sql)` within a transaction
3. Applied migrations are tracked in an `_ash_migrations` table
4. After migrations, a PrismaClient is created with the PGLite adapter

### Testing with In-Memory Database

Tests use `new PGlite()` (no path argument) for in-memory databases:
- No filesystem artifacts
- Fast initialization (~100ms)
- Isolated per test suite
- Migrations run the same way as production

## Fallback: SQLite

If PGLite + Prisma integration fails:

1. Change `prisma/schema.prisma` provider to `sqlite`
2. Remove `previewFeatures = ["driverAdapters"]`
3. Remove `prisma-pglite` and `@electric-sql/pglite` dependencies
4. Add `better-sqlite3` dependency
5. Simplify `DatabaseService` (no adapter needed, standard Prisma connection)
6. Re-generate migrations: `npx prisma migrate dev --name init`

All Prisma queries, TypeScript types, and test assertions remain unchanged.
