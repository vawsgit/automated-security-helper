# Implementation Plan: ASH Console Output Channel

**Branch**: `007-ash-output-channel` | **Date**: 2026-03-17 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/007-ash-output-channel/spec.md`

## Summary

Add a VS Code Output Channel named "ASH" that streams raw CLI stdout/stderr in real time during scan execution. The channel is created in `extension.ts`, passed to `ScannerService`, cleared on each new scan, and displays a header (target, timestamp, command) before output and a footer (status, duration, findings count) after completion. This requires modifications to two existing files only — no new files, no new commands, no `package.json` changes.

## Technical Context

**Language/Version**: TypeScript / ES2022 target, Node16 modules, strict mode
**Primary Dependencies**: VS Code API (`vscode.window.createOutputChannel`, `OutputChannel`), Node.js `child_process` (existing)
**Storage**: N/A — Output Channel is ephemeral (in-memory, VS Code managed)
**Testing**: Mocha (unit, Node.js) + sinon for mocking. Existing `scanner.test.ts` uses `createMockProcess()` with EventEmitter-based stdout/stderr
**Target Platform**: VS Code ^1.110.0
**Project Type**: VS Code extension
**Performance Goals**: <1s latency from CLI line emission to Output Channel display (SC-002)
**Constraints**: No new files. Modifies `extension.ts` and `scanner.ts` only. OutputChannel parameter is optional to preserve test backward compatibility
**Scale/Scope**: Single Output Channel, single concurrent scan (enforced by existing guard)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Evidence |
|-----------|--------|----------|
| I. VS Code Native | PASS | `OutputChannel` is a first-class VS Code API. Pushed to `context.subscriptions` for disposal. No contribution point declaration needed. |
| II. Extension Host Owns State | PASS | Channel is entirely extension-host-side. No WebView involvement. |
| III. Ship Fast / Simplicity First | PASS | No new files, no abstractions, no settings. Channel cleared on each scan (KISS). |
| IV. Typed Contracts at Boundaries | PASS | `OutputChannel` type from `vscode` API. No new boundary types needed. |
| V. Theme Integration | N/A | Output Channel is plain text — no styling, no theme tokens. |
| VI. Security by Default | PASS | No user input concatenation. Command args displayed in header are the same args passed to `spawn()` (already safe). No WebView CSP concerns. |

**Gate result**: PASS — no violations.

## Project Structure

### Documentation (this feature)

```text
specs/007-ash-output-channel/
├── plan.md              # This file
├── research.md          # Phase 0 output (no unknowns — confirms decisions)
├── data-model.md        # Phase 1 output (no new entities)
└── quickstart.md        # Phase 1 output (developer quickstart)
```

### Source Code (repository root)

```text
workbench/vsix/src/
├── extension.ts                        # MODIFY: Create OutputChannel, push to subscriptions, pass to ScannerService
├── services/
│   └── scanner.ts                      # MODIFY: Accept OutputChannel, clear/write header/pipe stdout+stderr/write footer
└── test/unit/
    └── scanner.test.ts                 # MODIFY: Add tests for Output Channel integration
```

**Structure Decision**: No new files or directories. All changes are modifications to existing files in the established project structure. The OutputChannel is a VS Code primitive — it needs no wrapper, no service class, no abstraction.

## Design Decisions

### D1: OutputChannel as Optional Constructor Parameter

The `ScannerService` constructor gains an optional `outputChannel?: vscode.OutputChannel` parameter (after the existing optional `spawnFn`). This preserves backward compatibility — existing tests that don't pass a channel continue to work. The channel methods (`clear()`, `appendLine()`, `show()`) are only called when the channel is present (guarded by `if (this.outputChannel)`).

**Alternative rejected**: Setter method (like `setFindingsService()` on providers). The channel is a constructor-time dependency that should be available for the entire service lifetime, not set later. The setter pattern is used for providers because they're created before services are wired, but `ScannerService` is created in `activate()` alongside the channel.

### D2: Partial Line Buffering

Node.js `data` events on child process streams deliver arbitrary byte chunks that may not align to newline boundaries. A simple line buffer accumulates data and emits complete lines:

- Maintain a `string` buffer per stream (stdout, stderr)
- On each `data` event, append decoded text to buffer, split on `\n`
- All complete lines (all splits except the last) are appended to the channel immediately
- The last split (which may be a partial line) stays in the buffer
- On process `close` event, flush any remaining buffer content as a final line

This is implemented as a private helper method within `ScannerService`, not a separate class.

### D3: Header and Footer Format

Based on the ad-hoc spec input, using box-drawing characters for visual structure:

**Header** (written in `startScan()` after channel clear):
```
════════════════════════════════════════════════════════════
ASH Scan Started
  Target:  /path/to/project
  Time:    2026-03-17T10:30:45.123Z
  Command: ash --source-dir /path --output-dir /tmp/ash-xxx --output-formats sarif --color false --progress
════════════════════════════════════════════════════════════
```

**Footer — completed** (written after SARIF processing):
```
────────────────────────────────────────────────────────────
ASH Scan Completed
  Status:   COMPLETED
  Duration: 45s
  Findings: 12
────────────────────────────────────────────────────────────
```

**Footer — failed** (written on error/non-zero exit):
```
────────────────────────────────────────────────────────────
ASH Scan Failed
  Status:   FAILED
  Duration: 2s
  Error:    Scanner exited with code 1
────────────────────────────────────────────────────────────
```

**Footer — cancelled** (written in `cancelScan()`):
```
────────────────────────────────────────────────────────────
ASH Scan Cancelled
  Duration: 15s
────────────────────────────────────────────────────────────
```

### D4: Duration Calculation

`executeScan()` already captures `const startTime = Date.now()` (line 218). Duration is `Math.floor((Date.now() - startTime) / 1000)` formatted as `Xs` or `Xm Ys` for longer scans. The `startTime` needs to be accessible for the footer — it's already in scope within `executeScan()`. For `cancelScan()`, the start time needs to be stored as an instance field.

### D5: Finding Count for Footer

On successful completion (exit 0 or 2), the finding count is already computed in `executeScan()` as `findingsCount` (line 308) before the scan record update. The footer is written after SARIF parsing, using this existing variable. No additional queries needed.

### D6: Channel Reveal Timing

`channel.show(true)` is called once at the start of each scan (in `startScan()`, after `clear()`). The `true` parameter means "preserve focus" — the editor keeps keyboard focus while the Output panel becomes visible. The channel is NOT re-shown during scan execution or on footer write.

## Modification Details

### `extension.ts` — Changes

1. Create the Output Channel: `const ashChannel = vscode.window.createOutputChannel('ASH');`
2. Push to `context.subscriptions`: `context.subscriptions.push(ashChannel);`
3. Pass to `ScannerService` constructor: `new ScannerService(db, project.id, undefined, ashChannel)`

Insert after the database/project initialization, before the scanner creation (around line 46).

### `scanner.ts` — Changes

**Constructor** (line 53):
- Add optional `outputChannel` parameter: `constructor(db, projectId, spawnFn?, outputChannel?)`
- Store as `private readonly outputChannel: vscode.OutputChannel | undefined`
- Import `OutputChannel` type from `vscode` (conditional require pattern already used in `getConfig()`)

**New instance field**:
- `private scanStartTime: number | null = null` — for duration calculation in `cancelScan()`

**`startScan()` method** (line 95):
- After `this.cancelled = false` (line 135): Store `this.scanStartTime = Date.now()`
- After `this.currentTempDir = tempDir` (line 143): If channel exists:
  - `channel.clear()`
  - `channel.show(true)` (preserve focus)
  - Write header block (target path, ISO timestamp, full command with args)

**`executeScan()` method** (line 193):
- After `const proc = this.spawnFn(...)` (line 214): Add stdout piping with line buffer
  - `proc.stdout.on('data', ...)` → buffer, split lines, `channel.appendLine(line)`
- Modify existing stderr handler (line 221-225): In addition to pushing to `stderrChunks`, also pipe to channel with `[stderr]` prefix using same line-buffer pattern
- After successful SARIF processing (line 323 area): Write completed footer with status, duration, finding count
- After failed exit (line 333-334 area): Write failed footer with status, duration, error message
- On `proc.on('error')` (line 245): Write error to channel, then write failed footer
- On `proc.on('close')`: Flush remaining partial line buffers

**`cancelScan()` method** (line 166):
- After `this.currentProcess.kill('SIGTERM')` (line 172): Write cancelled footer using `this.scanStartTime` for duration

**New private helper**:
- `private createLineBuffer(prefix?: string): (chunk: Buffer) => void` — returns a closure that buffers chunks, splits on `\n`, calls `this.outputChannel?.appendLine()` for each complete line. The optional `prefix` parameter prepends `[stderr] ` to each line for stderr.

### `scanner.test.ts` — Changes

Add a new `describe('Output Channel integration')` block:

1. **Test: channel.clear() called at scan start** — Pass a mock OutputChannel (sinon stub), start scan, verify `clear()` called once.
2. **Test: channel.show(true) called at scan start** — Verify `show` called with `true` (preserveFocus).
3. **Test: header written before process output** — Verify `appendLine` calls include target path, timestamp, and command args.
4. **Test: stdout piped to channel** — Emit data on mock `proc.stdout`, verify `appendLine` called with the emitted text.
5. **Test: stderr piped with [stderr] prefix** — Emit data on mock `proc.stderr`, verify `appendLine` called with `[stderr]` prefix.
6. **Test: completed footer written** — Complete scan (exit 0), verify footer includes "COMPLETED", duration, finding count.
7. **Test: failed footer written** — Fail scan (exit 1), verify footer includes "FAILED" and error.
8. **Test: cancelled footer written** — Cancel scan, verify footer includes "CANCELLED" and duration.
9. **Test: ENOENT error written to channel** — Emit ENOENT error, verify error message appears in channel.
10. **Test: partial line buffering** — Emit data chunks that split across newline boundaries, verify only complete lines are appended until flush.
11. **Test: no channel (backward compat)** — Construct ScannerService without channel, start scan, verify no errors thrown.

Mock OutputChannel: `{ appendLine: sinon.stub(), append: sinon.stub(), clear: sinon.stub(), show: sinon.stub(), hide: sinon.stub(), dispose: sinon.stub(), name: 'ASH', replace: sinon.stub() }`

## Post-Design Constitution Re-Check

| Principle | Status | Notes |
|-----------|--------|----------|
| I. VS Code Native | PASS | OutputChannel API, pushed to subscriptions |
| II. Extension Host Owns State | PASS | All channel logic in vsix/src/, no WebView changes |
| III. Ship Fast / Simplicity First | PASS | 2 files modified, 1 test file updated, no new abstractions |
| IV. Typed Contracts at Boundaries | PASS | OutputChannel type from vscode, no new message types |
| V. Theme Integration | N/A | Plain text output |
| VI. Security by Default | PASS | No user input in channel content beyond what's already sanitized for spawn() |

**Re-check result**: PASS — no violations, no complexity tracking needed.
