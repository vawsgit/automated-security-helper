# Contract: Project Service Module

**Feature**: 003-project-activation
**Module**: `vsix/src/services/project.ts`

---

## Exported Functions

### ensureProject

```
ensureProject(
  db: PrismaClient,
  workspaceFolders: readonly WorkspaceFolder[]
): Promise<Project>
```

Creates or retrieves the Project record for the current workspace. Uses the first workspace folder's path as the unique key.

**Parameters**:
- `db` — Prisma client instance (from `DatabaseService.client`)
- `workspaceFolders` — Non-empty array of VS Code workspace folders (caller must validate non-empty before calling)

**Returns**: The Project record (either existing or newly created).

**Behavior**:
1. Extract `rootPath` from `workspaceFolders[0].uri.fsPath`
2. Extract `name` from `workspaceFolders[0].name`
3. Upsert: find by `rootPath`, create if not found, no-op update if found
4. Return the Project record

**Preconditions**:
- `db` is an initialized Prisma client (caller checked)
- `workspaceFolders` is non-empty (caller checked)

**Error handling**: Propagates Prisma errors to caller (activate function handles them).

---

## Extension Lifecycle Contract

### activate (modified)

```
activate(context: ExtensionContext): Promise<void>
```

**Behavior**:
1. Check `vscode.workspace.workspaceFolders`:
   - If empty/undefined → show info message, return early
2. Initialize database: `DatabaseService.initialize(context.globalStorageUri.fsPath)`
   - On failure → show error message, return early
3. Ensure project: `ensureProject(DatabaseService.client, workspaceFolders)`
   - On failure → show error message, return early
4. Register database cleanup disposable on `context.subscriptions`
5. Register commands via `registerAllCommands(context)`
6. Create providers with `(extensionUri, db, project)` and register them
7. Register remaining commands that depend on providers

### deactivate

```
deactivate(): void
```

**Behavior**: Empty — cleanup handled by disposable pushed to `context.subscriptions`.

---

## Provider Constructor Changes

### FindingsPanelManager

```
Before: constructor(extensionUri: Uri)
After:  constructor(extensionUri: Uri, db: PrismaClient, project: Project)
```

New parameters stored as private readonly fields. Internal logic unchanged (mock data stays until Spec 6).

### SidebarWebviewProvider

```
Before: constructor(extensionUri: Uri)
After:  constructor(extensionUri: Uri, db: PrismaClient, project: Project)
```

Same pattern as FindingsPanelManager.

### ScanTreeProvider

```
Before: constructor()
After:  constructor(db: PrismaClient, project: Project)
```

Same pattern. No `extensionUri` needed (uses VS Code TreeDataProvider API).

---

## Invariants

- `ensureProject()` is idempotent — calling it N times for the same workspace produces exactly 1 Project record
- Database initialization always completes before any provider or command registration
- Database cleanup always runs on extension deactivation (via `context.subscriptions` disposable)
- Extension never crashes on missing workspace or database failure — graceful degradation with user-visible messages
- Providers receive initialized `db` and `project` — they never need to handle null/undefined for these dependencies
