# Feature Specification: Scanner Service

**Feature Branch**: `004-scanner-service`
**Created**: 2026-03-16
**Status**: Draft
**Dependencies**: Spec 1 (Database Layer), Spec 2 (SARIF Parser)

## Clarifications

### Session 2026-03-16

- Q: On next activation, should the system detect and recover stale "running" scan records left by crashes or force-quits? → A: Mark any stale "running" scans as "failed" with a crash-recovery message on activation.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Execute a Security Scan (Priority: P1)

A user initiates a security scan on a folder within their workspace. The system runs the external scanner, monitors its progress, and when the scan completes with findings, the results are parsed and stored so the user can view them later.

**Why this priority**: This is the core value of the entire product. Without scan execution and result storage, there is nothing to view, triage, or track. Every downstream feature depends on scan data existing in the system.

**Independent Test**: Initiate a scan on a project folder that contains known security issues. Verify that a scan record is created, the scanner runs, findings are parsed from the output, and the results are stored and retrievable.

**Acceptance Scenarios**:

1. **Given** a workspace with a project folder, **When** the user initiates a scan on that folder, **Then** a scan record is created with a "running" status, the external scanner process begins executing, and the scan ID is returned immediately.
2. **Given** a scan is running and the scanner finds security issues, **When** the scanner completes (exit code indicating findings), **Then** the output file is read and parsed, all findings are stored in the database, and the scan record is updated to "completed" with an accurate count and severity breakdown.
3. **Given** a scan is running and the scanner finds no issues, **When** the scanner completes (exit code indicating clean), **Then** the scan record is updated to "completed" with zero findings.

---

### User Story 2 - Cancel a Running Scan (Priority: P1)

A user decides to stop a scan that is in progress (e.g., the scan is taking too long or they realize they selected the wrong folder). The system gracefully stops the scanner process, marks the scan as cancelled, and cleans up temporary resources.

**Why this priority**: Users must have control over long-running operations. Without cancellation, a stuck or slow scan could block the user indefinitely since only one scan runs at a time.

**Independent Test**: Start a scan, then cancel it before it completes. Verify the scanner process is stopped, the scan status is updated to "cancelled", and no findings are stored.

**Acceptance Scenarios**:

1. **Given** a scan is currently running, **When** the user cancels the scan, **Then** the scanner process is terminated, the scan record is updated to "cancelled", and temporary output files are cleaned up.
2. **Given** no scan is currently running, **When** the user attempts to cancel, **Then** the system ignores the request without errors.

---

### User Story 3 - Handle Scanner Errors Gracefully (Priority: P1)

When the external scanner encounters an error (crashes, returns an error code, or is not installed), the system records the failure and shows the user a clear, actionable message instead of crashing or leaving the scan in a stuck state.

**Why this priority**: Error resilience is critical for a developer tool. The scanner is an external process that can fail in many ways. Users must always understand what happened and what to do about it.

**Independent Test**: Trigger each error condition (scanner not installed, scanner crash, invalid output). Verify the scan is marked as failed with a meaningful error message in each case.

**Acceptance Scenarios**:

1. **Given** the external scanner is not installed on the user's machine, **When** the user initiates a scan, **Then** the system detects the missing tool and shows a user-friendly message explaining how to install it, and the scan is marked as "failed."
2. **Given** a scan is running, **When** the scanner process exits with an error code, **Then** the scan record is updated to "failed" with the error output captured as the error message.
3. **Given** a scan is running, **When** the scanner process exceeds the configured timeout, **Then** the process is killed, the scan is marked as "failed" with a timeout message, and temporary files are cleaned up.

---

### User Story 4 - Scan Target Management (Priority: P1)

When a user scans a specific folder path for the first time, the system automatically creates a scan target record for that path. On subsequent scans of the same folder, the existing scan target is reused, allowing scan history to be tracked per folder.

**Why this priority**: Scan targets link scans to specific folders, enabling per-folder scan history and findings tracking. Without this, there is no way to associate scans with the folders they scanned.

**Independent Test**: Scan the same folder twice. Verify only one scan target record exists for that path, and both scan records reference it.

**Acceptance Scenarios**:

1. **Given** a folder path that has never been scanned before, **When** a scan is initiated for that path, **Then** a new scan target record is created with the folder path and a display name derived from the folder.
2. **Given** a folder path that was scanned previously, **When** a new scan is initiated for that path, **Then** the existing scan target is reused and no duplicate is created.

---

### User Story 5 - Scan Progress Feedback (Priority: P2)

While a scan is running, the user sees status updates indicating the scan is active and how long it has been running. This provides reassurance that the operation is proceeding and is not stuck.

**Why this priority**: Progress feedback is important for user experience but the scan can function correctly without it. The core scan-execute-store flow (US1) works independently of progress reporting.

**Independent Test**: Start a scan and observe that status updates are emitted during execution, including elapsed time.

**Acceptance Scenarios**:

1. **Given** a scan is in progress, **When** the system checks the scan status, **Then** it provides status updates with elapsed time information that can be displayed to the user.
2. **Given** a scan completes, **When** the final status update is emitted, **Then** it includes the completion status (completed, failed, or cancelled).

---

### User Story 6 - Single Scan Constraint (Priority: P1)

Only one scan can run at a time per project. If a user attempts to start a second scan while one is already running, the system rejects the request with a clear message. This prevents resource conflicts and ensures predictable behavior.

**Why this priority**: Running concurrent scans could cause resource contention, confusing results, and unpredictable behavior. Enforcing single-scan is a safety constraint.

**Independent Test**: Start a scan, then attempt to start another scan before the first completes. Verify the second request is rejected with a clear message.

**Acceptance Scenarios**:

1. **Given** a scan is already running for the current project, **When** the user attempts to start another scan, **Then** the system rejects the request and informs the user that a scan is already in progress.
2. **Given** a previous scan has completed (any terminal status), **When** the user starts a new scan, **Then** the new scan begins normally.

---

### Edge Cases

- What happens if the scanner output file is missing or corrupted after a successful exit? The system marks the scan as failed with an appropriate error message.
- What happens if the user closes the editor while a scan is running? The scan process continues until the extension deactivation handler kills it and marks it as cancelled.
- What happens if the temporary output directory cannot be created? The scan fails immediately with a clear error message.
- What happens if the workspace folder is deleted while a scan is running? The scanner process may fail on its own; the error is captured and the scan is marked as failed.
- What happens if the scanner produces an extremely large output file (thousands of findings)? The parser processes all findings; performance should remain acceptable for up to 10,000 findings per scan.
- What happens if the scan completes but the database write fails? The scan is marked as failed with the database error as the message.
- What happens if VS Code crashes or force-quits while a scan is running? On next activation, stale "running" scans are detected and marked as "failed" with a crash-recovery message, unblocking the single-scan constraint.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST create a scan record with a "running" status when a scan is initiated, before the scanner process starts.
- **FR-002**: System MUST spawn the external scanner as a child process with the correct source directory, output directory, and output format arguments.
- **FR-003**: System MUST read the scanner's output file after successful completion (exit codes 0 and 2) and parse it into typed finding records.
- **FR-004**: System MUST store all parsed findings in the database, linked to the scan record and project.
- **FR-005**: System MUST update the scan record to "completed" with findings count and severity breakdown after successful parsing.
- **FR-006**: System MUST update the scan record to "failed" with the captured error output when the scanner exits with an error code.
- **FR-007**: System MUST detect when the scanner is not installed and show a user-friendly message explaining how to install it.
- **FR-008**: System MUST support cancelling a running scan by terminating the scanner process and marking the scan as "cancelled."
- **FR-009**: System MUST clean up temporary output directories after scan completion, failure, or cancellation.
- **FR-010**: System MUST enforce a one-scan-at-a-time constraint per project, rejecting new scan requests while one is already running.
- **FR-011**: System MUST find or create a scan target record for the scanned folder path before creating the scan record.
- **FR-012**: System MUST terminate the scanner process if it exceeds the configured timeout, marking the scan as "failed."
- **FR-013**: System MUST emit progress updates during scan execution that include elapsed time and status text.
- **FR-014**: System MUST read scanner path and mode from user-configurable settings.
- **FR-015**: System MUST use dependency injection for the process-spawning function to enable testing without real process execution.
- **FR-016**: System MUST compute a severity breakdown (count per severity level) and store it on the scan record.
- **FR-017**: System MUST detect stale "running" scan records on initialization (left by crashes or force-quits) and mark them as "failed" with a crash-recovery error message.

### Key Entities

- **Scan**: One execution of the scanner. Tracks status (running, completed, failed, cancelled), timing, findings count, severity breakdown, and error message. Linked to a project and scan target.
- **ScanTarget**: A folder path that has been scanned. Identified uniquely by the combination of project and path. Allows tracking scan history per folder.
- **Finding**: A single security issue discovered by the scanner. Linked to a scan, project, and scan target. Contains rule identifier, severity, file location, and description.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A scan initiated on a folder with known issues produces stored findings within 2 minutes for a small project (under 1,000 source files), excluding scanner execution time.
- **SC-002**: Cancelling a running scan terminates the scanner process and updates the status within 5 seconds.
- **SC-003**: When the scanner is not installed, the user sees a helpful message within 2 seconds of initiating a scan.
- **SC-004**: After 10 sequential scans of the same folder, exactly one scan target record exists, and all 10 scan records reference it.
- **SC-005**: A scan that produces 1,000 findings has all findings stored correctly with zero data loss.
- **SC-006**: A scanner process that exceeds the timeout is killed and marked as failed within 10 seconds of the timeout expiring.
- **SC-007**: Temporary output directories are removed after every scan, regardless of outcome — zero orphaned directories after 10 scans.
- **SC-008**: Attempting to start a second scan while one is running is rejected within 1 second with a clear user message.

## Assumptions

- The external scanner is installed separately by the user and is available on the system PATH or configured via extension settings.
- The scanner accepts command-line arguments for source directory, output directory, and output format.
- The scanner outputs results in SARIF 2.1.0 format at a predictable file path within the output directory.
- The scanner uses exit codes to indicate outcome: 0 for clean, 1 for error, 2 for findings found.
- The default scan timeout of 600 seconds (10 minutes) is sufficient for typical projects.
- One scan at a time per project is an acceptable constraint for this phase of the product.
- The database layer from Spec 1 and the SARIF parser from Spec 2 are available and functional.
- The extension has write access to a temporary directory for scanner output.

## Scope

### In Scope
- Scanner process spawning and lifecycle management
- SARIF output parsing and findings storage
- Scan target creation and reuse
- Scan cancellation
- Error handling for all scanner failure modes
- Single-scan-at-a-time enforcement
- Timeout handling
- Progress status emission
- Temporary directory management
- Configurable scanner path, mode, and timeout settings

### Out of Scope
- UI for initiating scans (Spec 5+)
- Displaying scan results in the editor (Spec 6+)
- Scan scheduling or automatic re-scans
- Scan comparison or delta reporting
- Scanner installation or setup wizards
- Remote scanner execution
- Parallel scan support (multiple simultaneous scans)
