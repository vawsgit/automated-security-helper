# Feature Specification: Finding Detail & Code Navigation

**Feature Branch**: `008-finding-detail-navigation`
**Created**: 2026-03-17
**Status**: Draft
**Dependencies**: Spec 006 (Finding Queries, Filters & Summary)

## Overview

When a user clicks a finding in the findings list, full details are loaded from the database and displayed. When the user clicks a file path within the finding detail, the corresponding source file opens in the editor at the correct line. This completes the core "scan to code" workflow: scan a project, review findings, and navigate directly to the problematic code.

## User Scenarios & Testing

### User Story 1 - View Finding Detail (Priority: P1)

A developer running a security scan wants to see the full details of a specific finding so they can understand the issue and decide how to address it. When they click a finding in the list, the detail view loads all fields from the database including severity, title, description, rule ID, scanner, file path, line range, code snippet, and current disposition.

**Why this priority**: Finding detail is the core information a developer needs to understand and act on a security finding. Without it, the findings list is just a summary with no actionable depth.

**Independent Test**: Click any finding in the findings list after a completed scan. The detail panel populates with all available fields from the database within 500ms. Verify data matches what was stored during the scan.

**Acceptance Scenarios**:

1. **Given** a completed scan with findings, **When** the user clicks a finding in the list, **Then** the detail view displays all fields: severity, title, description, rule ID, scanner, file path, line range, code snippet, and disposition
2. **Given** a finding is selected, **When** the detail data loads, **Then** the detail view appears within 500ms of the click
3. **Given** a finding with a code snippet, **When** the detail is displayed, **Then** the code snippet is shown in the detail view
4. **Given** a finding with no code snippet (empty field), **When** the detail is displayed, **Then** the code snippet section is gracefully omitted or shows a placeholder

---

### User Story 2 - Navigate to Code from Finding (Priority: P1)

A developer reviewing a finding wants to jump directly to the problematic code in their editor so they can inspect the context and start fixing the issue. Clicking the file path in the finding detail opens the file and positions the cursor at the correct line.

**Why this priority**: Code navigation closes the loop from "finding" to "fix." Without it, the developer must manually find the file and line, which is error-prone and slow.

**Independent Test**: From a finding detail view, click the file path. The editor opens the correct file and scrolls to the finding's start line. Test with both existing and deleted files.

**Acceptance Scenarios**:

1. **Given** a finding with a valid file path that exists in the workspace, **When** the user clicks the file path, **Then** the file opens in the editor with the cursor positioned at the finding's start line
2. **Given** a finding referencing a file that has been deleted since the scan, **When** the user clicks the file path, **Then** a helpful message informs the user the file was not found
3. **Given** a finding with a start line, **When** the file opens, **Then** the start line is visible in the viewport (scrolled into view)

---

### Edge Cases

- What happens when a finding ID does not exist in the database (e.g., data was purged between listing and clicking)? The system should handle this gracefully with no crash and display a user-friendly message.
- What happens when the finding's file path is an absolute path outside the current workspace? The system should still attempt to open it, falling back to the "file not found" message if it doesn't exist.
- What happens if the finding detail is requested while a scan is running? The detail query should still work for findings from previous completed scans.

## Requirements

### Functional Requirements

- **FR-001**: The system MUST load complete finding details from the database when a user selects a finding from the list
- **FR-002**: The finding detail MUST include all stored fields: severity, title, description, rule ID, scanner name, file path, line range (start and end), code snippet, and disposition
- **FR-003**: The finding detail query MUST be routed through the findings service (not accessed directly from the panel manager) for consistent data access patterns
- **FR-004**: The system MUST open the referenced source file in the editor when the user activates the code navigation action on a finding
- **FR-005**: The editor MUST position the cursor at the finding's start line when opening the file
- **FR-006**: The system MUST display a user-friendly message when the referenced file does not exist on disk
- **FR-007**: The system MUST handle missing finding records gracefully (no crash, informative feedback)

### Key Entities

- **Finding**: The existing Finding entity from the database, containing all security finding fields. No new entities or fields are introduced by this feature.

## Success Criteria

### Measurable Outcomes

- **SC-001**: Finding detail loads and displays within 500ms of user selection for databases with up to 10,000 findings
- **SC-002**: 100% of finding fields stored in the database are displayed in the detail view (no data loss between storage and display)
- **SC-003**: Code navigation opens the correct file and line in 100% of cases where the file exists on disk
- **SC-004**: Users receive a clear, non-technical message within 1 second when a referenced file cannot be found
- **SC-005**: Zero unhandled exceptions when finding detail is requested for a non-existent finding ID

## Assumptions

- The findings list from Spec 006 is already functional and emits a selection event when a finding is clicked
- The detail view component in the WebView already exists and can render finding data when it receives a detail message
- File paths stored in findings correspond to real workspace-relative or absolute paths produced by the SARIF parser
- The existing code navigation handler correctly resolves file paths and opens them in the editor

## Out of Scope

- AI-powered analysis or enrichment of findings (planned for a future spec)
- Suppression generation or YAML export from the detail view
- Editing or annotating findings from the detail view (beyond disposition which is already implemented)
- Multi-file navigation (e.g., navigating through a chain of related findings)
