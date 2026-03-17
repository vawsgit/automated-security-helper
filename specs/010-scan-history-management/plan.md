# Implementation Plan: Scan History & Management

**Branch**: `010-scan-history-management` | **Date**: 2026-03-17 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/010-scan-history-management/spec.md`

## Summary

Route the sidebar tree provider through `FindingsService` instead of direct Prisma calls (constitution compliance), add `deleteScan` service method with cascade deletion, wire deletion through both the tree view context menu (VS Code command) and the WebView message handler, and add a `deleteScan` message type to the typed protocol.

## Technical Context

**Language/Version**: TypeScript / ES2022 target, Node16 modules, strict mode
**Primary Dependencies**: VS Code API (existing), Prisma ORM (existing), FindingsService (Spec 006/008/009)
**Storage**: PGLite (existing) -- no schema changes needed (cascade delete already configured)
**Testing**: Mocha (unit, Node.js) + sinon for mocking. Existing `findings.test.ts`
**Target Platform**: VS Code ^1.110.0
**Project Type**: VS Code extension
**Performance Goals**: Scan history loads within 1 second for up to 100 scans (SC-001)
**Constraints**: No schema changes. Cascade delete is already configured on Finding→Scan relation. Message types need sync between vsix and webview.
**Scale/Scope**: Single user, single project, local database

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Evidence |
|-----------|--------|----------|
| I. VS Code Native | PASS | Tree view via `TreeDataProvider`. Delete command via VS Code command palette + context menu. All in-process. |
| II. Extension Host Owns State | PASS | Deletion runs in extension host service layer. WebView sends action via typed message. Tree view refreshed via `onDidChangeTreeData`. |
| III. Ship Fast / Simplicity First | PASS | One new service method, one new message type, one new VS Code command. No new abstractions. |
| IV. Typed Contracts at Boundaries | PASS | `deleteScan` message type added to discriminated unions in both packages. Command args typed. |
| V. Theme Integration | N/A | No UI changes -- tree view uses VS Code native `ThemeIcon`. |
| VI. Security by Default | PASS | Prisma parameterized delete. Confirmation dialog before destructive action. |

**Gate result**: PASS -- no violations.

## Project Structure

### Documentation (this feature)

```text
specs/010-scan-history-management/
├── plan.md              # This file
├── research.md          # Phase 0 output (confirmatory)
├── data-model.md        # Phase 1 output (no schema changes)
└── quickstart.md        # Phase 1 output (developer quickstart)
```

### Source Code (repository root)

```text
workbench/vsix/
├── src/
│   ├── services/
│   │   └── findings.ts                   # MODIFY: Add deleteScan() method
│   ├── providers/
│   │   ├── scanTreeProvider.ts           # MODIFY: Route through FindingsService, remove direct DB access
│   │   ├── findingsPanelManager.ts       # MODIFY: Add deleteScan handler, add scanTreeProvider reference
│   │   └── sidebarWebviewProvider.ts     # MODIFY: Add deleteScan handler, clean up inline DB fallback
│   ├── models/
│   │   └── messages.ts                   # MODIFY: Add deleteScan message type
│   ├── extension.ts                      # MODIFY: Wire scanTreeProvider setter on findingsPanelManager
│   └── test/unit/
│       └── findings.test.ts              # MODIFY: Add deleteScan test cases
├── package.json                          # MODIFY: Add deleteScan command and context menu
workbench/webview/src/types/
│   └── messages.ts                       # MODIFY: Mirror deleteScan message type
```

**Structure Decision**: No new files. All changes are modifications to existing files. No schema migration needed -- the `onDelete: Cascade` on Finding→Scan is already in the schema.

## Design Decisions

### D1: Route scanTreeProvider Through FindingsService

The `scanTreeProvider.ts` currently calls `this.db.scan.findMany()` directly (line 22). Per the constitution: "Domain queries MUST go through service classes." The existing `FindingsService.getScanSummaries()` method already performs the identical query.

**Change**: Replace `PrismaClient` + `Project` constructor params with a `FindingsService` setter. `getChildren()` calls `this.findingsService.getScanSummaries()`.

**Alternative rejected**: Keeping the direct DB call. Same rationale as Specs 008/009 -- consistency with established convention.

### D2: Add deleteScan() to FindingsService

New method for deleting a scan. Prisma's `onDelete: Cascade` on the Finding→Scan relation handles cascade deletion automatically.

**Signature**: `deleteScan(scanId: string): Promise<void>`

The method deletes the Scan record; Prisma cascades to remove all associated Findings. Returns void (no need to return deleted data).

**Guard**: Check scan status before deletion. Only allow deletion of COMPLETED, FAILED, or CANCELLED scans. Throw if scan is RUNNING.

### D3: Delete via VS Code Command + Context Menu

Register `ashWorkbench.deleteScan` as a VS Code command. Add it to the tree view context menu with a `when` clause: `viewItem =~ /scan\.(completed|failed|cancelled)/`.

This means the delete option only appears for non-running scans (FR-008).

**Confirmation**: Use `vscode.window.showWarningMessage` with "Delete" action button. Standard VS Code pattern for destructive actions.

### D4: Delete via WebView Message

Add `deleteScan` to `WebviewToExtMessage`: `{ type: 'deleteScan'; payload: { scanId: string } }`.

Handler in both `findingsPanelManager.ts` and `sidebarWebviewProvider.ts` calls `FindingsService.deleteScan()`, then refreshes both views.

No new Ext→WebView message needed -- the existing `stateUpdate` push (which includes the updated scan list) handles the UI update.

### D5: Clean Up sidebarWebviewProvider Inline DB Queries

The `sidebarWebviewProvider.ts` has two inline DB query locations:
1. Lines 89-105: Fallback `queryStateAndPost()` with inline Prisma when FindingsService is unavailable. Now that FindingsService is always injected, this fallback can be removed.
2. Line 159: `this.db.finding.findMany()` inline after scan completion. Should use `FindingsService.getFindings()`.

Both violations of the constitution's service-layer rule.

### D6: Wire scanTreeProvider Refresh After Deletion

After `deleteScan()` completes, both the tree view and WebView must refresh:
- Tree view: call `scanTreeProvider.refresh()`
- WebView: call `postStateUpdate()` (already sends updated scan list + summary)

The `findingsPanelManager` needs a reference to `scanTreeProvider` to refresh it. Add a `setScanTreeProvider()` setter method.

## Modification Details

### `findings.ts` -- Changes

Add `deleteScan` method:

```typescript
async deleteScan(scanId: string): Promise<void> {
  const scan = await this.db.scan.findUnique({ where: { id: scanId } });
  if (!scan) {
    throw new Error(`Scan not found: ${scanId}`);
  }
  if (scan.status === 'RUNNING') {
    throw new Error('Cannot delete a running scan');
  }
  await this.db.scan.delete({ where: { id: scanId } });
}
```

### `scanTreeProvider.ts` -- Changes

Replace constructor to use FindingsService:

```typescript
export class ScanTreeProvider implements vscode.TreeDataProvider<ScanTreeItem> {
  private findingsService: FindingsService | undefined;

  constructor() {}

  setFindingsService(service: FindingsService): void {
    this.findingsService = service;
  }

  async getChildren(): Promise<ScanTreeItem[]> {
    if (!this.findingsService) {
      return [];
    }
    const scans = await this.findingsService.getScanSummaries();
    return scans.map(scan => new ScanTreeItem(scan));
  }
  // ... rest unchanged
}
```

Remove `PrismaClient` and `Project` imports. Remove `db` and `project` constructor parameters. Update `extension.ts` constructor call.

### `findingsPanelManager.ts` -- Changes

Add `scanTreeProvider` setter and `deleteScan` handler:

```typescript
private scanTreeProvider: ScanTreeProvider | undefined;

setScanTreeProvider(provider: ScanTreeProvider): void {
  this.scanTreeProvider = provider;
}
```

Add `case 'deleteScan'` to `handleMessage()`:

```typescript
case 'deleteScan': {
  if (this.findingsService) {
    try {
      await this.findingsService.deleteScan(message.payload.scanId);
      await this.postStateUpdate();
      this.scanTreeProvider?.refresh();
    } catch (err) {
      console.error('[ASH] Failed to delete scan:', err);
    }
  }
  break;
}
```

### `sidebarWebviewProvider.ts` -- Changes

1. Remove the inline DB fallback in `queryStateAndPost()` (lines 88-105). Only use FindingsService path.
2. Replace `this.db.finding.findMany()` (line 159) with `this.findingsService.getFindings(result.scanId)`.
3. Add `deleteScan` handler in `handleMessage()`:

```typescript
case 'deleteScan':
  if (this.findingsService) {
    try {
      await this.findingsService.deleteScan(message.payload.scanId);
      await this.queryStateAndPost();
      this.scanTreeProvider?.refresh();
    } catch (err) {
      console.error('[ASH] Failed to delete scan:', err);
    }
  }
  break;
```

4. Remove `PrismaClient` and `Project` constructor params if no longer needed after cleanup. Update callers in `extension.ts`.

### `messages.ts` (vsix) -- Changes

Add to `WebviewToExtMessage`:
```typescript
| { type: 'deleteScan'; payload: { scanId: string } }
```

### `messages.ts` (webview) -- Changes

Mirror the same addition in `webview/src/types/messages.ts`.

### `extension.ts` -- Changes

1. Update `ScanTreeProvider` constructor (no args) and add `setFindingsService()`.
2. Add `setScanTreeProvider()` on `findingsPanelManager`.
3. Update `SidebarWebviewProvider` constructor (remove `db`, `project` if cleaned up).
4. Register `ashWorkbench.deleteScan` command:

```typescript
context.subscriptions.push(
  vscode.commands.registerCommand('ashWorkbench.deleteScan', async (scanId: string) => {
    const confirm = await vscode.window.showWarningMessage(
      'Delete this scan and all its findings?',
      { modal: true },
      'Delete',
    );
    if (confirm === 'Delete') {
      try {
        await findingsService.deleteScan(scanId);
        scanTreeProvider.refresh();
        // Sidebar and panel will get stateUpdate on next requestState
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        vscode.window.showErrorMessage(`Failed to delete scan: ${msg}`);
      }
    }
  }),
);
```

### `package.json` -- Changes

Add command:
```json
{
  "command": "ashWorkbench.deleteScan",
  "title": "ASH: Delete Scan"
}
```

Add context menu entry:
```json
{
  "command": "ashWorkbench.deleteScan",
  "when": "view == ashWorkbench.scanHistory && viewItem =~ /scan\\.(completed|failed|cancelled)/",
  "group": "navigation"
}
```

### `findings.test.ts` -- Changes

Add tests:

1. **Test: deleteScan removes scan and cascaded findings** -- Create scan with findings, call `deleteScan()`, verify scan and findings are gone.
2. **Test: deleteScan throws for non-existent scan** -- Call with bad ID, verify error thrown.
3. **Test: deleteScan throws for running scan** -- Create scan with RUNNING status, verify error thrown.

## Post-Design Constitution Re-Check

| Principle | Status | Notes |
|-----------|--------|-------|
| I. VS Code Native | PASS | Tree view, context menu, command palette — all VS Code native. Delete confirmation via `showWarningMessage`. |
| II. Extension Host Owns State | PASS | Deletion in service layer. WebView sends typed message, receives stateUpdate. Tree refreshed via event emitter. |
| III. Ship Fast / Simplicity First | PASS | One service method, one command, one message type. Reuse existing `stateUpdate` for refresh. |
| IV. Typed Contracts at Boundaries | PASS | `deleteScan` in discriminated unions, synced across packages. |
| V. Theme Integration | N/A | No UI changes. |
| VI. Security by Default | PASS | Parameterized Prisma delete. Modal confirmation before destructive action. Status guard against deleting running scans. |

**Re-check result**: PASS -- no violations, no complexity tracking needed.
