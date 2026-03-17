# Feature Specification: Project Lifecycle & Activation

**Feature Branch**: `003-project-activation`
**Created**: 2026-03-16
**Status**: Draft
**Dependencies**: Spec 1 (Database Layer)

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Automatic Project Creation on First Activation (Priority: P1)

When a user opens a workspace folder and the extension activates for the first time, the system automatically creates a project record associated with that workspace. The user does not need to take any manual setup steps — the project is ready for scanning immediately.

**Why this priority**: This is the entry point for all user data. Without a project record, no scans, findings, or triage can be stored. Every downstream feature depends on this.

**Independent Test**: Open a workspace folder for the first time, verify a project record exists with the correct name and path.

**Acceptance Scenarios**:

1. **Given** a workspace folder is open and no project record exists for it, **When** the extension activates, **Then** a new project record is created with the workspace folder name and path.
2. **Given** the extension has never been activated before (first install), **When** a user opens a workspace and the extension activates, **Then** the database is initialized, a project is created, and the extension is fully functional — all within the normal activation time.

---

### User Story 2 - Idempotent Project Retrieval on Subsequent Activations (Priority: P1)

When the extension activates in a workspace that already has a project record, it retrieves the existing project instead of creating a duplicate. This ensures continuity of scan history, findings, and triage decisions across sessions.

**Why this priority**: Without idempotency, every activation would create a new project, losing all previous scan data. This is critical for data integrity.

**Independent Test**: Activate the extension twice in the same workspace, verify only one project record exists.

**Acceptance Scenarios**:

1. **Given** a project record already exists for the current workspace path, **When** the extension activates, **Then** the existing project is retrieved and no new project is created.
2. **Given** a project was created in a previous session, **When** the user reopens the workspace and the extension activates, **Then** the same project record is returned with all its associated data intact.

---

### User Story 3 - Graceful Handling When No Workspace Is Open (Priority: P1)

When the extension activates without a workspace folder open (e.g., the user opened a single file or an empty VS Code window), the extension shows an informational message guiding the user to open a folder. The extension does not crash or show error dialogs.

**Why this priority**: Users should never encounter confusing errors. A clear message explaining what to do is essential for first-time experience.

**Independent Test**: Activate the extension with no workspace folder open, verify an informational message is shown and no errors occur.

**Acceptance Scenarios**:

1. **Given** no workspace folder is open, **When** the extension activates, **Then** an informational message is shown explaining that a workspace folder is needed.
2. **Given** no workspace folder is open, **When** the extension activates, **Then** the extension does not crash, does not show error dialogs, and remains in a safe inactive state.

---

### User Story 4 - Graceful Handling of Database Initialization Failure (Priority: P2)

If the database cannot be initialized (e.g., storage permissions issue, corrupted data directory), the extension shows a clear error message and does not crash. The user can still use other VS Code features — only the ASH Workbench functionality is unavailable.

**Why this priority**: Robustness is important but this is an edge case. Most users will never encounter database initialization failures.

**Independent Test**: Simulate a database initialization failure, verify an error message is shown and the extension does not crash.

**Acceptance Scenarios**:

1. **Given** the database cannot be initialized, **When** the extension activates, **Then** an error message is displayed explaining the issue.
2. **Given** the database initialization fails, **When** the user continues working in VS Code, **Then** other VS Code features are unaffected — only ASH Workbench functionality is unavailable.

---

### User Story 5 - Clean Resource Shutdown (Priority: P1)

When the extension deactivates (VS Code closes or extension is disabled), all database connections and resources are properly closed. No orphaned connections or file locks remain.

**Why this priority**: Resource leaks can cause data corruption or prevent future activations from initializing the database.

**Independent Test**: Activate then deactivate the extension, verify database connections are closed and no file locks remain.

**Acceptance Scenarios**:

1. **Given** the extension is active with an initialized database, **When** the extension deactivates, **Then** the database connection is closed cleanly.
2. **Given** the extension is active, **When** VS Code is closed, **Then** the shutdown handler runs and releases all resources.

---

### Edge Cases

- What happens when the workspace has multiple root folders (multi-root workspace)? The system uses the first workspace folder.
- What happens if the workspace folder path changes (e.g., moved on disk)? A new project is created for the new path; the old one remains in the database.
- What happens if two VS Code windows open the same workspace? Both use the same project record (idempotent by path).
- What happens if the extension is activated before the database service from Spec 1 is available? The activation sequence ensures database initialization happens first.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST initialize persistent storage on extension activation before any other operations.
- **FR-002**: System MUST create a project record when activating in a workspace that has no existing project for that path.
- **FR-003**: System MUST retrieve the existing project record when activating in a workspace that already has one, using the workspace folder path as the unique key.
- **FR-004**: System MUST use the workspace folder name as the default project name when creating a new project.
- **FR-005**: System MUST show an informational message when no workspace folder is open, without crashing or showing errors.
- **FR-006**: System MUST show an error message when database initialization fails, without crashing.
- **FR-007**: System MUST register a shutdown handler that closes the database connection when the extension deactivates.
- **FR-008**: System MUST make the database client and project record available to all providers and command handlers that need them.
- **FR-009**: System MUST use the first workspace folder when multiple root folders are present (multi-root workspace).
- **FR-010**: System MUST complete the activation sequence (storage init + project ensure) before registering any commands or providers that depend on them.

### Key Entities

- **Project**: The workspace-level aggregate root. Created automatically on first activation. Identified uniquely by its root path. Contains name (default: folder name) and timestamps.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: First activation in a new workspace creates exactly one project record and completes within 2 seconds.
- **SC-002**: Subsequent activations in the same workspace retrieve the existing project without creating duplicates — project count remains 1 after 10 activations.
- **SC-003**: Activating without a workspace folder shows a message and completes without errors in under 500 milliseconds.
- **SC-004**: Database initialization failure results in a user-visible message and zero crashes.
- **SC-005**: Extension deactivation closes all resources — zero orphaned connections after shutdown.
- **SC-006**: All providers and command handlers receive the database client and project record they need to function.

## Assumptions

- The extension activates in a VS Code environment with access to the extension storage directory.
- Only one project per workspace folder path is needed (1:1 mapping).
- Multi-root workspaces use the first folder as the project root.
- The database layer from Spec 1 is implemented and available.
- Providers and command handlers currently exist and need to be updated to accept database and project dependencies, but their internal logic is not changing in this spec.

## Scope

### In Scope
- Database initialization on activation
- Automatic project creation / retrieval by workspace path
- Graceful handling of missing workspace and database failures
- Clean resource shutdown on deactivation
- Wiring database client and project into existing providers

### Out of Scope
- Scan execution or finding storage (Spec 4+)
- Project renaming or deletion by the user
- Multi-project support (one project per workspace)
- Replacing mock data in providers with real database queries (Spec 6)
- Project settings or configuration UI
