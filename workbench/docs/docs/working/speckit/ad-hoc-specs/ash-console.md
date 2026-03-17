---
title: "Ad-Hoc Spec Input: ASH Console Output Channel"
---

# ASH Console Output Channel

**Phase**: Observability / Developer Experience
**Dependencies**: Spec 4 (Scanner Service — owns the child process), Spec 5 (Scan Execution E2E — wires scan triggers)

## What It Builds

A VS Code **Output Channel** named "ASH" that appears in the bottom Panel area as a sibling to Terminal, Problems, Debug Console, etc. During scan execution, the channel streams the raw stdout and stderr from the ASH CLI child process in real time. Between scans, the channel retains a scrollable log of all scan sessions from the current VS Code window lifetime.

This is the single most important observability feature for the extension: it makes the ASH CLI execution transparent, shows scanner-by-scanner progress messages as they happen, surfaces errors in their original form, and confirms to the user that the extension is running a real local tool — not a black box.

## Why This Matters

1. **Transparency**: Users can see the exact CLI invocation and its raw output, confirming the extension runs the local `ash` command they installed.
2. **Debugging**: When scans fail, the raw stderr is visible immediately — no need to dig through notification popups or database records. The user can copy/paste the output for bug reports.
3. **Progress visibility**: ASH prints scanner names and progress to stdout as it runs. Showing this gives richer feedback than the generic "Scanning..." status currently shown in the WebView progress view.
4. **Parity with CLI users**: Users familiar with running `ash` from the terminal expect to see the same output. The Output Channel provides exactly that experience.

## VS Code Mechanism

This feature uses the **Output Channel API** (`vscode.window.createOutputChannel()`), NOT a Terminal or Webview. Output Channels:

- Appear in the Panel area under the "Output" tab, selectable from a dropdown (e.g., "ASH", "Git", "TypeScript", etc.)
- Are read-only text streams — the user cannot type into them
- Support `appendLine()` for streaming text and `clear()` for resetting
- Can be revealed with `show(preserveFocus)` — `show(true)` brings the channel visible without stealing keyboard focus from the editor
- Are disposable and MUST be pushed to `context.subscriptions`
- Persist across scan executions within the same VS Code session (no need for explicit history management)

A plain `OutputChannel` (not `LogOutputChannel`) is the correct choice because:
- We want raw, unformatted CLI output — `LogOutputChannel` prepends timestamps and log levels which would corrupt the ASH CLI's own formatting
- The channel shows CLI output, not extension-internal diagnostics

## Implementation Scope

### New code to create

**Nothing new.** This feature modifies existing files only. The Output Channel is created in `extension.ts` and passed to `ScannerService`.

### Existing files to modify

**`vsix/src/extension.ts`**:
- Create the Output Channel: `vscode.window.createOutputChannel('ASH')`
- Push to `context.subscriptions` for disposal
- Pass the channel to `ScannerService` (new constructor parameter or setter method)

**`vsix/src/services/scanner.ts`**:
- Accept an `OutputChannel` (via constructor parameter or setter, following the existing setter pattern used by providers)
- In `executeScan()`, before spawning the process:
  - Write a scan header: separator line, timestamp, target path, and the full command + args being invoked (e.g., `> ash --source-dir /path --output-dir /tmp/ash-xxx --output-formats sarif --color false --progress`)
  - Reveal the channel with `show(true)` (preserves editor focus)
- Pipe `proc.stdout` data events to `channel.appendLine()` as raw text (split on newlines to avoid partial-line buffering issues)
- Pipe `proc.stderr` data events to `channel.appendLine()` — prefix each line with `[stderr]` for visual distinction
- On process exit, write a footer: status (completed/failed/cancelled), duration, finding count
- On process error (ENOENT, etc.), write the error message to the channel

**`vsix/src/providers/sidebarWebviewProvider.ts`** and **`vsix/src/providers/findingsPanelManager.ts`**:
- No changes needed. The Output Channel is owned by `ScannerService`, not by providers. The existing scan execution flow in these providers calls `scanner.startScan()` which internally writes to the channel.

### What is NOT in scope

- No new commands (no "Show ASH Output" command — VS Code's built-in Output panel dropdown already handles channel selection)
- No `package.json` changes — Output Channels do not require contribution point declarations
- No WebView changes — the Output Channel is a native VS Code panel, separate from the React WebView
- No settings for controlling channel behavior (auto-show, verbosity) — keep it simple for now
- No LogOutputChannel — we want raw CLI output, not structured logging
- No changes to the `onProgress` callback or WebView progress display — both mechanisms coexist. The Output Channel shows raw detail; the WebView shows summarized status

## What Gets Displayed in the Channel

```
════════════════════════════════════════════════════════════
ASH Scan Started
  Target: /Users/dev/my-project
  Time:   2026-03-17T10:30:45.123Z
  Command: ash --source-dir /Users/dev/my-project --output-dir /tmp/ash-scan-abc123 --output-formats sarif --color false --progress
════════════════════════════════════════════════════════════
[raw stdout line 1 from ASH CLI]
[raw stdout line 2 from ASH CLI]
...
[stderr] WARNING: some warning from ASH
...
────────────────────────────────────────────────────────────
ASH Scan Completed
  Status:   COMPLETED
  Duration: 45s
  Findings: 12
────────────────────────────────────────────────────────────
```

For errors:
```
════════════════════════════════════════════════════════════
ASH Scan Started
  Target: /Users/dev/my-project
  ...
════════════════════════════════════════════════════════════
[stderr] Error: Python module not found
────────────────────────────────────────────────────────────
ASH Scan Failed
  Status:   FAILED
  Duration: 2s
  Error:    Scanner exited with code 1
────────────────────────────────────────────────────────────
```

For cancellation:
```
────────────────────────────────────────────────────────────
ASH Scan Cancelled
  Duration: 15s
────────────────────────────────────────────────────────────
```

## Acceptance Criteria

1. An "ASH" entry appears in the Output panel dropdown after extension activation
2. When a scan starts (from any trigger: sidebar, command palette, context menu, findings panel), the ASH Output Channel is revealed (without stealing focus) and shows the scan header with timestamp, target path, and full command invocation
3. Raw stdout from the ASH CLI appears in the channel line-by-line as the process runs
4. Raw stderr from the ASH CLI appears in the channel with a `[stderr]` prefix
5. When the scan completes, a footer shows the final status, duration, and finding count
6. When the scan fails, the footer shows the error message
7. When the scan is cancelled, the footer shows cancellation status and duration
8. When the ASH CLI is not found (ENOENT), the error message appears in the channel
9. Multiple consecutive scans append to the same channel with clear visual separators between sessions
10. The channel does not steal keyboard focus from the editor (uses `show(true)` / `preserveFocus`)
11. The Output Channel is disposed on extension deactivation (pushed to `context.subscriptions`)

## References

- `vsix/src/services/scanner.ts` — `executeScan()` method (lines 193-337): spawns the child process, handles stdout/stderr, manages exit codes. This is where stdout/stderr piping MUST be added.
- `vsix/src/services/scanner.ts` — `startScan()` method (lines 95-164): public API that calls `executeScan()`. The channel reveal and header should happen here before the spawn.
- `vsix/src/services/scanner.ts` — `cancelScan()` method (lines 166-191): sends SIGTERM. The cancellation footer should be written here.
- `vsix/src/extension.ts` — `activate()` function (lines 12-125): creates all services. The Output Channel should be created here and passed to ScannerService.
- VS Code API: `vscode.window.createOutputChannel(name)` returns `OutputChannel` with `appendLine()`, `append()`, `clear()`, `show(preserveFocus?)`, `dispose()`
- VS Code Extension Reference: `docs/docs/developer-docs/reference/vscode-extension-reference.md` lines 980-992 (Output Channel section)
- Constitution Principle I (VS Code Native): Output Channels are the VS Code-native way to show extension output — no custom UI needed
- Constitution Principle II (Extension Host Owns State): The channel is entirely extension-host-side; no WebView involvement
