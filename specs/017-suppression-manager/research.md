# Research: Suppression Management View

**Branch**: `017-suppression-manager` | **Date**: 2026-03-20

## R1: Suppression Rule Identity for Edit/Remove

**Decision**: Use full-field matching via existing `findSuppressionIndex()` from `ashYamlWriteCore.ts`.

**Rationale**: `findSuppressionIndex(suppressions, target)` already matches by all fields (path, rule_id, reason, line_start, line_end, expiration). This uniquely identifies a rule without adding synthetic IDs. When editing, the management view sends both the old suppression (for lookup) and the updated suppression (for replacement).

**Alternatives considered**:
- **Index-based identification** (YAML array position): Fragile — external edits could shift indices between load and save.
- **Synthetic UUID**: Would require schema change to `.ash.yaml` format, breaking compatibility with hand-edited files and other tools.

## R2: Update Suppression Operation

**Decision**: Add `updateSuppression(old: AshSuppression, updated: AshSuppression): Promise<SuppressionWriteResult>` to `AshYamlWriteService`.

**Rationale**: No update method exists today. Internally, the method uses `findSuppressionIndex` to locate the old entry in the parsed YAML, replaces it in the array, and calls `reserializeSuppressionsSection` to write back. This preserves array position and avoids reordering rules.

**Alternatives considered**:
- **Remove + Add (two operations)**: Loses array position, triggers two file watcher events, creates a brief invalid state where the old rule is gone but the new one isn't yet written.

## R3: Direct Removal by Suppression Rule

**Decision**: Add `removeSuppressionRule(suppression: AshSuppression): Promise<SuppressionWriteResult>` to `AshYamlWriteService`.

**Rationale**: The existing `removeSuppression(findingId, findings)` requires a finding to reverse-lookup the matching rule. The management view removes rules directly (the user selects a rule row, not a finding). A new method accepts the suppression object directly and uses `findSuppressionIndex` + `reserializeSuppressionsSection` to remove it.

**Alternatives considered**:
- **Modify existing `removeSuppression` to accept either findingId or suppression**: Overloaded signatures add confusion. Two distinct methods with clear names are simpler.

## R4: Status Computation Location

**Decision**: Add `getSuppressionStatuses(findings: FindingRow[]): SuppressionEntry[]` to `AshYamlService` (the read service).

**Rationale**: Status computation is a read operation (join suppressions with findings to compute active/unused/expired). It belongs in the read service alongside `getMatchingSuppressions`. The method:
1. Gets all suppressions via `getSuppressions()`
2. For each suppression, checks `isExpired()` from `ashYamlCore`
3. For non-expired rules, counts matching findings using existing `findMatchingSuppression` logic (reversed: iterate findings per rule)
4. Returns enriched `SuppressionEntry[]` with status, matchCount, and lightweight finding refs

**Alternatives considered**:
- **Compute in FindingsPanelManager handler**: Scatters business logic into a provider, violating the "domain services for domain queries" convention.
- **New dedicated service**: Over-engineered for a single method.

## R5: Write Result Type

**Decision**: Add a new `SuppressionWriteResult` type: `{ success: boolean; error?: string }`. Use a new `suppressionWriteResult` message type for the management view.

**Rationale**: The existing `SuppressionResult` type carries `findingId` and `action: 'suppress' | 'unsuppress'`, which are specific to the finding-driven flow. The management view operations (edit, remove, add from the management form) don't originate from a finding and don't need these fields. A simpler result type avoids forcing empty/dummy values.

**Alternatives considered**:
- **Extend existing `SuppressionResult`**: Would require making `findingId` optional and adding more action values, complicating the type for all consumers.

## R6: Edit Form Presentation

**Decision**: Inline form (replaces row content or appears below the selected row).

**Rationale**: Consistent with the existing `SuppressionForm` in `FindingDetailView` (Spec 016), which renders inline. Avoids modal complexity and keeps the user's context visible (they can still see other rules while editing).

**Alternatives considered**:
- **Modal dialog**: Blocks interaction with the rest of the view. Heavier to implement. Less consistent with existing patterns.

## R7: Message Naming Strategy

**Decision**: Use distinct message type names for management view operations to avoid confusion with existing finding-driven messages.

| Management View Message | Existing Finding-Driven Message | Handler Shares Logic? |
|------------------------|--------------------------------|----------------------|
| `addSuppression` | `suppressFinding` | Yes — both call `AshYamlWriteService.addSuppression` (management view creates `SuppressionInput` from form fields) |
| `removeSuppression` | `unsuppressFinding` | Partially — management calls new `removeSuppressionRule()`, finding-driven calls existing `removeSuppression()` |
| `editSuppression` | (none) | N/A — new operation |
| `requestSuppressions` | (none) | N/A — new query |

**Rationale**: The feature description explicitly names these messages. The existing `suppressFinding` and `unsuppressFinding` remain unchanged for the finding-driven flow, avoiding regressions.

## R8: Navigation Pattern

**Decision**: Add `'suppressionManager'` to the `ViewState` union. Follow the dual dispatch+postMessage pattern per constitution convention.

**Rationale**: When navigating to the Suppression Manager:
1. `dispatch({ type: 'NAVIGATE', view: 'suppressionManager' })` — updates local view state, pushes to viewHistory
2. `postMessage({ type: 'requestSuppressions' })` — requests data from extension host

This follows the exact pattern used by `selectScan()` and `selectScanTarget()` helpers in App.tsx. The extension host responds with `suppressionsUpdate` containing the full suppression list with computed statuses.
