# Data Model: Project Lifecycle & Activation

**Feature**: 003-project-activation
**Date**: 2026-03-16

---

## Entities

### Project (Existing — from Spec 001)

The workspace-level aggregate root. Created automatically on first activation. Identified uniquely by its root path.

| Field | Type | Required | Default | Source |
|-------|------|----------|---------|--------|
| id | String (UUID) | Yes | Auto-generated | Prisma `@default(uuid())` |
| name | String | Yes | — | `vscode.workspace.workspaceFolders[0].name` |
| rootPath | String (unique) | Yes | — | `vscode.workspace.workspaceFolders[0].uri.fsPath` |
| createdAt | DateTime | Yes | Auto-generated | Prisma `@default(now())` |
| updatedAt | DateTime | Yes | Auto-generated | Prisma `@updatedAt` |

**Relationships**:
- `scanTargets` — One-to-many with ScanTarget
- `scans` — One-to-many with Scan
- `findings` — One-to-many with Finding

**Uniqueness**: `rootPath` is `@unique` — used for idempotent upsert on activation.

**Notes**:
- No new database entities are created in this spec. The Project model already exists from Spec 001.
- This spec's contribution is the service layer that creates/retrieves Project records at activation time.

## State Transitions

### Extension Activation Lifecycle

```
[VS Code starts / Sidebar opens]
        │
        ▼
  ┌─ Check workspace ─┐
  │                    │
  │ No folder open     │ Folder(s) open
  │                    │
  ▼                    ▼
Show info msg    Initialize DatabaseService
Return early           │
                       ├── Failure ──► Show error msg, return early
                       │
                       ▼
                 ensureProject(db, folders)
                       │
                       ├── Existing project found ──► Use it
                       │
                       └── No project ──► Create new project
                                              │
                                              ▼
                                    Register providers + commands
                                    Register DB dispose on subscriptions
```

### ensureProject Decision Tree

```
Input: workspaceFolders[0]
        │
        ▼
  Query: Project where rootPath = folder.uri.fsPath
        │
        ├── Found ──► Return existing Project
        │
        └── Not found ──► Create Project {
                            name: folder.name,
                            rootPath: folder.uri.fsPath
                          }
                          Return new Project
```

## Prisma Operations

### ensureProject — Upsert

```
db.project.upsert({
  where: { rootPath: <folder.uri.fsPath> },
  create: { name: <folder.name>, rootPath: <folder.uri.fsPath> },
  update: {}  // no-op update for existing records
})
```

The `update: {}` ensures idempotency — subsequent activations return the existing record without modification. The `updatedAt` field is managed by Prisma's `@updatedAt` directive and will auto-update on any actual field changes, but an empty update object does not trigger it.
