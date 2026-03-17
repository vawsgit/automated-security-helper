# Quickstart: Scan History & Management

**Branch**: `010-scan-history-management` | **Date**: 2026-03-17

## What This Feature Does

The sidebar tree view displays real scans from the database (routed through FindingsService). Users can delete completed/failed/cancelled scans via right-click context menu. Cascade deletion removes all associated findings.

## Developer Setup

After pulling the branch, no special setup needed (no schema changes):

```bash
cd workbench/vsix
npm run compile
npm run test
```

## Verifying the Feature

### Scenario 1: Scan History Displays Real Data

1. Press F5 to launch the extension development host
2. Run a scan against a project
3. Look at the "Scan History" tree in the ASH sidebar
4. **Verify**: The scan appears with correct date, status icon, finding count, and source directory
5. **Verify**: Most recent scan is at the top

### Scenario 2: Click Scan to View Findings

1. In the Scan History tree, click a completed scan
2. **Verify**: The findings panel opens showing findings for that scan
3. **Verify**: Finding count matches what the tree item shows

### Scenario 3: Delete a Scan

1. Right-click a completed scan in the Scan History tree
2. Select "ASH: Delete Scan"
3. **Verify**: A confirmation dialog appears
4. Click "Delete"
5. **Verify**: The scan disappears from the tree view
6. **Verify**: The scan disappears from the WebView scan list
7. **Verify**: Summary bar counts update (findings from deleted scan are gone)

### Scenario 4: Cannot Delete Running Scan

1. Start a scan
2. While it's running, right-click it in the tree
3. **Verify**: No "Delete Scan" option appears in the context menu

### Scenario 5: Delete Last Scan

1. Delete all scans except one
2. Delete the last remaining scan
3. **Verify**: Tree view shows empty (no items)
4. **Verify**: WebView scan list shows empty state

## Files Modified

| File | Change |
|------|--------|
| `vsix/src/services/findings.ts` | Add `deleteScan()` method |
| `vsix/src/providers/scanTreeProvider.ts` | Route through FindingsService, remove direct DB |
| `vsix/src/providers/findingsPanelManager.ts` | Add deleteScan handler, scanTreeProvider setter |
| `vsix/src/providers/sidebarWebviewProvider.ts` | Add deleteScan handler, clean up inline DB queries |
| `vsix/src/models/messages.ts` | Add `deleteScan` message type |
| `vsix/src/extension.ts` | Wire new setters, register deleteScan command |
| `vsix/src/test/unit/findings.test.ts` | Add deleteScan tests |
| `vsix/package.json` | Add deleteScan command and context menu |
| `webview/src/types/messages.ts` | Mirror deleteScan message type |
