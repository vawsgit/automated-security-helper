# Contract: Scan Commands

**Feature**: 005-scan-execution-e2e
**Date**: 2026-03-16
**File**: `vsix/src/commands/scanCommands.ts`

## Registration Function

```typescript
export function registerScanCommands(
  context: vscode.ExtensionContext,
  scanner: ScannerService,
  db: PrismaClient,
  projectId: string,
  findingsPanelManager: FindingsPanelManager,
  sidebarWebviewProvider: SidebarWebviewProvider,
  scanTreeProvider: ScanTreeProvider,
): void
```

**Changes from current**:
- Previously: `registerScanCommands(context: vscode.ExtensionContext)` with module-level `findingsPanelManager` ref
- Now: All dependencies passed as parameters. Remove `setFindingsPanelManagerRef()` pattern.

## Commands

### ashWorkbench.startScan

1. Query `db.scanTarget.findMany()` for existing targets
2. Build QuickPick items: workspace root, DB targets, "Browse..." separator
3. Show `vscode.window.showQuickPick(items)`
4. If "Browse..." selected, show `vscode.window.showOpenDialog({ canSelectFolders: true })`
5. If path selected, call shared `executeScan()` helper

### ashWorkbench.cancelScan

1. Get current scan ID from scanner service (if any)
2. Call `scanner.cancelScan(scanId)`
3. No error if no scan is running

### ashWorkbench.scanFolder

1. Receive `folderUri: vscode.Uri` from context menu
2. Extract `folderUri.fsPath`
3. Call shared `executeScan()` helper with that path

## Shared Helper: executeScan()

```typescript
async function executeScan(
  targetPath: string,
  scanner: ScannerService,
  db: PrismaClient,
  projectId: string,
  findingsPanelManager: FindingsPanelManager,
  sidebarWebviewProvider: SidebarWebviewProvider,
  scanTreeProvider: ScanTreeProvider,
): Promise<void>
```

1. Open findings panel immediately via `findingsPanelManager.showScanning(scanId, targetPath)`
2. Call `scanner.startScan({ targetPath }, onProgress)` where onProgress broadcasts `scanProgress` to both WebViews
3. On success: send `findingsUpdate` to findings panel, `stateUpdate` to sidebar, call `scanTreeProvider.refresh()`
4. On "already in progress" error: show `showWarningMessage()`
5. On other error: show `showErrorMessage()`

## Test Requirements

- Unit tests not practical for command registration (requires vscode API)
- Integration tests validate: command palette trigger, context menu trigger, cancel command
- Mock ScannerService for integration tests
