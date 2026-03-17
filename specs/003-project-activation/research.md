# Research: Project Lifecycle & Activation

**Feature**: 003-project-activation
**Date**: 2026-03-16

---

## R1: Current Extension Activation Pattern

**Decision**: Convert `activate()` from synchronous to async, adding database initialization and project lifecycle before provider/command registration.

**Rationale**: The current `extension.ts:activate()` is synchronous, creates providers with only `extensionUri`, and uses mock data. The technical design (Section 3.1) specifies an async pattern: `DatabaseService.initialize(context.globalStorageUri.fsPath)` → `ensureProject(db, workspaceFolders)` → pass `db` + `project` to providers. The current empty `deactivate()` must register cleanup via `context.subscriptions`.

**Current state**:
- `activate()` is sync, returns void
- Providers take only `extensionUri` in constructors
- `deactivate()` is empty — no resource cleanup
- No database initialization, no project record, all mock data

**Alternatives considered**:
- Keep sync activate and lazy-init database on first use — rejected, spec FR-010 requires initialization before any provider registration
- Initialize database in each provider independently — rejected, violates single-instance pattern and wastes resources

---

## R2: DatabaseService API and Integration

**Decision**: Use `DatabaseService.initialize(context.globalStorageUri.fsPath)` for init and `DatabaseService.close()` for cleanup. Access the client via `DatabaseService.client`.

**Rationale**: The DatabaseService from Spec 001 is a static singleton. `initialize()` takes an optional `storagePath` string (not a `vscode.Uri`), so we pass `context.globalStorageUri.fsPath`. The service is idempotent — calling `initialize()` twice returns the existing client. `close()` disconnects Prisma and closes PGLite.

**Key APIs**:
- `DatabaseService.initialize(storagePath?: string): Promise<PrismaClient>` — creates PGLite instance, runs migrations, returns Prisma client
- `DatabaseService.client: PrismaClient` — getter, throws if not initialized
- `DatabaseService.close(): Promise<void>` — disconnects Prisma, closes PGLite, nulls references

**Alternatives considered**:
- Create a new DatabaseService instance per activation — rejected, service is designed as static singleton
- Pass `vscode.Uri` directly — rejected, API takes string path

---

## R3: Provider Dependency Injection Strategy

**Decision**: Add `db` (PrismaClient) and `project` (Project) as constructor parameters to all three providers, alongside existing `extensionUri`. Do not replace mock data logic (deferred to Spec 6).

**Rationale**: The spec explicitly states "Do NOT replace mock data yet (that's Spec 6) — just accept the dependencies." This means constructors gain two new parameters but internal logic remains unchanged. The providers are:
- `FindingsPanelManager(extensionUri)` → `FindingsPanelManager(extensionUri, db, project)`
- `SidebarWebviewProvider(extensionUri)` → `SidebarWebviewProvider(extensionUri, db, project)`
- `ScanTreeProvider()` → `ScanTreeProvider(db, project)`

**Alternatives considered**:
- Use setter methods instead of constructor params — rejected, constructor injection is cleaner and ensures dependencies are available at construction time
- Use a shared context object — rejected, adds unnecessary abstraction (Constitution Principle III: Simplicity First)

---

## R4: ensureProject() Design

**Decision**: Implement `ensureProject()` as a standalone function in `vsix/src/services/project.ts` that uses Prisma's `upsert` for atomic create-or-retrieve semantics.

**Rationale**: The function needs to: (1) query by `rootPath` (unique field on Project model), (2) return existing if found, (3) create new with workspace folder name if not found. Prisma's `upsert()` handles this atomically. The function signature is `ensureProject(db: PrismaClient, workspaceFolders: readonly WorkspaceFolder[] | undefined): Promise<Project>`.

**Key considerations**:
- Project model has `rootPath` as `@unique` — perfect for upsert
- `name` defaults to workspace folder name (`vscode.workspace.workspaceFolders[0].name`)
- Multi-root workspaces: use first folder (FR-009)
- No workspace folder: caller handles this before calling `ensureProject()`

**Alternatives considered**:
- Full `ProjectService` class — rejected, a single function is sufficient (KISS principle)
- Raw SQL query — rejected, Constitution Principle IV requires typed Prisma queries

---

## R5: Error Handling Strategy

**Decision**: Wrap the entire activation sequence in try/catch. Database failure shows an error message and returns early (graceful degradation). No-workspace shows an info message and returns early.

**Rationale**: The spec defines two failure modes:
1. **No workspace folder** (US3, FR-005): Show informational message, do not crash. Check `vscode.workspace.workspaceFolders` before any database work.
2. **Database initialization failure** (US4, FR-006): Show error message, do not crash. Catch errors from `DatabaseService.initialize()` or `ensureProject()`.

In both cases, the extension does not register providers or commands that depend on database/project. The user can still use other VS Code features.

**Alternatives considered**:
- Register providers anyway and let them handle missing dependencies — rejected, providers would need null checks everywhere
- Show error dialog (modal) — rejected, spec says "informational message" for no-workspace, "error message" for DB failure; both non-blocking

---

## R6: Disposable Pattern for Database Cleanup

**Decision**: Create a `vscode.Disposable` that calls `DatabaseService.close()` and push it to `context.subscriptions`.

**Rationale**: Constitution Principle I states "Every disposable MUST be pushed to `context.subscriptions`." VS Code automatically calls `dispose()` on all subscriptions when the extension deactivates. This replaces the need for explicit `deactivate()` logic.

**Implementation**:
```typescript
context.subscriptions.push(new vscode.Disposable(() => DatabaseService.close()));
```

**Alternatives considered**:
- Put cleanup in `deactivate()` directly — rejected, Constitution says use `context.subscriptions`; the disposable pattern is also more robust (VS Code guarantees cleanup)
- Don't close at all (let process exit handle it) — rejected, spec FR-007 requires explicit cleanup

---

## R7: Activation Event Compatibility

**Decision**: Keep the current `onView:ashWorkbench.mainView` activation event. The async activate() is fully compatible.

**Rationale**: VS Code activation events support async `activate()` functions — the extension host awaits the returned promise. The `onView` event triggers when the sidebar is first made visible, which is the right time to initialize the database and project. No change to `package.json` activation events is needed.

**Alternatives considered**:
- Add `onStartupFinished` for eager activation — rejected, lazy activation is better for performance
- Add `workspaceContains` event — rejected, not needed since the sidebar view triggers activation
