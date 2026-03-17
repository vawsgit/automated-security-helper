# Feature Specification: ASH Console Output Channel

**Feature Branch**: `007-ash-output-channel`
**Created**: 2026-03-17
**Status**: Draft
**Input**: User description: "ASH Console Output Channel for real-time CLI streaming"

## Clarifications

### Session 2026-03-17

- Q: Should the Output Channel accumulate scan session history across consecutive runs? → A: No. Clear the channel on each new scan; only show the last run's output. KISS.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Real-Time Scan Output Visibility (Priority: P1)

As a developer running a security scan, I want to see the raw ASH CLI output streaming in real time so that I can monitor scanner-by-scanner progress and understand exactly what the tool is doing.

**Why this priority**: This is the core value proposition of the feature. Without real-time streaming, the Output Channel is just an empty panel. Seeing live output transforms the extension from a black box into a transparent tool, which is the primary motivation for this feature.

**Independent Test**: Can be fully tested by triggering a scan and observing that CLI stdout appears line-by-line in the "ASH" Output Channel as the process runs.

**Acceptance Scenarios**:

1. **Given** a scan is initiated from any trigger (sidebar, command palette, context menu, findings panel), **When** the ASH CLI process starts, **Then** an "ASH" Output Channel is revealed in the Panel area without stealing keyboard focus from the editor.
2. **Given** the ASH CLI is producing stdout during a scan, **When** each line is emitted, **Then** the line appears in the Output Channel in real time, preserving the original text.
3. **Given** the ASH CLI produces stderr output during a scan, **When** each stderr line is emitted, **Then** the line appears in the Output Channel prefixed with `[stderr]` for visual distinction from stdout.

---

### User Story 2 - Scan Session Context (Priority: P1)

As a developer reviewing scan output, I want each scan session to display a clear header and footer so that I can understand what was scanned, how long it took, and what the outcome was.

**Why this priority**: Without session context, raw output is hard to interpret. The header confirms which target and command are being run; the footer confirms the result. This is essential for interpreting scan output and debugging failures.

**Independent Test**: Can be fully tested by triggering a scan and verifying the header appears before CLI output and the footer appears after the process exits, with accurate metadata.

**Acceptance Scenarios**:

1. **Given** a scan is starting, **When** the ASH CLI process is about to be spawned, **Then** a header block appears in the Output Channel showing the target path, timestamp, and full command invocation with all arguments.
2. **Given** a scan completes successfully, **When** the process exits, **Then** a footer block appears showing "COMPLETED" status, scan duration, and finding count.
3. **Given** a scan fails (non-zero exit code other than cancellation), **When** the process exits, **Then** a footer block appears showing "FAILED" status, duration, and the error description.
4. **Given** a scan is cancelled by the user, **When** the process is terminated, **Then** a footer block appears showing "CANCELLED" status and duration.

---

### User Story 3 - Error Surfacing for Missing CLI (Priority: P2)

As a developer who has not installed the ASH CLI, I want to see a clear error message in the Output Channel when the CLI cannot be found so that I understand why the scan failed and what to do about it.

**Why this priority**: This is a common first-run scenario. Surfacing the ENOENT error in the Output Channel (alongside any existing notification) ensures the user has a persistent, visible record of the problem.

**Independent Test**: Can be fully tested by configuring a non-existent ASH CLI path and triggering a scan, then verifying the Output Channel displays an error about the missing executable.

**Acceptance Scenarios**:

1. **Given** the ASH CLI is not installed or not found at the configured path, **When** the user triggers a scan, **Then** the Output Channel displays an error message indicating the CLI executable was not found.

---

### Edge Cases

- What happens when the ASH CLI produces extremely long lines (e.g., minified file paths, base64 blobs)? The Output Channel renders them as-is; no truncation is applied by the extension.
- What happens when stdout and stderr arrive interleaved rapidly? Lines are appended in the order received; no reordering or buffering is applied beyond splitting on newline boundaries.
- What happens when the child process emits partial lines (data chunks that don't end with a newline)? The extension buffers partial lines and only appends to the channel when a complete line (ending with a newline) is available, flushing any remaining partial line on process exit.
- What happens if a scan is triggered while a previous scan is still running? The existing scan-in-progress guard prevents this; the Output Channel is not affected.
- What happens when the extension is deactivated (e.g., VS Code window closes)? The Output Channel is disposed automatically via `context.subscriptions`.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST create a named Output Channel titled "ASH" that appears in the VS Code Output panel dropdown after extension activation.
- **FR-002**: System MUST reveal the ASH Output Channel when a scan starts, without stealing keyboard focus from the active editor (preserve focus).
- **FR-003**: System MUST display a scan header at the start of each scan session containing: the scan target path, timestamp, and full CLI command with arguments.
- **FR-004**: System MUST stream raw stdout from the ASH CLI child process to the Output Channel line-by-line in real time.
- **FR-005**: System MUST stream raw stderr from the ASH CLI child process to the Output Channel, with each line prefixed by `[stderr]`.
- **FR-006**: System MUST display a scan footer when a scan completes successfully, showing: "COMPLETED" status, scan duration, and finding count.
- **FR-007**: System MUST display a scan footer when a scan fails, showing: "FAILED" status, scan duration, and error description.
- **FR-008**: System MUST display a scan footer when a scan is cancelled, showing: "CANCELLED" status and scan duration.
- **FR-009**: System MUST display an error message in the Output Channel when the ASH CLI executable cannot be found (ENOENT or equivalent spawn error).
- **FR-010**: System MUST clear the Output Channel at the start of each new scan, so the channel only displays the output of the most recent scan.
- **FR-011**: System MUST dispose the Output Channel when the extension is deactivated.
- **FR-012**: System MUST buffer partial lines from stdout/stderr and only append complete lines to the channel, flushing any remaining partial line when the process exits.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can see the ASH Output Channel in the Output panel dropdown immediately after extension activation, with zero additional configuration.
- **SC-002**: Users can observe CLI output appearing in the Output Channel within 1 second of the ASH CLI emitting each line.
- **SC-003**: Users can identify the target, time, and command of any scan session by reading the scan header without scrolling through raw output.
- **SC-004**: Users can determine the outcome (success, failure, cancellation) and duration of any scan by reading the scan footer.
- **SC-005**: Users can distinguish stderr lines from stdout lines at a glance via the `[stderr]` prefix.
- **SC-006**: Users see only the most recent scan's output in the Output Channel, with no stale output from prior scans.
- **SC-007**: The Output Channel never steals keyboard focus from the active editor when revealed during scan start.
- **SC-008**: Users who encounter a missing ASH CLI see a clear error message in the Output Channel explaining the failure, enabling self-service troubleshooting.

## Assumptions

- The ASH CLI produces line-oriented output on both stdout and stderr (not binary or structured data).
- The existing scan-in-progress guard ensures only one scan runs at a time, so there is no need to handle concurrent scan output interleaving in the channel.
- The Output Channel is cleared at the start of each scan; no cross-session history is maintained.
- The finding count for the footer can be derived from the scan result already available in the existing `executeScan()` flow (e.g., from SARIF parsing results or the scan outcome object).
- The scan duration can be calculated from timestamps captured at scan start and end within the existing service.
- No new VS Code commands or `package.json` contribution points are needed; Output Channels do not require declaration.
- No VS Code settings are needed for this feature (no auto-show toggle, no verbosity control).

## Dependencies

- **Spec 004 (Scanner Service)**: The `ScannerService` owns the child process and is where stdout/stderr piping must be added.
- **Spec 005 (Scan Execution E2E)**: The end-to-end scan wiring ensures scan triggers flow through `ScannerService`, which is where the Output Channel is written to.

## Out of Scope

- Custom "Show ASH Output" command — VS Code's built-in Output panel dropdown handles channel selection.
- WebView changes — the Output Channel is a native VS Code panel, separate from the React WebView.
- Settings for controlling channel behavior (auto-show, verbosity levels) — simplicity is preferred for this iteration.
- LogOutputChannel — raw CLI output is displayed without timestamps or log-level prefixes.
- Changes to the `onProgress` callback or WebView progress display — both mechanisms coexist independently.
- Scan session history accumulation — the channel is cleared on each new scan for simplicity; only the last run is visible.
