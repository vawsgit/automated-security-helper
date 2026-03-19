# Implementation Plan: Scan Root Setting

**Branch**: `012-scan-root-setting` | **Date**: 2026-03-19 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/012-scan-root-setting/spec.md`

## Summary

Add an `ashWorkbench.scanRoot` VS Code setting that scopes all ASH Workbench operations to a single root directory. The setting defaults to empty (use workspace root), supports custom absolute paths with validation and fallback, propagates changes in real time to all UI surfaces, and filters all aggregate queries by scan target path proximity. The "Scan Folder..." context menu command and ScanTargetPicker component are removed — the scan root setting is the sole mechanism for controlling scan scope.

## Technical Context

**Language/Version**: TypeScript / ES2022, Node16 modules, strict mode
**Primary Dependencies**: VS Code Extension API ^1.110.0, Prisma ORM (PGLite), React 19, Vite 8, Tailwind v4, ShadCN/ui
**Storage**: PGLite (WASM PostgreSQL) with Prisma ORM — no schema changes for this feature
**Testing**: Mocha (unit, Node.js) + `@vscode/test-electron` (integration); sinon for mocking
**Target Platform**: VS Code desktop (all OS)
**Project Type**: VS Code extension (monorepo: vsix/ + webview/ + docs/)
**Performance Goals**: Setting change → full UI refresh within 2 seconds (SC-003)
**Constraints**: No schema changes, no data migration, no external dependencies
**Scale/Scope**: Single-user VS Code extension; scan history typically <100 scans

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. VS Code Native | PASS | Uses `vscode.workspace.getConfiguration`, `onDidChangeConfiguration`, `contributes.configuration` — all native APIs. No external services. |
| II. Extension Host Owns State | PASS | Scan root resolved in extension host (ScanRootService). WebView receives the resolved root via `stateUpdate` message. No client-side resolution. |
| III. Ship Fast / Simplicity First | PASS | Single service class, query-time filtering, direct function calls for change propagation. No EventEmitter, no abstraction layers. |
| IV. Typed Contracts at Boundaries | PASS | Message protocol updated in both `vsix/src/models/messages.ts` and `webview/src/types/messages.ts`. `startScan` payload simplified. `stateUpdate` gains `scanRoot` field. |
| V. Theme Integration | N/A | No visual/styling changes. |
| VI. Security by Default | PASS | Scan root is a local filesystem path from VS Code settings. Validated with `fs.stat` before use. No command injection risk (path used in Prisma queries, not shell commands). |

**Gate result**: PASS — no violations.

## Project Structure

### Documentation (this feature)

```text
specs/012-scan-root-setting/
├── plan.md              # This file
├── spec.md              # Feature specification
├── research.md          # Phase 0: research decisions
├── data-model.md        # Phase 1: data model impact
├── quickstart.md        # Phase 1: implementation quickstart
├── contracts/           # Phase 1: message protocol changes
│   └── message-protocol-changes.md
├── checklists/
│   └── requirements.md  # Spec quality checklist
└── tasks.md             # Phase 2 output (via /speckit.tasks)
```

### Source Code (repository root)

```text
workbench/
├── vsix/
│   ├── package.json                          # + ashWorkbench.scanRoot setting
│   │                                         # - scanFolder command & menu
│   ├── src/
│   │   ├── extension.ts                      # Wire ScanRootService, config listener
│   │   ├── services/
│   │   │   ├── scanRoot.ts                   # NEW — ScanRootService
│   │   │   ├── findings.ts                   # + scanRoot param on aggregate methods
│   │   │   └── scanner.ts                    # (minor — accepts scan root from caller)
│   │   ├── providers/
│   │   │   ├── scanTreeProvider.ts           # + scan root filtering
│   │   │   ├── findingsPanelManager.ts       # + ScanRootService dependency
│   │   │   └── sidebarWebviewProvider.ts     # + ScanRootService dependency
│   │   ├── commands/
│   │   │   └── scanCommands.ts              # - scanFolder handler
│   │   └── models/
│   │       └── messages.ts                   # Protocol changes
│   └── prisma/
│       └── schema.prisma                     # (unchanged)
└── webview/
    └── src/
        ├── types/
        │   └── messages.ts                   # Protocol changes (mirror)
        └── components/
            ├── ScanTargetPicker.tsx           # DELETED
            ├── DashboardView.tsx             # - ScanTargetPicker import
            └── ScanHistoryView.tsx           # - ScanTargetPicker import
```

**Structure Decision**: Existing monorepo layout (vsix/ + webview/). One new file created (`scanRoot.ts`), one file deleted (`ScanTargetPicker.tsx`). All other changes are modifications to existing files.

## Phase 0: Research

Complete. See [research.md](./research.md) for all decisions:

1. **ScanRootService**: Domain service class with constructor-injected dependencies (not utility service)
2. **Data filtering**: Prisma `startsWith` on `ScanTarget.path` at query time
3. **Config propagation**: Single `onDidChangeConfiguration` listener in extension.ts, direct cascade calls
4. **ScanFolder removal**: Remove command, menu, handler, and ScanTargetPicker component
5. **Subdirectory matching**: `path === root || path.startsWith(root + sep)`
6. **startScan simplification**: Drop `targetPath` payload from WebView message

## Phase 1: Design

### ScanRootService (new: `vsix/src/services/scanRoot.ts`)

```typescript
export class ScanRootService {
  private effectiveScanRoot: string;

  constructor(
    private readonly workspaceRoot: string,  // first workspace folder fsPath
  );

  /** Resolve and cache the effective scan root from settings */
  refresh(): void;

  /** Get the current effective scan root (cached) */
  getEffectiveScanRoot(): string;

  /** Check if a path is within the current scan root scope */
  isInScope(targetPath: string): boolean;

  /** Build a Prisma where-clause fragment for ScanTarget.path filtering */
  buildPathFilter(): { OR: Array<{ path: string } | { path: { startsWith: string } }> };
}
```

**Key behaviors**:
- `refresh()` reads `ashWorkbench.scanRoot` from VS Code config, validates with `fs.statSync`, falls back to `workspaceRoot` if invalid (with warning notification)
- `getEffectiveScanRoot()` returns cached value (synchronous, no I/O)
- `buildPathFilter()` returns a Prisma-compatible filter: `{ OR: [{ path: root }, { path: { startsWith: root + sep } }] }`
- `isInScope()` performs the same check in JS for non-query contexts

### FindingsService Changes

Three methods gain a `scanRoot` parameter:

```typescript
// Before:
getScanSummaries(): Promise<ScanSummary[]>
getScanTargets(): Promise<ScanTarget[]>
getSummary(): Promise<DispositionSummary>

// After:
getScanSummaries(scanRootFilter?: { OR: ... }): Promise<ScanSummary[]>
getScanTargets(scanRootFilter?: { OR: ... }): Promise<ScanTarget[]>
getSummary(scanRootFilter?: { OR: ... }): Promise<DispositionSummary>
```

The filter is optional to maintain backward compatibility (tests can call without it). When provided, it's merged into the Prisma `where` clause on `scanTarget` relation or `path` field.

### Extension Activation Changes

After existing service creation, add:

```
1. Create ScanRootService(workspaceRoot)
2. Call scanRootService.refresh()
3. Pass scanRootService to providers via setter methods
4. Register onDidChangeConfiguration listener:
   - Check if 'ashWorkbench.scanRoot' changed
   - Call scanRootService.refresh()
   - Call findingsPanelManager.postStateUpdate()
   - Call sidebarWebviewProvider.queryStateAndPost()
   - Call scanTreeProvider.refresh()
5. Push config listener disposable to context.subscriptions
```

### Message Protocol Changes

See [contracts/message-protocol-changes.md](./contracts/message-protocol-changes.md):
- `startScan` message: remove `payload` (extension host resolves target from ScanRootService)
- `stateUpdate` message: add `scanRoot: string` to payload

### Removal Checklist

| Item | File | Action |
|------|------|--------|
| `ashWorkbench.scanFolder` command | `vsix/package.json` contributes.commands | Delete entry |
| Explorer context menu | `vsix/package.json` contributes.menus.explorer/context | Delete entry |
| `scanFolder` handler | `vsix/src/commands/scanCommands.ts` | Delete registration block |
| `ScanTargetPicker.tsx` | `webview/src/components/` | Delete file |
| ScanTargetPicker import | `webview/src/components/DashboardView.tsx` | Remove import + JSX usage |
| ScanTargetPicker import | `webview/src/components/ScanHistoryView.tsx` | Remove import + JSX usage |

## Constitution Re-Check (Post-Design)

| Principle | Status | Notes |
|-----------|--------|-------|
| I. VS Code Native | PASS | Setting in `contributes.configuration`. Config listener via `onDidChangeConfiguration`. Warning via `vscode.window.showWarningMessage`. All native. |
| II. Extension Host Owns State | PASS | ScanRootService lives in extension host. WebView receives `scanRoot` via message, doesn't resolve it. `startScan` no longer carries user-selected path. |
| III. Ship Fast / Simplicity First | PASS | One new file, one deleted file. Query-time filtering with optional param (backward compatible). Direct cascade calls, no event system. |
| IV. Typed Contracts at Boundaries | PASS | Both message type files updated. `buildPathFilter()` returns typed Prisma fragment. Optional param keeps existing call sites working. |
| V. Theme Integration | N/A | No visual changes. |
| VI. Security by Default | PASS | `fs.statSync` validation on configured path. Path used in Prisma queries (parameterized, no injection). No user input in shell commands. |

**Post-design gate**: PASS — no violations, no complexity tracking entries needed.

## Complexity Tracking

No violations to justify. All changes follow existing patterns in the codebase.
