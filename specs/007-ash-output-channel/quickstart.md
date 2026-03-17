# Quickstart: ASH Console Output Channel

**Branch**: `007-ash-output-channel` | **Date**: 2026-03-17

## What This Feature Does

Adds a VS Code Output Channel named "ASH" that streams raw CLI output during scan execution. The channel shows a scan header, real-time stdout/stderr, and a footer with scan results.

## Files to Modify

| File | Change |
|------|--------|
| `vsix/src/extension.ts` | Create OutputChannel, push to subscriptions, pass to ScannerService |
| `vsix/src/services/scanner.ts` | Accept OutputChannel, clear/header/pipe/footer logic |
| `vsix/src/test/unit/scanner.test.ts` | Add Output Channel integration tests |

## Implementation Order

1. **`extension.ts`**: Create `vscode.window.createOutputChannel('ASH')`, push to `context.subscriptions`, pass as 4th arg to `ScannerService` constructor
2. **`scanner.ts` constructor**: Add optional `outputChannel` parameter, store as instance field, add `scanStartTime` field
3. **`scanner.ts` line buffer**: Add private `createLineBuffer()` helper method
4. **`scanner.ts` startScan()**: Clear channel, show with preserveFocus, write header
5. **`scanner.ts` executeScan()**: Pipe stdout/stderr through line buffers to channel, write footer on exit/error, flush buffers on close
6. **`scanner.ts` cancelScan()**: Write cancelled footer with duration
7. **`scanner.test.ts`**: Add test suite for channel integration (11 tests)

## How to Verify

1. `cd workbench/vsix && npm run compile` — should compile without errors
2. `npm run test` — all existing tests pass, new channel tests pass
3. Press F5 in VS Code to launch extension development host
4. Trigger a scan from the sidebar
5. Observe: "ASH" appears in Output panel dropdown, header appears, CLI output streams in real time, footer appears on completion

## Key Design Choices

- **Optional constructor param** (not setter): Channel is a service-lifetime dependency
- **Plain OutputChannel** (not LogOutputChannel): Preserves raw CLI formatting
- **Clear on each scan**: KISS — no session history (per clarification)
- **Line buffering**: Handles partial chunks from child process data events
- **`show(true)`**: Reveals channel without stealing editor focus
