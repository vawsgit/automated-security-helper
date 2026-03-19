# Research: Unified Current Findings View

**Branch**: `015-current-findings-view` | **Date**: 2026-03-19

## R1: Current Findings Computation Strategy

**Decision**: Computed view via `FindingsService.getCurrentFindings()` — no new DB table.

**Rationale**: The "current findings" concept is the latest scan's findings + .ash.yaml suppression overlay. Since suppression state is derived from a file (not DB), persisting it would create a stale cache. Computing on-demand is simpler, always accurate, and uses existing Prisma queries + AshYamlService.batchMatchSuppressions().

**Alternatives considered**:
- Materialized view in PGLite: Rejected — adds schema complexity, stale cache risk, violates "Ship Fast" principle.
- Cached in-memory on extension host: Rejected — already effectively cached by Prisma's query cache; adding another layer adds invalidation complexity.

## R2: Finding Latest Completed Scan for Scan Root

**Decision**: Query `db.scan.findFirst()` with `status: 'COMPLETED'`, `scanTarget.path` matching effective scan root, ordered by `startedAt DESC`.

**Rationale**: FindingsService already uses this pattern in `getScanTargets()` (line 140 of findings.ts) to find the latest scan per target. The scan root filter pattern (`OR` clause for path matching) is already implemented in `getScanSummaries()` and `getSummary()`. We extend this to find the single latest completed scan.

**Alternatives considered**:
- Query all targets under scan root, then find latest scan across them: More complex, same result. The single-query approach is simpler.
- Track "current scan" pointer in DB: Over-engineering — "latest COMPLETED" is deterministic.

## R3: Batch Suppression Matching Performance

**Decision**: Use `AshYamlService.getMatchingSuppressions(findings)` which calls `batchMatchSuppressions()` from ashYamlCore.

**Rationale**: `batchMatchSuppressions()` (line 355 of ashYamlCore.ts) pre-filters expired suppressions, pre-compiles glob patterns via picomatch, then iterates findings against compiled matchers. This is O(F*S) where F=findings, S=non-expired suppressions, but with compiled patterns it's efficient for typical workloads (hundreds of findings, tens of suppressions).

**Alternatives considered**:
- Per-finding `matchesSuppression()` calls: Works but recompiles glob patterns per call. Batch is strictly better.
- Index-based matching: Over-engineering for expected data volumes.

## R4: Message Protocol Extension Pattern

**Decision**: Add `currentFindingsUpdate` and `ashYamlChanged` to `ExtToWebviewMessage` discriminated union.

**Rationale**: Existing pattern uses discriminated unions with `type` field. Adding new variants is backward-compatible — existing message handlers ignore unknown types via switch/case default. Both vsix and webview message types must be updated in sync (manual copy per constitution).

**Alternatives considered**:
- Reuse existing `findingsUpdate` for current findings: Rejected — `findingsUpdate` carries `scanId` and is tied to scan-specific views. Current findings is a different concept.
- Single generic `dataUpdate` message: Violates typed contracts principle.

## R5: Suppression Toggle as Local UI State

**Decision**: `showSuppressed: boolean` in AppState, reset to `false` on panel open, not persisted.

**Rationale**: Per spec FR-014, toggle must not persist. Local reducer state is the simplest approach. The toggle filters the `currentFindings` array client-side — no server round-trip needed, achieving <500ms response (SC-003).

**Alternatives considered**:
- Filter server-side via message: Adds round-trip latency, unnecessary since all data is already in webview.
- Persist in VS Code settings: Explicitly excluded by spec.

## R6: .ash.yaml Change Reactivity Flow

**Decision**: Subscribe to `AshYamlService.onDidChangeConfig` in extension.ts, trigger recomputation cascade to both FindingsPanelManager and SidebarWebviewProvider.

**Rationale**: Extension.ts already has an .ash.yaml change listener (lines 161-166) that triggers UI updates. We extend this to recompute current findings and post `currentFindingsUpdate` messages. The AshYamlService already debounces file changes at 200ms (DEBOUNCE_MS in ashYamlCore), so rapid edits are coalesced.

**Alternatives considered**:
- Each provider watches .ash.yaml independently: Violates single-responsibility — extension.ts is the coordinator.
- Polling: Unnecessary — file watcher + debounce already implemented in Spec 013.

## R7: mapFindingToRow Suppression-Aware Extension

**Decision**: Add optional `suppression?: AshSuppression` parameter to `mapFindingToRow()`. When provided, populate `suppression`, `isCurrentlySuppressed`, and `suppressionSource` fields.

**Rationale**: The mapper is the canonical Prisma-to-view translation point (per constitution). Adding an optional parameter preserves backward compatibility — existing callers (scan-specific views) pass no suppression and get current behavior. New callers (current findings flow) pass the matched suppression.

**Alternatives considered**:
- Separate `mapFindingToRowWithSuppression()`: Duplicates mapper logic.
- Post-process findings array after mapping: Breaks the mapper pattern — all translation should happen in mappers.ts.

## R8: Historical Scan Suppression Overlay

**Decision**: When loading findings for a historical scan, also call `AshYamlService.getMatchingSuppressions()` and populate `isCurrentlySuppressed` on each FindingRow.

**Rationale**: This uses the same batch matching as current findings, just applied to a different scan's findings. The overlay is always against the CURRENT .ash.yaml state (not the state at scan time), which is the spec's intent.

**Alternatives considered**:
- Only overlay on current findings, skip historical: Would lose the "this finding is currently suppressed" context on historical views.
- Store .ash.yaml state at scan time: Over-engineering — users want to know current suppression state.

## R9: Triage Progress Bar Denominator Change

**Decision**: When computing triage progress for current findings view, use active findings count (total - suppressed) as denominator. Suppressed findings are excluded from the progress calculation.

**Rationale**: Per spec FR-004, triage progress uses active findings only. This means a finding that is suppressed via .ash.yaml doesn't count toward "what needs triaging." The TriageProgressBar component already takes `counts` and `total` as props — we just need to pass the correct values.

**Alternatives considered**:
- Include suppressed in denominator: Misleading — suppressed findings don't need triage action.
- Remove SUPPRESS from disposition entirely: Breaks backward compatibility with existing data.
