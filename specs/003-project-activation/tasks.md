# Tasks: Project Lifecycle & Activation

**Input**: Design documents from `/specs/003-project-activation/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/project-service.md, quickstart.md

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- Extension host code: `vsix/src/`
- Tests: `vsix/src/test/unit/`
- Services: `vsix/src/services/`
- Providers: `vsix/src/providers/`

---

## Phase 1: Setup

**Purpose**: No new project structure needed — this feature adds to existing `vsix/` codebase.

- [x] T001 Verify Spec 001 (Database Layer) is merged and `vsix/src/services/database.ts` exists with `DatabaseService` class
- [x] T002 Verify Prisma schema has Project model with `rootPath @unique` in `vsix/prisma/schema.prisma`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Create the project service that all user stories depend on

- [x] T003 Create `ensureProject()` function in `vsix/src/services/project.ts` — import PrismaClient and Project types from `@prisma/client`, import WorkspaceFolder from `vscode`; implement upsert by `rootPath` using `db.project.upsert({ where: { rootPath }, create: { name, rootPath }, update: {} })`; export the function

**Checkpoint**: Foundation ready — `ensureProject()` available for activate() integration

---

## Phase 3: User Story 1 — Automatic Project Creation on First Activation (Priority: P1)

**Goal**: When a user opens a workspace folder and the extension activates for the first time, the system automatically creates a project record associated with that workspace.

**Independent Test**: Open a workspace folder for the first time, verify a project record exists with the correct name and path.

### Implementation for User Story 1

- [x] T004 [US1] Rewrite `activate()` in `vsix/src/extension.ts` to be async — add workspace folder check at the top: if `vscode.workspace.workspaceFolders` is undefined or empty, show `vscode.window.showInformationMessage('ASH Workbench requires a workspace folder. Please open a folder to get started.')` and return early
- [x] T005 [US1] Add database initialization to `activate()` in `vsix/src/extension.ts` — wrap `await DatabaseService.initialize(context.globalStorageUri.fsPath)` in try/catch; on failure, show `vscode.window.showErrorMessage('ASH Workbench: Failed to initialize database.')` and return early
- [x] T006 [US1] Add project lifecycle to `activate()` in `vsix/src/extension.ts` — call `const project = await ensureProject(DatabaseService.client, vscode.workspace.workspaceFolders)` after DB init; on failure, show error message, call `await DatabaseService.close()`, and return early
- [x] T007 [US1] Register database cleanup disposable in `activate()` in `vsix/src/extension.ts` — push `new vscode.Disposable(() => { DatabaseService.close(); })` to `context.subscriptions` after successful DB + project init

**Checkpoint**: Extension creates a project on first activation with a workspace open. Database is initialized and cleaned up.

---

## Phase 4: User Story 2 — Idempotent Project Retrieval on Subsequent Activations (Priority: P1)

**Goal**: When the extension activates in a workspace that already has a project record, it retrieves the existing project instead of creating a duplicate.

**Independent Test**: Activate the extension twice in the same workspace, verify only one project record exists.

### Implementation for User Story 2

- [x] T008 [US2] Verify idempotency of `ensureProject()` — the Prisma `upsert` in `vsix/src/services/project.ts` already handles this (create if not found, no-op update if found); no code changes needed, verify by reading the implementation from T003

**Checkpoint**: Idempotent retrieval is inherent in the upsert design. Validated by unit tests in Phase 7.

---

## Phase 5: User Story 3 — Graceful Handling When No Workspace Is Open (Priority: P1)

**Goal**: When the extension activates without a workspace folder open, the extension shows an informational message guiding the user to open a folder.

**Independent Test**: Activate the extension with no workspace folder open, verify an informational message is shown and no errors occur.

### Implementation for User Story 3

- [x] T009 [US3] Verify no-workspace handling in `vsix/src/extension.ts` — already implemented in T004 (workspace folder check at top of activate); confirm the info message is shown and function returns early without registering any providers or commands

**Checkpoint**: No-workspace case handled gracefully via early return with info message.

---

## Phase 6: User Story 4 — Graceful Handling of Database Initialization Failure (Priority: P2)

**Goal**: If the database cannot be initialized, the extension shows a clear error message and does not crash.

**Independent Test**: Simulate a database initialization failure, verify an error message is shown and the extension does not crash.

### Implementation for User Story 4

- [x] T010 [US4] Verify database failure handling in `vsix/src/extension.ts` — already implemented in T005 (try/catch around DatabaseService.initialize); confirm the error message is shown and function returns early without crashing

**Checkpoint**: Database failure case handled via try/catch with error message.

---

## Phase 7: User Story 5 — Clean Resource Shutdown (Priority: P1)

**Goal**: When the extension deactivates, all database connections and resources are properly closed.

**Independent Test**: Activate then deactivate the extension, verify database connections are closed and no file locks remain.

### Implementation for User Story 5

- [x] T011 [US5] Verify cleanup disposable in `vsix/src/extension.ts` — already implemented in T007 (Disposable pushed to context.subscriptions calling DatabaseService.close); confirm `deactivate()` remains empty (cleanup handled by disposable)

**Checkpoint**: Shutdown cleanup handled via disposable pattern.

---

## Phase 8: Provider Dependency Injection

**Purpose**: Wire db and project into all providers (FR-008)

- [x] T012 [P] Modify `FindingsPanelManager` constructor in `vsix/src/providers/findingsPanelManager.ts` — add `private readonly db: PrismaClient` and `private readonly project: Project` params after `extensionUri`; import types from `@prisma/client`; no changes to internal logic (mock data stays until Spec 6)
- [x] T013 [P] Modify `SidebarWebviewProvider` constructor in `vsix/src/providers/sidebarWebviewProvider.ts` — add `private readonly db: PrismaClient` and `private readonly project: Project` params after `extensionUri`; import types from `@prisma/client`; no changes to internal logic
- [x] T014 [P] Modify `ScanTreeProvider` constructor in `vsix/src/providers/scanTreeProvider.ts` — add `private readonly db: PrismaClient` and `private readonly project: Project` params (no extensionUri needed); import types from `@prisma/client`; no changes to internal logic
- [x] T015 Update provider instantiation in `vsix/src/extension.ts` — pass `DatabaseService.client` and `project` to all three provider constructors: `new ScanTreeProvider(db, project)`, `new FindingsPanelManager(context.extensionUri, db, project)`, `new SidebarWebviewProvider(context.extensionUri, db, project)`

**Checkpoint**: All providers accept db and project dependencies. Extension compiles.

---

## Phase 9: Unit Tests

**Purpose**: Verify ensureProject() works correctly with in-memory PGLite

- [x] T016 Create unit test file `vsix/src/test/unit/project.test.ts` — import `DatabaseService` from `../../services/database`; import `ensureProject` from `../../services/project`; setup: call `DatabaseService.initialize()` (no storagePath = in-memory) in `before()`; teardown: call `DatabaseService.close()` in `after()`
- [x] T017 Add test: creates project with correct name and rootPath on first call in `vsix/src/test/unit/project.test.ts` — create mock WorkspaceFolder objects with `uri.fsPath` and `name`; call `ensureProject(DatabaseService.client, folders)`; assert returned project has matching `name` and `rootPath`
- [x] T018 Add test: returns a project with valid UUID id in `vsix/src/test/unit/project.test.ts` — assert `project.id` is a non-empty string matching UUID format
- [x] T019 Add test: returns existing project on second call (idempotent) in `vsix/src/test/unit/project.test.ts` — call `ensureProject` twice with same folder; assert both return same `id`; query `db.project.count()` and assert count is 1
- [x] T020 Add test: uses first workspace folder when multiple provided in `vsix/src/test/unit/project.test.ts` — pass array with 2 folders; assert project uses first folder's name and rootPath

**Checkpoint**: All unit tests pass with `npx mocha out/test/unit/project.test.js`

---

## Phase 10: Polish & Cross-Cutting Concerns

**Purpose**: Compile clean, lint clean, all tests pass

- [x] T021 Run `npm run compile` in `vsix/` and fix any TypeScript errors across all modified files
- [x] T022 Run `npm run lint` in `vsix/` and fix any ESLint errors in new/modified files
- [x] T023 Run `npx mocha out/test/unit/project.test.js` and verify all project tests pass
- [x] T024 Run `npm run test:unit` in `vsix/` and verify all existing tests still pass (SARIF parser tests, etc.)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — verification only
- **Foundational (Phase 2)**: Depends on Setup — creates `ensureProject()`
- **US1 (Phase 3)**: Depends on Foundational — rewrites `activate()` with DB init + project lifecycle
- **US2 (Phase 4)**: Depends on US1 — verification of idempotent upsert (no new code)
- **US3 (Phase 5)**: Depends on US1 — verification of no-workspace guard (no new code)
- **US4 (Phase 6)**: Depends on US1 — verification of DB failure try/catch (no new code)
- **US5 (Phase 7)**: Depends on US1 — verification of cleanup disposable (no new code)
- **Provider DI (Phase 8)**: Depends on US1 — updates constructor signatures and activate() wiring
- **Unit Tests (Phase 9)**: Depends on Foundational — tests ensureProject() with in-memory PGLite
- **Polish (Phase 10)**: Depends on all previous phases

### User Story Dependencies

- **US1 (P1)**: Core implementation — all other stories are subsets of the activate() rewrite
- **US2 (P1)**: Inherent in `ensureProject()` upsert design — verified, not separately coded
- **US3 (P1)**: Inherent in workspace folder check — verified, not separately coded
- **US4 (P2)**: Inherent in try/catch error handling — verified, not separately coded
- **US5 (P1)**: Inherent in disposable cleanup pattern — verified, not separately coded

### Within Activate Rewrite (US1)

```
T004 (workspace check) → T005 (DB init) → T006 (project lifecycle) → T007 (cleanup disposable)
```

These are sequential changes to the same function in `extension.ts`.

### Parallel Opportunities

- **T012, T013, T014**: Provider modifications can run in parallel (different files)
- **T016-T020**: Unit tests can be written in parallel with provider DI (Phase 8)
- **T021-T024**: Polish tasks are sequential (compile → lint → test)

---

## Parallel Example: Provider DI

```bash
# Launch all provider modifications together (different files):
Task: "Modify FindingsPanelManager constructor in vsix/src/providers/findingsPanelManager.ts"
Task: "Modify SidebarWebviewProvider constructor in vsix/src/providers/sidebarWebviewProvider.ts"
Task: "Modify ScanTreeProvider constructor in vsix/src/providers/scanTreeProvider.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 + Foundational)

1. Complete Phase 1: Setup (verify prerequisites)
2. Complete Phase 2: Foundational (create `ensureProject()`)
3. Complete Phase 3: US1 (rewrite `activate()`)
4. **STOP and VALIDATE**: Compile and manually test — open workspace, check console for `[ASH]` logs
5. Complete Phase 8: Provider DI (wire deps into constructors)
6. Complete Phase 9: Unit tests
7. Complete Phase 10: Polish

### Incremental Delivery

1. Setup + Foundational → `ensureProject()` ready
2. US1 → Activate rewrite with DB + project → Compile and test (MVP!)
3. US2-US5 → Verification passes (inherent in US1 implementation)
4. Provider DI → All providers accept deps → Compile
5. Unit Tests → Automated verification
6. Polish → Clean build

---

## Notes

- US2-US5 are verification tasks (not separate code), because the activate() rewrite in US1 covers all scenarios in one function
- Provider DI (Phase 8) does NOT change provider behavior — mock data stays until Spec 6
- Unit tests use in-memory PGLite (no storagePath) for isolation and speed
- The `deactivate()` export remains empty — cleanup is via `context.subscriptions` disposable
