# Contract: Provider Updates

**Feature**: 005-scan-execution-e2e
**Date**: 2026-03-16

## FindingsPanelManager

**File**: `vsix/src/providers/findingsPanelManager.ts`

### Constructor Changes

```typescript
constructor(
  extensionUri: vscode.Uri,
  db: PrismaClient,
  project: Project,
  scanner: ScannerService,
)
```

- `db` and `project` become active (remove `_` prefix)
- `scanner` added for handling `startScan`/`cancelScan` messages from WebView

### New Methods

- `showScanning(scanId: string, targetPath: string): void` — Opens panel and sends `scanStarted` message with scanId and targetPath. Used by scan commands to show scanning state immediately.
- `postProgress(scanId: string, elapsed: number, status: string): void` — Sends `scanProgress` message to the WebView panel. Called by the scan execution helper during progress callbacks.
- `postFindingsUpdate(scanId: string, findings: FindingRow[]): void` — Sends `findingsUpdate` message. Called after scan completion.

### Message Handler Updates

- `requestState` → Replace `getMockFindings()` with `db.finding.findMany({ where: { scanId } })` + mapper
- `selectFinding` → Replace `getMockFindingDetail()` with `db.finding.findUnique({ where: { id } })` + mapper
- `setDisposition` → Replace `updateDisposition()` with `db.finding.update()` (note: disposition field may not be in schema yet; handle gracefully)
- `startScan` (new) → Call shared scan execution flow, send `scanStarted` back
- `cancelScan` (new) → Call `scanner.cancelScan()`
- `navigateToCode` → Remove "(mock data — file does not exist)" message; keep file-not-found handling

## SidebarWebviewProvider

**File**: `vsix/src/providers/sidebarWebviewProvider.ts`

### Constructor Changes

```typescript
constructor(
  extensionUri: vscode.Uri,
  db: PrismaClient,
  project: Project,
  scanner: ScannerService,
)
```

- `db` and `project` become active
- `scanner` added for handling `startScan` message

### New Methods

- `postProgress(scanId: string, elapsed: number, status: string): void` — Sends `scanProgress` to sidebar. Called by scan execution helper.
- `postStateUpdate(scans: ScanSummary[], summary: DispositionSummary): void` — Sends `stateUpdate`. Called after scan completion.

### Message Handler Updates

- `requestState` → Replace `getMockScans()`/`getMockSummary()` with DB queries + mappers
- `startScan` → Replace mock info message with real scan execution (workspace root target)

## ScanTreeProvider

**File**: `vsix/src/providers/scanTreeProvider.ts`

### Constructor Changes

```typescript
constructor(
  db: PrismaClient,
  project: Project,
)
```

- `db` and `project` become active (remove `_` prefix)

### Method Updates

- `getChildren()` → Replace `getMockScans()` with `db.scan.findMany({ where: { projectId }, orderBy: { startedAt: 'desc' } })` + mapper. Method becomes async (returns `Promise<ScanTreeItem[]>`; TreeDataProvider supports this).
- `refresh()` → No changes (already works correctly)
