# Quickstart: Project Lifecycle & Activation

**Feature**: 003-project-activation

---

## What This Builds

Automatic project lifecycle management on extension activation. When the extension activates, it initializes the database, ensures a Project record exists for the current workspace folder, and wires both the database client and project into all providers.

## Files

| File | Action | Purpose |
|------|--------|---------|
| `vsix/src/services/project.ts` | Create | `ensureProject(db, workspaceFolders)` — upsert Project by workspace path |
| `vsix/src/extension.ts` | Modify | Async activate: DB init → ensureProject → wire providers → register cleanup |
| `vsix/src/providers/findingsPanelManager.ts` | Modify | Accept `db` and `project` in constructor |
| `vsix/src/providers/sidebarWebviewProvider.ts` | Modify | Accept `db` and `project` in constructor |
| `vsix/src/providers/scanTreeProvider.ts` | Modify | Accept `db` and `project` in constructor |
| `vsix/src/test/unit/project.test.ts` | Create | Unit tests for `ensureProject()` |

## Key Commands

```bash
cd workbench/vsix

# Compile
npm run compile

# Run just project service tests
npx mocha out/test/unit/project.test.js

# Run all unit tests
npm run test:unit

# Lint
npm run lint
```

## Architecture

```
VS Code Activation Event (onView:ashWorkbench.mainView)
        │
        ▼
  activate(context)
        │
        ├── No workspace? → vscode.window.showInformationMessage() → return
        │
        ├── DatabaseService.initialize(context.globalStorageUri.fsPath)
        │     └── Failure? → vscode.window.showErrorMessage() → return
        │
        ├── ensureProject(db, workspaceFolders)
        │     └── Prisma upsert by rootPath
        │
        ├── context.subscriptions.push(Disposable → DatabaseService.close())
        │
        └── Register providers + commands (with db + project)
              ├── ScanTreeProvider(db, project)
              ├── FindingsPanelManager(extensionUri, db, project)
              └── SidebarWebviewProvider(extensionUri, db, project)
```

## Dependency Flow

```
DatabaseService (Spec 001)
        │
        ▼
  PrismaClient ──► ensureProject() ──► Project record
        │                                    │
        └──────────┬─────────────────────────┘
                   ▼
          Providers + Commands
          (receive both db and project)
```

## Error Handling Quick Reference

| Scenario | Message Type | User Experience |
|----------|-------------|-----------------|
| No workspace folder | Info message | "Open a folder to use ASH Workbench" |
| Database init fails | Error message | "ASH Workbench: Failed to initialize database" |
| Project creation fails | Error message | "ASH Workbench: Failed to set up project" |
