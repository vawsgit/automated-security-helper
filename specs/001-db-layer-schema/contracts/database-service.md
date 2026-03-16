# Contract: DatabaseService

**Feature**: 001-db-layer-schema
**Type**: Internal service interface (extension host)

## Overview

`DatabaseService` is a static singleton that manages the PGLite database lifecycle and exposes a typed Prisma client. It is the only module that directly interacts with PGLite or manages migrations.

## Public API

### `DatabaseService.initialize(storageUri: vscode.Uri): Promise<PrismaClient>`

Initializes the database and returns a typed Prisma client.

**Parameters**:
- `storageUri` — VS Code's `context.globalStorageUri`. The database directory is created as a subdirectory (`ash-workbench-pgdata`).

**Returns**: A `PrismaClient` instance connected to PGLite.

**Behavior**:
1. Creates the storage directory if it does not exist
2. Initializes PGLite with filesystem persistence at `storageUri/ash-workbench-pgdata`
3. Runs pending migrations (raw SQL via `pglite.exec()`)
4. Creates PrismaClient with the PGLite driver adapter
5. Returns the PrismaClient

**Error behavior**:
- If the storage directory is not writable, throws with a descriptive error
- If a migration fails, the failing migration is rolled back (transaction); previously applied migrations remain. The error is re-thrown.
- If PGLite WASM fails to load, throws with a descriptive error

**Idempotency**: Safe to call multiple times. If already initialized, returns the existing PrismaClient.

**Postconditions**:
- All schema tables exist (Project, ScanTarget, Scan, Finding)
- All enums exist (ScanStatus, Severity, Disposition)
- All indexes exist
- `_ash_migrations` tracking table exists and records all applied migrations

---

### `DatabaseService.close(): Promise<void>`

Shuts down the database connection cleanly.

**Behavior**:
1. Disconnects the PrismaClient (`prisma.$disconnect()`)
2. Closes the PGLite instance (`pglite.close()`)
3. Resets internal state to allow re-initialization

**Error behavior**: Errors during disconnect are logged but do not throw (graceful shutdown).

**Postconditions**:
- All pending writes are flushed to disk
- PGLite WASM resources are released
- Subsequent `initialize()` calls create a fresh connection

---

### `DatabaseService.client: PrismaClient` (getter)

Returns the active PrismaClient instance.

**Precondition**: `initialize()` must have been called. Throws if not initialized.

---

## Integration Points

### Called by:
- `extension.ts` → `activate()`: calls `initialize(context.globalStorageUri)`
- `extension.ts` → `deactivate()`: calls `close()`

### Consumed by:
- All service modules (ScannerService, command handlers, WebView provider) access `DatabaseService.client` for Prisma queries

### Dependencies:
- `@electric-sql/pglite` — WASM PostgreSQL engine
- `prisma-pglite` — Prisma driver adapter
- `@prisma/client` — Generated Prisma client
- `node:fs` — Reading migration SQL files
- `node:path` — Resolving migration file paths

## Prisma Client Usage

Once initialized, consumers use standard Prisma queries:

```
// Create
client.project.create({ data: { name, rootPath } })

// Read
client.finding.findMany({ where: { scanId, severity: 'HIGH' } })

// Update
client.finding.update({ where: { id }, data: { disposition: 'FIX' } })

// Delete (cascade to findings)
client.scan.delete({ where: { id } })

// Ordered query
client.scan.findMany({
  where: { projectId },
  orderBy: { startedAt: 'desc' }
})
```

## Non-Goals

- DatabaseService does NOT expose raw PGLite access to consumers
- DatabaseService does NOT provide query helper methods (consumers use Prisma directly)
- DatabaseService does NOT handle data seeding or test fixtures
