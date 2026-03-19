# Research: Scan Root Setting

**Branch**: `012-scan-root-setting` | **Date**: 2026-03-19

## Decision 1: Scan Root Resolution Strategy

**Decision**: Create a `ScanRootService` class (domain service with instance state) that resolves the effective scan root from the `ashWorkbench.scanRoot` setting, validates it, and exposes a reactive `getEffectiveScanRoot()` method.

**Rationale**: The constitution mandates domain services as classes with injected dependencies (Extension Host Conventions). A service class fits because: (a) it holds state (the cached resolved root), (b) it depends on VS Code settings API, (c) multiple consumers need it (FindingsService, ScannerService, ScanTreeProvider, panel managers).

**Alternatives considered**:
- **Pure utility function**: Rejected — no caching, every caller re-reads settings and re-validates filesystem. Stateless utility pattern is for operations like `AdminService.resetApplication()`, not for reactive state.
- **Inline in extension.ts**: Rejected — violates "domain queries through service classes" convention. Would scatter resolution logic across multiple files.

## Decision 2: Data Filtering Approach

**Decision**: Add a `scanRoot` parameter to FindingsService query methods (`getScanSummaries`, `getScanTargets`, `getSummary`) that filters by ScanTarget.path prefix matching against the effective scan root. Use Prisma `startsWith` filter with path separator awareness.

**Rationale**: Filtering at query time preserves all historical data (FR-008), requires no schema changes (spec non-goal), and leverages existing Prisma type-safe queries. The ScanTarget model already stores the absolute path that was scanned.

**Alternatives considered**:
- **Filter in mappers**: Rejected — fetches all data then discards; wasteful and won't scale with scan history.
- **Add scanRootId FK to schema**: Rejected — spec explicitly says no schema changes. Scan root is a runtime concept, not a data model entity.
- **Filter in WebView**: Rejected — violates "Extension Host Owns State" principle. Business logic must stay in vsix/.

## Decision 3: Configuration Change Propagation

**Decision**: Register a single `vscode.workspace.onDidChangeConfiguration` listener in `extension.ts` that calls `ScanRootService.refresh()`, then cascades updates: re-queries FindingsService → pushes `stateUpdate` to all WebView panels → refreshes ScanTreeProvider.

**Rationale**: Centralized listener in the activation function follows the existing wiring pattern (all service initialization and event registration happens in `activate()`). The cascade order ensures data consistency before UI refresh.

**Alternatives considered**:
- **EventEmitter pattern**: Rejected — adds indirection. With only 3-4 consumers, direct calls from one listener are simpler and easier to debug (Constitution III: Ship Fast / Simplicity First).
- **Per-service listeners**: Rejected — each service registers its own `onDidChangeConfiguration`. Creates redundant listener registrations and ordering ambiguity.

## Decision 4: ScanFolder Command Removal

**Decision**: Remove the `ashWorkbench.scanFolder` command registration from `package.json` (contributes.commands and contributes.menus.explorer/context), remove the handler from `scanCommands.ts`, and delete the `ScanTargetPicker.tsx` WebView component. Remove ScanTargetPicker imports from `DashboardView.tsx` and `ScanHistoryView.tsx`.

**Rationale**: Per clarification session (2026-03-19), the scan root is the sole authority for what gets scanned. Retaining the context menu command would create a UX conflict where users can scan directories outside the root but can't see the results.

**Alternatives considered**:
- **Keep command but restrict to subdirectories of scan root**: Rejected — adds validation complexity for a feature the user explicitly doesn't want.
- **Keep ScanTargetPicker for future use**: Rejected — YAGNI. Can be re-added if needed later.

## Decision 5: Subdirectory Matching Implementation

**Decision**: Use path prefix matching with path separator awareness: `scanTarget.path === scanRoot || scanTarget.path.startsWith(scanRoot + path.sep)`. In Prisma queries, use `startsWith` filter on the `path` field.

**Rationale**: Simple string prefix matching handles the common case (scan root is a directory, targets are within it). Adding `path.sep` prevents false matches like `/foo/bar` matching `/foo/barbaz`.

**Alternatives considered**:
- **Path.relative() check**: More robust but can't be pushed to database — would require fetching all records then filtering in JS.
- **Regex matching**: Overly complex for path prefix matching. No benefit over startsWith + separator check.

## Decision 6: startScan Message Simplification

**Decision**: The `startScan` WebviewToExtMessage no longer needs a `targetPath` payload. When the sidebar "Run Scan" button or the `ashWorkbench.startScan` command fires, the extension host reads the effective scan root from `ScanRootService` and uses it directly.

**Rationale**: With ScanTargetPicker removed and scan root as the sole authority, there's no user-selectable target path. The extension host already knows the scan root. Simplifies the message contract.

**Alternatives considered**:
- **Keep targetPath in message, default to scan root**: Rejected — unused flexibility. No caller would ever send a different path since the picker is removed.
