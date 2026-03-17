# Research: Settings, Admin & Application Lifecycle

## Finding 1: Settings Already Partially Implemented

**Decision**: Extend existing `contributes.configuration` block — do not replace it.

**Rationale**: Three settings already exist in `vsix/package.json` (lines 81-104):
- `ashWorkbench.ashPath` (string, default "ash")
- `ashWorkbench.ashMode` (enum: local/container, default "local")
- `ashWorkbench.scanTimeout` (number, default 600, minimum 30)

The `ScannerService.getConfig()` method (scanner.ts:72-85) already reads all three via `vscode.workspace.getConfiguration('ashWorkbench')`. No changes needed for these three settings — only need to ADD the new ones.

**New settings to add**: `defaultSeverityThreshold`, `llm.provider`, `llm.region`, `llm.modelId`.

**Alternatives considered**: Replacing the entire configuration block — rejected because it risks breaking the existing scanner integration.

## Finding 2: Migration Infrastructure Already Complete

**Decision**: Enhance existing `DatabaseService.runMigrations()` with error reporting — do not rewrite it.

**Rationale**: The current migration runner (database.ts:90-136) already:
- Creates `_ash_migrations` tracking table with `name` and `applied_at` columns
- Reads migration directories sorted alphabetically
- Skips already-applied migrations (idempotent)
- Executes each migration in a transaction (rollback on failure)
- Records applied migration name after success

What's missing: (1) a public method to query the latest applied migration name (schema version), and (2) error handling in `activate()` that catches migration failures and shows retry/reset options.

**Alternatives considered**: Replacing with a third-party migration tool — rejected per Constitution III (Ship Fast / Simplicity First). The current runner works and is battle-tested through 6 migrations.

## Finding 3: Reset Strategy — Window Reload vs In-Place Reinitialize

**Decision**: Use `vscode.commands.executeCommand('workbench.action.reloadWindow')` after data deletion.

**Rationale**: Reset requires invalidating all in-memory state held by services (ScannerService, FindingsService, SidebarWebviewProvider, etc.). Manually reinitializing each service is complex and error-prone. The standard VS Code pattern for destructive state changes is to reload the window, which re-runs `activate()` from scratch. This guarantees:
- Fresh database initialization (all migrations run on empty DB)
- Fresh project record creation via `ensureProject()`
- All UI surfaces start in empty state
- No stale references to old Prisma client

**Alternatives considered**: (1) In-place reinitialize — rejected because every service holds a `db` reference that would become stale. (2) Disposable-based cleanup — same stale reference problem. Window reload is the simplest correct solution.

## Finding 4: Schema Version Reporting

**Decision**: Add a static `getSchemaVersion()` method to `DatabaseService` that queries `_ash_migrations`.

**Rationale**: The `_ash_migrations` table is a raw SQL table not managed by Prisma, so we need to query it via the PGLite instance. Since `DatabaseService` already manages the PGLite lifecycle and the migration table, it's the natural home for a version query. The method queries `SELECT name FROM _ash_migrations ORDER BY id DESC LIMIT 1` and returns the migration name as the schema version string.

**Alternatives considered**: (1) Using Prisma `$queryRaw` — works but requires unsafe casting. (2) A separate utility — rejected because DatabaseService already owns the migration table.

## Finding 5: AdminService as Static Utility

**Decision**: Implement `AdminService` with static methods, not an instance class.

**Rationale**: AdminService orchestrates between DatabaseService (static) and the filesystem. It holds no state of its own. Using static methods matches the DatabaseService pattern and avoids unnecessary instantiation/wiring complexity. Methods:
- `getApplicationInfo(db, extensionVersion)` — queries counts via Prisma, schema version via DatabaseService
- `resetApplication(storagePath)` — closes DB, deletes data directory

**Alternatives considered**: Instance class with constructor injection — rejected because there's no state to manage. The spec says computed on demand, which aligns with static methods.

## Finding 6: ApplicationInfo Type

**Decision**: Define `ApplicationInfo` interface in `vsix/src/models/types.ts` and mirror in `webview/src/types/types.ts`.

**Rationale**: Following Constitution IV (Typed Contracts at Boundaries), the application info response needs a shared type. Structure:
```
ApplicationInfo {
  extensionVersion: string
  schemaVersion: string
  stats: { projectCount: number, scanCount: number, findingCount: number }
}
```
This type is used in the `applicationInfo` message payload and computed on demand (not persisted).
