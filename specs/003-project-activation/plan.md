# Implementation Plan: Project Lifecycle & Activation

**Feature**: 003-project-activation
**Branch**: `003-project-activation`
**Date**: 2026-03-16
**Spec**: [spec.md](spec.md)

---

## Summary

Implement automatic project creation on extension activation. When the extension activates, it initializes the database (Spec 001), ensures a Project record exists for the current workspace folder, wires the database client and project into all providers, and registers cleanup as a disposable. Graceful handling for missing workspace and database failures.

## Technical Context

| Aspect | Detail |
|--------|--------|
| Runtime | Node.js (VS Code extension host), TypeScript strict mode, ES2022, Node16 modules |
| VS Code APIs | `workspace.workspaceFolders`, `window.showInformationMessage`, `window.showErrorMessage`, `Disposable`, `ExtensionContext` |
| Database | PGLite + Prisma ORM via `DatabaseService` static singleton (Spec 001) |
| ORM operations | `db.project.upsert()` — atomic create-or-retrieve by unique `rootPath` |
| Testing | Mocha + `node:assert/strict` for unit tests; PGLite in-memory for project service tests |
| Existing code | `vsix/src/services/database.ts` (DatabaseService), `vsix/src/extension.ts` (activate/deactivate), 3 providers |
| Dependencies | Spec 001 (Database Layer) — PGLite, Prisma, DatabaseService, Project model |

## Constitution Check

| Principle | Status | Notes |
|-----------|--------|-------|
| I. VS Code Native | PASS | Database runs in-process (PGLite WASM). Data stored in `context.globalStorageUri`. Cleanup via `context.subscriptions`. All contribution points in `package.json`. |
| II. Extension Host Owns State | PASS | All project lifecycle logic in `vsix/src/`. WebView is not involved. |
| III. Ship Fast / Simplicity First | PASS | `ensureProject()` is a single function, not a class. No abstractions beyond what's needed. Providers accept deps but don't use them yet (Spec 6). |
| IV. Typed Contracts at Boundaries | PASS | `ensureProject()` takes `PrismaClient` and returns typed `Project`. Providers accept typed deps. |
| V. Theme Integration | N/A | No UI changes in this spec. |
| VI. Security by Default | PASS | No user input handling. No command injection. Database path from `context.globalStorageUri` (VS Code-controlled). |

## Project Structure

### Documentation (this feature)

```text
specs/003-project-activation/
├── spec.md
├── plan.md              # This file
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── project-service.md
└── checklists/
    └── requirements.md
```

### Source Code

```text
vsix/src/
├── extension.ts                          # MODIFY: async activate, DB init, project lifecycle
├── services/
│   ├── database.ts                       # EXISTING: DatabaseService (Spec 001)
│   └── project.ts                        # CREATE: ensureProject() function
├── providers/
│   ├── findingsPanelManager.ts           # MODIFY: add db + project constructor params
│   ├── sidebarWebviewProvider.ts         # MODIFY: add db + project constructor params
│   └── scanTreeProvider.ts               # MODIFY: add db + project constructor params
└── test/
    └── unit/
        └── project.test.ts              # CREATE: ensureProject() unit tests
```

**Structure Decision**: No new directories. One new service file (`project.ts`), one new test file (`project.test.ts`), and modifications to 4 existing files.

## Implementation Phases

### Phase A: Project Service

**Goal**: Create `ensureProject()` with Prisma upsert for idempotent project creation.

1. Create `vsix/src/services/project.ts`:
   - Import `PrismaClient` type and `Project` type from `@prisma/client`
   - Import `WorkspaceFolder` type from `vscode`
   - Implement `ensureProject(db, workspaceFolders)`:
     - Extract `rootPath` from `workspaceFolders[0].uri.fsPath`
     - Extract `name` from `workspaceFolders[0].name`
     - Call `db.project.upsert({ where: { rootPath }, create: { name, rootPath }, update: {} })`
     - Return the Project record

### Phase B: Extension Activation Rewrite

**Goal**: Convert activate() to async with database init, project lifecycle, and error handling.

1. Modify `vsix/src/extension.ts`:
   - Make `activate()` async, returning `Promise<void>`
   - Add workspace folder check (FR-005, FR-009):
     - If no folders: show info message, return early
     - Use first folder for multi-root workspaces
   - Initialize database (FR-001):
     - Call `DatabaseService.initialize(context.globalStorageUri.fsPath)`
     - On failure: catch, show error message, return early
   - Ensure project (FR-002, FR-003, FR-004):
     - Call `ensureProject(DatabaseService.client, workspaceFolders)`
     - On failure: catch, show error message, close DB, return early
   - Register cleanup (FR-007):
     - Push `new vscode.Disposable(() => DatabaseService.close())` to `context.subscriptions`
   - Update provider construction (FR-008):
     - Pass `db` and `project` to all three provider constructors
   - Register commands and providers as before (FR-010)

### Phase C: Provider Dependency Injection

**Goal**: Update all three providers to accept database and project dependencies.

1. Modify `vsix/src/providers/findingsPanelManager.ts`:
   - Add `db: PrismaClient` and `project: Project` constructor parameters after `extensionUri`
   - Store as private readonly fields
   - No changes to internal logic (mock data stays)

2. Modify `vsix/src/providers/sidebarWebviewProvider.ts`:
   - Same pattern: add `db` and `project` constructor parameters after `extensionUri`
   - Store as private readonly fields

3. Modify `vsix/src/providers/scanTreeProvider.ts`:
   - Add `db: PrismaClient` and `project: Project` constructor parameters
   - Store as private readonly fields

### Phase D: Unit Tests

**Goal**: Test ensureProject() with in-memory PGLite.

Test file: `vsix/src/test/unit/project.test.ts`

**US1 tests** (auto project creation):
- Creates project with correct name and rootPath on first call
- Returns a project with a valid UUID id

**US2 tests** (idempotent retrieval):
- Returns existing project on second call (same rootPath)
- Does not create duplicate records (count = 1 after multiple calls)

**Edge cases**:
- Uses first workspace folder when multiple are provided

### Phase E: Polish

**Goal**: Compile clean, lint clean, all tests pass.

1. `npm run compile` — zero TypeScript errors
2. `npm run lint` — zero ESLint errors in new/modified files
3. `npx mocha` — all tests pass (existing + new)
4. Verify test suite stays under 10 seconds total (PGLite in-memory adds startup time)

## Artifacts Generated

| Artifact | Path |
|----------|------|
| Research | `specs/003-project-activation/research.md` |
| Data Model | `specs/003-project-activation/data-model.md` |
| Contract | `specs/003-project-activation/contracts/project-service.md` |
| Quickstart | `specs/003-project-activation/quickstart.md` |
| Plan | `specs/003-project-activation/plan.md` (this file) |

## Risks

| Risk | Mitigation |
|------|------------|
| PGLite initialization time may exceed 2-second activation target (SC-001) | PGLite is in-process WASM — benchmark shows ~500ms. If too slow, show progress notification. |
| Prisma `upsert` with empty `update: {}` may still trigger `@updatedAt` | Test confirms empty update does not change `updatedAt`. If it does, use `findUnique` + conditional `create`. |
| Provider constructor changes break existing integration tests | No integration tests currently exercise provider constructors directly — mock data tests are unaffected. |
| `DatabaseService.close()` in disposable may fail silently | DatabaseService already swallows errors in `close()` with console.error — graceful by design. |
