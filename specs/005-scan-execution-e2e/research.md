# Research: Scan Execution End-to-End

**Feature**: 005-scan-execution-e2e
**Date**: 2026-03-16

## R1: ScannerService Sharing Across Commands and Providers

**Decision**: Pass `ScannerService` to consumers via constructor/setter injection from `extension.ts`.

**Rationale**: The scanner is created in `activate()` after `ensureProject()`. All consumers (scanCommands, findingsPanelManager, sidebarWebviewProvider) are also created/registered in `activate()`. Constructor injection is the simplest pattern and follows the existing `db`/`project` injection pattern already used by providers.

**Implementation**:
- `registerScanCommands()` gains a `scanner: ScannerService` parameter (and `scanTreeProvider`, `sidebarWebviewProvider` for post-scan refresh)
- `FindingsPanelManager` constructor adds `scanner: ScannerService` parameter (replacing unused `_db`/`_project` with active dependencies)
- `SidebarWebviewProvider` constructor adds `scanner: ScannerService` parameter
- Module-level `setFindingsPanelManagerRef()` pattern in scanCommands.ts is replaced with direct parameter passing

**Alternatives considered**:
- Service registry/container: Over-engineered for 3-4 consumers. Constitution (Principle III) says KISS.
- Module-level singleton: Couples the service to module scope, harder to test, violates explicit dependency principle.

## R2: Scan Target Picker (Quick Pick)

**Decision**: Use `vscode.window.showQuickPick()` to present target options, with `vscode.window.showOpenDialog()` as the "Browse..." fallback.

**Rationale**: VS Code's QuickPick is the standard native UI for single-selection lists. Constitution (Principle I) requires using VS Code APIs where they exist.

**Implementation**:
1. Query `db.scanTarget.findMany({ where: { projectId } })` for previously scanned targets
2. Build QuickPickItems: workspace root (always first), then DB targets (excluding workspace root if already present), then a separator and "Browse..." option
3. "Browse..." opens `vscode.window.showOpenDialog({ canSelectFolders: true, canSelectFiles: false })` for custom path selection
4. Return the selected path string, or `undefined` if cancelled

**Alternatives considered**:
- Input box with path: Poor UX — requires typing/pasting paths, no discovery
- TreeView selector: More complex, not needed for a simple list

## R3: Progress Broadcasting to Multiple WebViews

**Decision**: The `onProgress` callback passed to `ScannerService.startScan()` posts `scanProgress` messages to all active WebViews (findings panel + sidebar).

**Rationale**: ScannerService already accepts an `onProgress?: (progress: ScanProgress) => void` callback. The caller creates a callback that broadcasts to all WebViews that have an active panel/view reference. This avoids any changes to ScannerService itself.

**Implementation**:
- Create a shared `executeScanWithProgress()` helper function (in scanCommands.ts or a small helper) that:
  1. Opens the findings panel immediately
  2. Calls `scanner.startScan(params, onProgress)` where `onProgress` posts `scanProgress` to both sidebar view and findings panel
  3. On completion, sends `findingsUpdate` to findings panel, `stateUpdate` to sidebar, calls `scanTreeProvider.refresh()`
  4. On error, shows `vscode.window.showErrorMessage()`
- Both the command palette handler and the WebView message handlers call this same helper

**Alternatives considered**:
- Event emitter on ScannerService: Would require modifying ScannerService (Spec 004) which is already complete. The callback approach works without changes.
- Separate progress polling: Overcomplicated; the callback pattern is push-based and already works.

## R4: Replacing Mock Data with Real Database Queries

**Decision**: Replace all `getMock*()` calls with Prisma queries using the `db` and `project` references already passed to constructors.

**Rationale**: The providers already accept `db: PrismaClient` and `project: Project` — they're just unused (prefixed with `_`). Remove the underscore prefix, add real queries, remove mock imports.

**Implementation by provider**:

### FindingsPanelManager
- `requestState` → `db.finding.findMany({ where: { scanId } })` + map to `FindingRow`
- `selectFinding` → `db.finding.findUnique({ where: { id } })` + map to `FindingRow`
- `setDisposition` → `db.finding.update({ where: { id }, data: { disposition } })` + return updated
- Remove import of `getMockFindings`, `getMockFindingDetail`, `updateDisposition`

### SidebarWebviewProvider
- `requestState` → `db.scan.findMany({ where: { projectId }, orderBy: { startedAt: 'desc' } })` + map to `ScanSummary[]`, compute `DispositionSummary` from `db.finding.groupBy()`
- Remove import of `getMockScans`, `getMockSummary`

### ScanTreeProvider
- `getChildren()` → `db.scan.findMany({ where: { projectId }, orderBy: { startedAt: 'desc' } })` + map to `ScanSummary[]`
- `getChildren()` becomes `async` (TreeDataProvider supports `Thenable<T[]>`)
- Remove import of `getMockScans`

**Alternatives considered**:
- Keep mock data as fallback: Adds dead code paths, violates YAGNI, makes testing harder
- Create a data access layer abstraction: Over-engineering for 3 query sites; direct Prisma calls are simpler

## R5: Mapping Prisma Models to View Types

**Decision**: Create lightweight mapping functions to convert Prisma `Scan`/`Finding` models to the view types (`ScanSummary`, `FindingRow`) used by the WebView.

**Rationale**: The Prisma models have different field names and shapes than the WebView types (e.g., `Scan.sourceDir` → `ScanSummary.sourceDirectory`, `Finding.file` → `FindingRow.filePath`). Mapping functions keep this conversion explicit and testable.

**Implementation**:
- `mapScanToSummary(scan: Scan): ScanSummary` — converts Prisma Scan to view ScanSummary
- `mapFindingToRow(finding: Finding): FindingRow` — converts Prisma Finding to view FindingRow
- Place in `vsix/src/models/mappers.ts`
- Some FindingRow fields that don't exist in the Prisma model yet (aiAnalysis, suppression, notes) will be set to `null`/empty string defaults

**Alternatives considered**:
- Inline mapping in each provider: Duplicates the conversion logic across 3 files
- Change WebView types to match Prisma: Would require changing the webview contract that other code depends on

## R6: WebView Reducer Changes for scanProgress

**Decision**: Add a `scanProgress` case to the MESSAGE handler in App.tsx that updates scanning state with elapsed time.

**Rationale**: The App.tsx reducer already handles `scanStarted` and transitions to `scanProgress` view. The new `scanProgress` message type updates the elapsed time display within that view. The existing `scanProgress` view already exists in the webview routing.

**Implementation**:
- Add `scanProgress` case in the MESSAGE switch in App.tsx reducer
- Update state: `scanElapsed` and `scanStatus` fields
- The `scanProgress` view page already handles rendering based on these state fields
- On `stateUpdate` or `findingsUpdate` after scan, the view transitions away from `scanProgress`

**Alternatives considered**:
- Client-side timer: Would duplicate elapsed tracking already done by ScannerService; violates Constitution Principle II (extension host owns state)

## R7: scanStarted Message Enhancement

**Decision**: Enhance the existing `scanStarted` message to include `scanId` alongside `targetPath`.

**Rationale**: The findings panel needs the `scanId` to later request findings for the correct scan. Currently `scanStarted` only carries `targetPath`. Adding `scanId` lets the WebView associate progress and results with the correct scan.

**Implementation**:
- `scanStarted` payload becomes `{ scanId: string; targetPath: string }` (additive, non-breaking)
- Update both `vsix/src/models/messages.ts` and `webview/src/types/messages.ts`

**Alternatives considered**:
- Send scanId in a separate message: Increases message count, adds ordering complexity
- Derive scanId from targetPath: Not reliable (multiple scans can target the same path)

## R8: Handling "Already in Progress" Error

**Decision**: Catch the `ScannerService.startScan()` error ("A scan is already in progress for this project.") and show it as `vscode.window.showWarningMessage()`.

**Rationale**: The ScannerService already throws this error (Spec 004). The caller simply needs to catch it and present it to the user. No new protocol messages needed — this is a synchronous rejection before any scan starts.

**Implementation**:
- Wrap `scanner.startScan()` call in try/catch
- On error with message containing "already in progress", show `showWarningMessage()`
- On other errors, show `showErrorMessage()`

**Alternatives considered**:
- Pre-check via DB query before calling startScan: Redundant — ScannerService already does this check
- Disable scan buttons while scanning: Good UX enhancement but requires additional state tracking in WebView; can be added later as P3
