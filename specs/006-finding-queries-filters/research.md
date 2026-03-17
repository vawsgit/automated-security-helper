# Research: Finding Queries, Filters & Summary

## R1: FindingsService Extraction — Service vs. Inline Queries

**Decision**: Create a `FindingsService` class that centralizes all finding/scan/scan-target query logic. Providers call the service instead of querying `db` directly.

**Rationale**: Currently `findingsPanelManager.ts` and `sidebarWebviewProvider.ts` both contain inline Prisma queries with mapper calls. This duplicates the query-then-map pattern and makes it harder to add filtering (each consumer would need its own filter logic). A single service class owns all query construction, filter application, and mapping — following the existing `ScannerService` pattern.

**Alternatives considered**:
- **Keep inline queries**: Simpler but filter logic would need to be duplicated in every handler. Rejected because FR-004–FR-008 add non-trivial query composition.
- **Utility functions (not a class)**: Would work but loses the ability to inject `db` + `projectId` once at construction. Class pattern is already established with `ScannerService` and `DatabaseService`.

## R2: Filter Query Strategy — Database vs. In-Memory

**Decision**: Apply filters at the database query level using Prisma `where` clauses, not in-memory post-fetch filtering.

**Rationale**: Filtering in the database is more efficient for large result sets (hundreds of findings per scan). Prisma's typed `where` API maps directly to the FilterState fields: `severity: { in: [...] }`, `scanner: { equals: ... }`, `disposition: { in: [...] }`, `file: { contains: ... }`. This keeps the service layer thin.

**Alternatives considered**:
- **In-memory filtering**: Fetch all findings, then `.filter()` in JS. Simpler but wasteful for large scans and doesn't scale. Rejected per SC-001 (1-second response for 500 findings).
- **Hybrid (fetch all, cache, filter in-memory)**: Over-engineered for a single-user extension with an in-process DB. The round-trip to PGLite WASM is effectively zero network latency.

## R3: Disposition Summary Computation — GroupBy vs. Count Queries

**Decision**: Use Prisma `groupBy` on the `disposition` field to compute per-disposition counts in a single query.

**Rationale**: `db.finding.groupBy({ by: ['disposition'], where: { projectId }, _count: true })` returns all disposition counts in one round-trip. This replaces the current naive approach in `sidebarWebviewProvider.ts` which sets `PENDING = totalFindings` and all others to 0.

**Alternatives considered**:
- **Multiple `count()` calls**: One per disposition state (4 queries). Works but wasteful.
- **In-memory counting from fetched findings**: Requires fetching all findings just to count dispositions. Rejected.

## R4: ScanTarget Enrichment — Query Strategy

**Decision**: Query `ScanTarget` records and enrich them with aggregated data from `Scan` and `Finding` tables using multiple focused queries, then assemble in-memory.

**Rationale**: PGLite/Prisma doesn't support subquery aggregation in a single query elegantly. The practical approach: (1) fetch all ScanTargets for the project, (2) for each target, query finding counts grouped by severity and disposition, (3) count scans per target. Since there are typically 1–5 scan targets per project, this is a small number of queries.

**Alternatives considered**:
- **Raw SQL with window functions**: PGLite supports it but bypasses Prisma type safety. Rejected per Constitution IV (typed contracts).
- **Single query with includes and aggregation**: Prisma doesn't support `_count` on nested relations with groupBy. Would require raw queries.

## R5: stateUpdate Message Enhancement — Include ScanTargets

**Decision**: Extend the `stateUpdate` message payload to include `scanTargets: ScanTarget[]` alongside the existing `scans` and `summary` fields.

**Rationale**: The WebView needs scan target data to render dashboard cards. Currently the WebView uses `mockScanTargets` for initial state. Adding `scanTargets` to `stateUpdate` means the extension host pushes all dashboard data in a single message. The WebView replaces mock initial state with empty arrays and populates them when it receives `stateUpdate`.

**Alternatives considered**:
- **Separate `scanTargetsUpdate` message**: More granular but adds message protocol complexity for no benefit — scan targets are always needed alongside scans and summary.
- **Keep mock data in WebView**: Defeats the purpose of this spec.

## R6: WebView Mock Data Removal Strategy

**Decision**: Replace mock data imports in `App.tsx` with empty initial state. The WebView starts in a loading/empty state and receives real data via `stateUpdate` messages from the extension host.

**Rationale**: The WebView currently imports `mockProject`, `mockScans`, `mockFindings`, `mockSummary`, `mockScanTargets` for its initial reducer state. These must be replaced with empty defaults: `scans: []`, `findings: []`, `summary: { total: 0, counts: { PENDING: 0, FIX: 0, SUPPRESS: 0, DEFER: 0 } }`, `scanTargets: []`. The `project` field can use a minimal placeholder until the extension sends it. The `mock-data.ts` file remains available for Kitchen Sink / dev-mode rendering but is no longer imported by `App.tsx`.

**Alternatives considered**:
- **Delete mock-data.ts entirely**: Would break the Kitchen Sink demos. Keep it but only import from sink pages.
- **Conditional import based on context**: Over-engineered. Just use empty initial state.

## R7: applyFilters Message Protocol

**Decision**: Add `applyFilters` to `WebviewToExtMessage` with a `FilterState` payload. Add `FilterState` type to both `vsix/src/models/types.ts` and `webview/src/types/types.ts`.

**Rationale**: The WebView sends filter criteria to the extension host, which queries the database and sends back a `findingsUpdate` with the filtered results. This follows the Constitution II principle: extension host owns state, WebView is a pure renderer. The WebView maintains local filter UI state (which checkboxes are checked) but the authoritative filtered data comes from the extension host.

**Alternatives considered**:
- **Filter client-side in the WebView**: Violates Constitution II. Would require the WebView to hold all findings in memory and apply its own filter logic.
- **Extend `selectScan` message with filter params**: Conflates scan selection with filtering. Better to have a dedicated message type.

## R8: dispositionUpdated Response Enhancement

**Decision**: After a disposition update, the extension host should send both `dispositionUpdated` (for the specific finding) AND a refreshed `stateUpdate` (for updated summary and scan targets). This keeps the sidebar dashboard and scan target cards in sync.

**Rationale**: Currently `dispositionUpdated` only updates one finding. But changing a disposition affects the project-wide summary counts and scan target triage progress. The extension host should re-query the summary and scan targets and push an updated `stateUpdate` so the dashboard reflects the change without requiring a manual refresh.

**Alternatives considered**:
- **WebView recomputes summary locally**: Already done via `recomputeSummary()` in `App.tsx`. But this only works if the WebView holds all findings, which won't be true once filtering is added. The extension host is the source of truth.
- **Only update on next requestState**: Leaves the dashboard stale until the user navigates away and back. Bad UX.
