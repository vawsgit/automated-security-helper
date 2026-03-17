# Implementation Plan: Finding Detail & Code Navigation

**Branch**: `008-finding-detail-navigation` | **Date**: 2026-03-17 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/008-finding-detail-navigation/spec.md`

## Summary

Replace the direct Prisma call in `findingsPanelManager.ts`'s `selectFinding` handler with a proper `FindingsService.getFindingDetail()` method, aligning with the constitution's service-layer convention. Code navigation is already fully implemented and requires no changes. This is a minimal refactoring + wiring feature that completes the finding detail flow with real SARIF data.

## Technical Context

**Language/Version**: TypeScript / ES2022 target, Node16 modules, strict mode
**Primary Dependencies**: VS Code API (existing), Prisma ORM (existing), FindingsService (Spec 006)
**Storage**: PGLite (existing) -- read-only queries for this feature
**Testing**: Mocha (unit, Node.js) + sinon for mocking. Existing `findings.test.ts` pattern from Spec 006
**Target Platform**: VS Code ^1.110.0
**Project Type**: VS Code extension
**Performance Goals**: Finding detail loads within 500ms for databases with up to 10,000 findings (SC-001)
**Constraints**: No new files. Modifies existing service and provider files only. No new message types needed
**Scale/Scope**: Single finding detail query per user click, single concurrent panel

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Evidence |
|-----------|--------|----------|
| I. VS Code Native | PASS | All logic in extension host. No external services. `showTextDocument` is a VS Code API. |
| II. Extension Host Owns State | PASS | Finding detail query runs in extension host, result pushed to WebView via typed `findingDetail` message. Code navigation uses `vscode.window.showTextDocument`. |
| III. Ship Fast / Simplicity First | PASS | One new method on existing service. Replaces inline DB call with service call. No new abstractions. |
| IV. Typed Contracts at Boundaries | PASS | Uses existing `FindingRow` type and `findingDetail` message type. No new types needed. |
| V. Theme Integration | N/A | No UI changes -- WebView detail component already exists. |
| VI. Security by Default | PASS | No user input in queries (finding ID comes from extension-generated data). File paths resolved via `vscode.Uri.file()`. |

**Gate result**: PASS -- no violations.

## Project Structure

### Documentation (this feature)

```text
specs/008-finding-detail-navigation/
├── plan.md              # This file
├── research.md          # Phase 0 output (confirmatory -- no unknowns)
├── data-model.md        # Phase 1 output (no new entities)
└── quickstart.md        # Phase 1 output (developer quickstart)
```

### Source Code (repository root)

```text
workbench/vsix/src/
├── services/
│   └── findings.ts                    # MODIFY: Add getFindingDetail() method
├── providers/
│   └── findingsPanelManager.ts        # MODIFY: Replace inline DB call with service call
└── test/unit/
    └── findings.test.ts               # MODIFY: Add test for getFindingDetail()
```

**Structure Decision**: No new files or directories. All changes are modifications to existing files in the established project structure. The `getFindingDetail()` method follows the same pattern as `getFindings()` already in `FindingsService`.

## Design Decisions

### D1: Add getFindingDetail() to FindingsService

The `selectFinding` handler in `findingsPanelManager.ts` currently calls `this.db.finding.findUnique()` directly (line 159). The constitution states: "Domain queries MUST go through service classes (`FindingsService`), not inline Prisma calls in providers."

The fix is straightforward: add a `getFindingDetail(findingId: string): Promise<FindingRow | null>` method to `FindingsService` that wraps `db.finding.findUnique()` + `mapFindingToRow()`.

**Alternative rejected**: Leaving the inline call. It works but violates the established convention and creates inconsistency -- `getFindings()` goes through the service but `getFindingDetail()` doesn't.

### D2: Return Type is FindingRow | null

`getFindingDetail()` returns `FindingRow | null` rather than throwing on not-found. This matches the graceful handling required by FR-007 -- the panel manager checks for null and can send an appropriate message to the WebView.

### D3: No Changes to Code Navigation

The existing `navigateToCode` handler (lines 227-242) already:
- Receives `filePath` and `startLine` from the WebView message
- Creates a `vscode.Uri.file()` from the path
- Checks file existence via `vscode.workspace.fs.stat()`
- Opens the file with `vscode.window.showTextDocument()` and a selection range
- Shows a helpful "File not found" message on failure

This handler is complete and correct. With real SARIF data (from scans against actual code), the file paths will correspond to real workspace files. No changes needed.

### D4: No New Message Types

The existing message protocol already includes:
- `WebviewToExtMessage`: `selectFinding` (sends `findingId`)
- `ExtToWebviewMessage`: `findingDetail` (sends `FindingRow`)
- `WebviewToExtMessage`: `navigateToCode` (sends `filePath`, `startLine`)

All message types are already defined and in use. No additions required.

## Modification Details

### `findings.ts` -- Changes

Add one new method to `FindingsService`:

```typescript
async getFindingDetail(findingId: string): Promise<FindingRow | null> {
  const finding = await this.db.finding.findUnique({
    where: { id: findingId },
  });
  if (!finding) {
    return null;
  }
  return mapFindingToRow(finding);
}
```

This follows the same pattern as `getFindings()` -- query via Prisma, map through `mapFindingToRow()`.

### `findingsPanelManager.ts` -- Changes

Replace the `selectFinding` case (lines 158-165):

**Before**:
```typescript
case 'selectFinding': {
  const finding = await this.db.finding.findUnique({
    where: { id: message.payload.findingId },
  });
  if (finding) {
    this.panel?.webview.postMessage({ type: 'findingDetail', payload: mapFindingToRow(finding) });
  }
  break;
}
```

**After**:
```typescript
case 'selectFinding': {
  if (this.findingsService) {
    const detail = await this.findingsService.getFindingDetail(message.payload.findingId);
    if (detail) {
      this.panel?.webview.postMessage({ type: 'findingDetail', payload: detail });
    }
  }
  break;
}
```

This removes the direct `this.db` call and the `mapFindingToRow` import dependency from the panel manager (for this specific case). The `db` constructor parameter and `mapFindingToRow` import may still be needed for other handlers -- check before removing.

### `findings.test.ts` -- Changes

Add tests for `getFindingDetail()`:

1. **Test: returns FindingRow for existing finding** -- Create a finding via DB, call `getFindingDetail()`, verify all fields match
2. **Test: returns null for non-existent finding ID** -- Call with a random UUID, verify null returned

## Post-Design Constitution Re-Check

| Principle | Status | Notes |
|-----------|--------|-------|
| I. VS Code Native | PASS | No external dependencies |
| II. Extension Host Owns State | PASS | Query in service, result pushed to WebView |
| III. Ship Fast / Simplicity First | PASS | One method, one handler change, two tests |
| IV. Typed Contracts at Boundaries | PASS | Existing types, no new messages |
| V. Theme Integration | N/A | No UI changes |
| VI. Security by Default | PASS | No user input in queries |

**Re-check result**: PASS -- no violations, no complexity tracking needed.
