# Feature Specification: Scan Execution End-to-End

**Feature Branch**: `005-scan-execution-e2e`
**Created**: 2026-03-16
**Status**: Draft
**Input**: User description: "Scan Execution End-to-End — wire the full scan flow from user interaction through ASH execution, result parsing, and state updates back to the UI."

## Clarifications

### Session 2026-03-16

- Q: When a scan starts from the command palette or context menu, should the findings panel open immediately or only after completion? → A: Open immediately at scan start, showing progress then results on completion.
- Q: Which WebViews should receive scanProgress messages during a running scan? → A: Both the findings panel and the sidebar receive scanProgress messages.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Run Scan from Command Palette (Priority: P1)

A user opens the VS Code command palette and runs "ASH: Start Scan". The extension presents a target picker showing existing scan targets, the workspace root, and a custom path option. After selecting a target, the extension spawns the ASH CLI, creates a scan record, and on completion stores findings in the database. The findings panel opens with the new results.

**Why this priority**: This is the primary entry point for scan execution. Without this, no scan can be triggered. It validates the entire pipeline from user action through CLI execution to result display.

**Independent Test**: Trigger "ASH: Start Scan" from the command palette, select a target folder, and verify that a scan runs, findings are stored, and results appear in the findings panel.

**Acceptance Scenarios**:

1. **Given** the extension is active and no scan is running, **When** the user runs "ASH: Start Scan" from the command palette, **Then** a target picker dialog appears showing the workspace root, any previously scanned targets, and a "Browse..." option for custom paths.
2. **Given** a target is selected from the picker, **When** the scan starts, **Then** the findings panel opens immediately showing a scanning state with progress updates.
3. **Given** a scan is running and the findings panel is showing progress, **When** the scan completes successfully, **Then** the findings panel updates to show the scan results, the scan tree view refreshes with the new scan entry, and the sidebar state updates to reflect the latest scan.
4. **Given** a target is selected from the picker, **When** the scan fails (ASH error or timeout), **Then** an error message is shown to the user and the scan record is marked FAILED in the database.

---

### User Story 2 - Run Scan from Explorer Context Menu (Priority: P1)

A user right-clicks a folder in the VS Code Explorer and selects "ASH: Run Security Scan". The extension uses the selected folder's path as the scan target and starts a scan immediately without presenting a picker dialog. Results flow through the same pipeline as a command palette scan.

**Why this priority**: Context menu scanning is a natural entry point for folder-level security checks. It shares the execution pipeline with US1 and validates a second trigger mechanism.

**Independent Test**: Right-click a folder in the Explorer, select "ASH: Run Security Scan", and verify that the scan runs against that folder and results appear.

**Acceptance Scenarios**:

1. **Given** the extension is active and no scan is running, **When** the user right-clicks a folder and selects "ASH: Run Security Scan", **Then** a scan starts immediately using that folder's path as the target and the findings panel opens showing a scanning state with progress.
2. **Given** the context menu scan completes, **When** findings exist, **Then** the findings panel updates with results, the scan tree view refreshes, and the sidebar state updates.

---

### User Story 3 - Scan Progress Visibility (Priority: P1)

While a scan is running, the user sees real-time progress feedback in the WebView. The progress includes elapsed time and a status indicator. This keeps the user informed that the scan is active and has not stalled.

**Why this priority**: Without progress feedback, users have no way to know if a scan is actively running or has hung. This is essential for the perceived quality of the scan experience.

**Independent Test**: Start a scan and verify that progress messages appear in the WebView showing elapsed time and status text while the scan is in progress.

**Acceptance Scenarios**:

1. **Given** a scan has been started, **When** the scan is running, **Then** both the findings panel and the sidebar display progress updates showing elapsed time (updated every second) and a status text of "Scanning...".
2. **Given** a scan is displaying progress, **When** the scan completes or fails, **Then** progress updates stop and the final state (completed/failed) is reflected in the UI.

---

### User Story 4 - Cancel a Running Scan (Priority: P1)

A user wants to stop a scan that is taking too long or was started by mistake. The user can trigger cancellation from the command palette ("ASH: Cancel Scan") or from the WebView. The ASH process is terminated, the scan is marked as cancelled, and the UI returns to a ready state.

**Why this priority**: Cancellation is a critical safety valve. Without it, users are locked into waiting for a scan to finish or must restart VS Code.

**Independent Test**: Start a scan, then cancel it via command palette or WebView, and verify that the process stops, the scan status becomes CANCELLED, and the UI reflects the cancelled state.

**Acceptance Scenarios**:

1. **Given** a scan is in progress, **When** the user runs "ASH: Cancel Scan" from the command palette, **Then** the running scan process is terminated, the scan record is updated to CANCELLED, and the UI reflects the cancellation.
2. **Given** a scan is in progress, **When** the user clicks a cancel action in the WebView, **Then** a cancelScan message is sent to the extension, the process is terminated, and the WebView updates to show the scan was cancelled.
3. **Given** no scan is running, **When** the user attempts to cancel, **Then** no error occurs and the system remains in its current state.

---

### User Story 5 - Run Scan from Sidebar (Priority: P2)

A user clicks the "Scan Workspace" button in the sidebar WebView. The extension scans the workspace root folder (default target). On completion, the sidebar's scan summary and state update to reflect the new scan.

**Why this priority**: The sidebar provides a convenient one-click scan for the common case (scan the whole workspace). It is a convenience over the command palette but not strictly required for scanning to work.

**Independent Test**: Click the "Scan Workspace" button in the sidebar and verify that a scan runs against the workspace root and the sidebar state updates on completion.

**Acceptance Scenarios**:

1. **Given** the sidebar is visible and no scan is running, **When** the user clicks "Scan Workspace", **Then** a scan starts targeting the workspace root folder.
2. **Given** the sidebar-triggered scan completes, **When** results are available, **Then** the sidebar state updates with the new scan summary and any open findings panel refreshes.

---

### User Story 6 - Run Scan from Findings Panel (Priority: P2)

A user clicks "Run Scan" within the findings panel WebView. The extension triggers a scan for the currently active target. On completion, the findings panel updates in-place with the new results.

**Why this priority**: This provides a convenient rescan flow for users who are reviewing findings and want to check if issues have been fixed. It is a UX enhancement over the command palette.

**Independent Test**: Open the findings panel, click "Run Scan", and verify that a scan runs and the findings panel updates with new results.

**Acceptance Scenarios**:

1. **Given** the findings panel is open, **When** the user clicks "Run Scan" in the panel, **Then** a scan starts and the panel displays progress.
2. **Given** a scan triggered from the findings panel completes, **When** new findings are available, **Then** the findings panel updates with the new scan results without the user needing to navigate elsewhere.

---

### Edge Cases

- What happens when a scan is already running and the user triggers another scan from any entry point? The system rejects the second scan with a clear message: "A scan is already in progress."
- What happens when the workspace has no folders open? The scan commands are unavailable or show a message directing the user to open a folder.
- What happens when the user closes the findings panel while a scan is in progress? The scan continues running. When it completes, results are stored but the panel does not forcibly reopen.
- What happens when the scan target folder has been deleted between picker selection and scan start? The scanner reports a FAILED scan with an appropriate error message.
- What happens when a cancel request arrives after the scan has already completed? The cancel is a no-op; the completed results are preserved.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The `ashWorkbench.startScan` command MUST present a target picker dialog showing: existing scan targets from the database, the workspace root folder, and a "Browse..." option for custom paths.
- **FR-002**: After target selection, the command MUST open the findings panel immediately (showing a scanning state), call `ScannerService.startScan()` with the selected path, and register progress and completion handlers.
- **FR-003**: The `ashWorkbench.scanFolder` command MUST use the folder URI provided by the Explorer context menu as the scan target, bypassing the target picker, and open the findings panel immediately.
- **FR-004**: The `ashWorkbench.cancelScan` command MUST call `ScannerService.cancelScan()` for the currently running scan.
- **FR-005**: The findings panel MUST handle a `startScan` message from the WebView by calling `ScannerService.startScan()` and sending a `scanStarted` message back to the WebView.
- **FR-006**: The findings panel MUST handle a `cancelScan` message from the WebView by calling `ScannerService.cancelScan()`.
- **FR-007**: During scan execution, the extension MUST push `scanProgress` messages to both the findings panel and the sidebar WebViews, containing the scan ID, elapsed time, and status text.
- **FR-008**: On scan completion, the extension MUST push a `stateUpdate` message to the sidebar WebView with updated scan list and summary data.
- **FR-009**: On scan completion, the extension MUST push a `findingsUpdate` message to the findings panel WebView with the new scan's findings.
- **FR-010**: On scan completion, the extension MUST call `refresh()` on the scan tree provider to update the tree view.
- **FR-011**: The sidebar WebView MUST handle a `startScan` message by calling `ScannerService.startScan()` for the workspace root folder.
- **FR-012**: The message protocol MUST include a `cancelScan` variant in the WebView-to-Extension message type.
- **FR-013**: The message protocol MUST include a `scanProgress` variant in the Extension-to-WebView message type with `scanId`, `status`, and `elapsed` fields.
- **FR-014**: The WebView-to-Extension and Extension-to-WebView message types MUST be kept in sync between the extension (`vsix/src/models/messages.ts`) and the WebView (`webview/src/types/messages.ts`).
- **FR-015**: Both the findings panel and sidebar WebViews MUST handle `scanProgress` messages by updating the UI to show scan status and elapsed time.
- **FR-016**: All scan entry points (command palette, context menu, sidebar, findings panel) MUST use the same `ScannerService` instance to ensure the single-scan constraint is enforced.
- **FR-017**: When a scan is triggered while another is already running, the system MUST display a user-visible message indicating that a scan is already in progress.

### Key Entities

- **ScannerService**: The orchestrator that spawns ASH CLI processes, manages scan lifecycle, and stores results. Created during extension activation and shared across all scan entry points.
- **Message Protocol**: Discriminated union types defining the communication contract between extension host and WebView. Extended with `cancelScan` (inbound) and `scanProgress` (outbound) variants.
- **Scan Target Picker**: A VS Code quick-pick dialog that presents scan target options to the user, combining database-stored targets with workspace defaults and a browse option.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can initiate a security scan from any of the four entry points (command palette, context menu, sidebar, findings panel) and see results within the same session.
- **SC-002**: Scan progress is visible in the WebView within 2 seconds of scan start and updates every second until completion.
- **SC-003**: On scan completion, findings appear in the findings panel and the scan tree view updates without requiring manual refresh.
- **SC-004**: Cancelling a running scan terminates the process and reflects the cancelled state in the UI within 3 seconds.
- **SC-005**: All mock data and placeholder implementations in scan commands, findings panel, sidebar, and scan tree provider are replaced with real database-backed operations.
- **SC-006**: The message protocol between extension and WebView remains type-safe with no runtime type mismatches.

## Assumptions

- The `ScannerService` class from Spec 004 is fully implemented and available with `startScan()`, `cancelScan()`, and `recoverStaleScans()` methods.
- The database layer (PGLite + Prisma) is operational and can query scans, findings, and scan targets.
- The WebView (React app) has an existing reducer pattern that processes messages from the extension host.
- The existing mock data modules (`vsix/src/mock/data.ts`) will no longer be needed after this feature is complete and can be removed or left unused.
- The `ScanTreeProvider.refresh()` method already exists and correctly fires `onDidChangeTreeData`.
