# Research: Finding Detail & Code Navigation

**Branch**: `008-finding-detail-navigation` | **Date**: 2026-03-17

## Summary

No unknowns identified. All technical decisions are confirmatory -- the patterns, types, and infrastructure already exist from Specs 004-006.

## Findings

### R1: FindingsService Pattern (Confirmatory)

**Decision**: Add `getFindingDetail()` to the existing `FindingsService` class.

**Rationale**: The service-layer pattern is established by the constitution ("Domain queries MUST go through service classes") and implemented in Spec 006. `getFindings()`, `getSummary()`, `getScanSummaries()`, and `getScanTargets()` all follow the same pattern: Prisma query + mapper function.

**Alternatives considered**: None -- the convention is clear and no deviation is warranted.

### R2: Code Navigation Handler (Confirmatory)

**Decision**: No changes to the existing `navigateToCode` handler in `findingsPanelManager.ts`.

**Rationale**: The handler (lines 227-242) already implements all requirements:
- File path resolution via `vscode.Uri.file()`
- File existence check via `vscode.workspace.fs.stat()`
- Editor opening via `vscode.window.showTextDocument()` with selection range
- Graceful "File not found" message on missing files

With real SARIF data from actual scans, the file paths stored in findings correspond to real workspace files. The handler is complete.

**Alternatives considered**: Adding workspace-relative path resolution (`path.join(project.rootPath, filePath)`). Rejected because the SARIF parser already stores absolute paths in the Finding record, and the handler receives the raw `filePath` from the WebView message which matches the stored absolute path.

### R3: Message Protocol (Confirmatory)

**Decision**: No new message types needed.

**Rationale**: The typed message protocol already defines:
- `selectFinding` (WebView -> Extension): `{ findingId: string }`
- `findingDetail` (Extension -> WebView): `FindingRow`
- `navigateToCode` (WebView -> Extension): `{ filePath: string; startLine: number }`

All three are already in `models/messages.ts` and implemented in handlers. No protocol changes required.
