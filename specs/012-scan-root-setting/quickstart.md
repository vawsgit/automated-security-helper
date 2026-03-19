# Quickstart: Scan Root Setting

**Branch**: `012-scan-root-setting` | **Date**: 2026-03-19

## What This Feature Does

Adds an `ashWorkbench.scanRoot` VS Code setting that scopes all ASH Workbench operations (scans, findings, dashboard) to a single root directory. Removes the "Scan Folder..." context menu command and ScanTargetPicker in favor of the setting-driven approach.

## Files to Create

| File | Purpose |
|------|---------|
| `vsix/src/services/scanRoot.ts` | ScanRootService — resolves, validates, and caches the effective scan root |

## Files to Modify

| File | Change |
|------|--------|
| `vsix/package.json` | Add `ashWorkbench.scanRoot` setting; remove `scanFolder` command and context menu |
| `vsix/src/extension.ts` | Create ScanRootService, register config change listener, wire to services |
| `vsix/src/services/findings.ts` | Add `scanRoot` parameter to `getScanSummaries`, `getScanTargets`, `getSummary` |
| `vsix/src/services/scanner.ts` | Accept scan root from caller instead of requiring `targetPath` in all paths |
| `vsix/src/providers/scanTreeProvider.ts` | Accept ScanRootService, pass scan root to filtered `getScanSummaries` |
| `vsix/src/providers/findingsPanelManager.ts` | Use ScanRootService for scan initiation and `navigateToCode` path resolution; update `postStateUpdate` to include `scanRoot` |
| `vsix/src/providers/sidebarWebviewProvider.ts` | Use ScanRootService instead of `workspaceFolders[0]`; update `handleStartScan` |
| `vsix/src/commands/scanCommands.ts` | Remove `scanFolder` command handler |
| `vsix/src/models/messages.ts` | Simplify `startScan` (remove payload); add `scanRoot` to `stateUpdate` |
| `webview/src/types/messages.ts` | Mirror message changes |
| `webview/src/components/DashboardView.tsx` | Remove ScanTargetPicker import/usage |
| `webview/src/components/ScanHistoryView.tsx` | Remove ScanTargetPicker import/usage |

## Files to Delete

| File | Reason |
|------|--------|
| `webview/src/components/ScanTargetPicker.tsx` | No longer needed — scan root setting replaces target picking |

## Implementation Order

1. **Setting + Service** (foundation): Add `ashWorkbench.scanRoot` to package.json, create `ScanRootService`
2. **FindingsService filtering**: Add scan root parameter to aggregate query methods
3. **Extension wiring**: Create service in `activate()`, register config change listener, cascade updates
4. **Provider updates**: Update ScanTreeProvider, FindingsPanelManager, SidebarWebviewProvider
5. **Message protocol**: Simplify `startScan`, add `scanRoot` to `stateUpdate` (both sides)
6. **Removal**: Delete ScanTargetPicker, remove scanFolder command, clean up imports
7. **Testing**: Verify zero-config path, custom root path, setting change propagation

## Key Design Decisions

- **ScanRootService** is a domain service (class with constructor-injected dependencies), not a utility service
- **Filtering is at query time** — no schema changes, Prisma `startsWith` on ScanTarget.path
- **Config change listener** lives in extension.ts, calls services directly (no EventEmitter)
- **startScan message** drops its payload — extension host resolves the target from ScanRootService
