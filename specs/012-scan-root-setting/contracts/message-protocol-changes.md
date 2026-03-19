# Message Protocol Changes: Scan Root Setting

**Branch**: `012-scan-root-setting` | **Date**: 2026-03-19

## Overview

The typed message protocol between extension host and WebView requires two changes:
1. Simplify `startScan` message (remove `targetPath` payload)
2. Add `scanRoot` to `stateUpdate` payload (informational, for potential UI display)

Both `vsix/src/models/messages.ts` and `webview/src/types/messages.ts` must be updated in sync.

## WebviewToExtMessage Changes

### Before

```typescript
| { type: 'startScan'; payload: { targetPath: string } }
```

### After

```typescript
| { type: 'startScan' }
```

**Rationale**: The scan root is resolved by the extension host from `ScanRootService`. No user-selectable target path exists after ScanTargetPicker removal. The WebView simply requests "start a scan" and the extension host knows where.

## ExtToWebviewMessage Changes

### Before

```typescript
| { type: 'stateUpdate'; payload: { scans: ScanSummary[]; summary: DispositionSummary; scanTargets: ScanTarget[] } }
```

### After

```typescript
| { type: 'stateUpdate'; payload: { scans: ScanSummary[]; summary: DispositionSummary; scanTargets: ScanTarget[]; scanRoot: string } }
```

**Rationale**: The WebView may want to display the current scan root path (e.g., in the dashboard header or as context in the sidebar). Adding `scanRoot` to the state update keeps the WebView informed without it needing to resolve settings itself.

## No Other Message Changes

- `scanStarted` keeps its `targetPath` payload (it reports what path is being scanned, which is now always the scan root — still useful for display).
- `selectScanTarget` remains unchanged (users can still navigate scan targets within the root).
- `navigateToCode` remains unchanged (path resolution stays in extension host).

## Handler Changes Required

### findingsPanelManager.ts `handleMessage()`

The `startScan` case currently reads `message.payload.targetPath`. After change:
- Read effective scan root from `ScanRootService.getEffectiveScanRoot()`
- No payload destructuring needed

### sidebarWebviewProvider.ts `handleStartScan()`

Currently reads `vscode.workspace.workspaceFolders?.[0]?.uri.fsPath` directly. After change:
- Read from `ScanRootService.getEffectiveScanRoot()`
- Remove direct workspace folder access

### App.tsx / DashboardView.tsx / ScanHistoryView.tsx (WebView)

- Remove `ScanTargetPicker` imports and usage
- The `startScan` dispatch no longer needs a `targetPath` argument
- Dashboard can optionally display `state.scanRoot` from `stateUpdate`
