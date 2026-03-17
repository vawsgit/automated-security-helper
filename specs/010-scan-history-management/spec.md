# Feature Specification: Scan History & Management

**Feature Branch**: `010-scan-history-management`
**Created**: 2026-03-17
**Status**: Draft
**Dependencies**: Spec 5 (Scan Execution), Spec 6 (Finding Queries)

## User Scenarios & Testing *(mandatory)*

### User Story 1 - View Real Scan History (Priority: P1)

As a developer using the ASH Workbench extension, I want to see my real scan history in both the sidebar tree view and the WebView scan list, so I can review past security scans and their results without relying on placeholder data.

**Why this priority**: Viewing scan history is the foundational capability. Without real data displayed, all other scan management actions (clicking into findings, deleting scans) have no context. This replaces mock data with actual database records, making the extension functional for real workflows.

**Independent Test**: Run a scan, close and reopen the extension, verify the scan appears in the sidebar tree and WebView scan list with correct metadata (date, status, finding count, source directory).

**Acceptance Scenarios**:

1. **Given** one or more completed scans exist in the database, **When** the user opens the sidebar scan history view, **Then** all scans are listed in reverse chronological order (most recent first) with correct status, date, and finding count.
2. **Given** a scan is displayed in the sidebar tree, **When** the user clicks the scan item, **Then** the findings panel opens showing findings for that specific scan.
3. **Given** scans exist with different statuses (completed, failed, cancelled, running), **When** the sidebar tree renders, **Then** each scan shows a visual status indicator distinguishing its state.
4. **Given** no scans exist in the database, **When** the user opens the sidebar scan history, **Then** the tree view shows an empty state (no items).

---

### User Story 2 - Delete a Scan (Priority: P2)

As a developer, I want to delete a completed scan and all its associated findings from the database, so I can clean up old or irrelevant scan results and keep my workspace organized.

**Why this priority**: Deletion is a management action that builds on the ability to view scans (US1). Users need to see their scans before they can decide which to delete. Cascade deletion of findings ensures data integrity.

**Independent Test**: View a scan in the history, delete it, verify the scan and its findings are removed from the database, and both the sidebar tree and WebView scan list update to reflect the deletion.

**Acceptance Scenarios**:

1. **Given** a completed scan exists, **When** the user triggers deletion for that scan, **Then** the scan and all its associated findings are permanently removed from the database.
2. **Given** a scan has been deleted, **When** the sidebar tree view and WebView scan list refresh, **Then** the deleted scan no longer appears in either view.
3. **Given** a scan has been deleted, **When** the summary bar is displayed, **Then** the summary counts reflect the removal of the deleted scan's findings.
4. **Given** a scan deletion fails (e.g., database error), **When** the error occurs, **Then** the user is notified and no partial data is left in an inconsistent state.

---

### Edge Cases

- What happens when a user deletes the only scan? The tree view and scan list show an empty state.
- What happens when a scan is currently running and the user tries to delete it? Running scans are not eligible for deletion; only completed, failed, or cancelled scans can be deleted.
- What happens when the database query for scan history fails? The tree view shows an error or empty state rather than stale mock data.
- What happens when a new scan completes while the user is viewing the history? The tree view supports refresh to show newly completed scans.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The sidebar tree view MUST display scans from the database ordered by start date, most recent first.
- **FR-002**: Each scan item in the tree view MUST show the scan's status, start date, finding count, and source directory.
- **FR-003**: Each scan status MUST be visually distinguishable through a status icon (completed, failed, cancelled, running).
- **FR-004**: Clicking a scan in the sidebar tree MUST open the findings panel showing findings for that scan.
- **FR-005**: The system MUST support deleting a scan and cascade-deleting all associated findings in a single operation.
- **FR-006**: After a scan is deleted, both the sidebar tree view and the WebView scan list MUST update to reflect the removal.
- **FR-007**: After a scan is deleted, the summary bar counts MUST be recalculated to exclude the deleted scan's findings.
- **FR-008**: Only completed, failed, or cancelled scans MUST be eligible for deletion. Running scans MUST NOT be deletable.
- **FR-009**: The sidebar tree view MUST no longer use mock/placeholder data; all scan data MUST come from the database.
- **FR-010**: The WebView scan history page MUST display real scan data from the database.
- **FR-011**: The tree view MUST support refreshing to pick up newly completed scans.

### Key Entities

- **Scan**: A security scan execution record containing status, start time, completion time, finding count, source directory, and severity breakdown. Ordered by recency for display.
- **Finding**: A security finding linked to a scan. Cascade-deleted when the parent scan is removed.
- **Scan Target**: The workspace path that was scanned. Multiple scans may target the same path.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Scan history loads and displays within 1 second of opening the sidebar view, for up to 100 scans.
- **SC-002**: 100% of scans in the database are visible in the sidebar tree view (no data lost or hidden).
- **SC-003**: Deleting a scan removes it and all associated findings within 2 seconds, with both views updating immediately after.
- **SC-004**: Users can navigate from scan history to findings for any scan in 2 clicks or fewer (click scan, see findings).
- **SC-005**: Zero mock/placeholder data remains in the scan history views after this feature is complete.

## Assumptions

- The database already contains scan records from Spec 5 (Scan Execution) — no seed data is needed.
- The sidebar tree view provider already exists with a refresh mechanism; only the data source needs to change from mock to real.
- The WebView scan history components already render scan data; they just need to receive real data instead of mock data.
- Cascade deletion is handled at the database level via the existing relationship constraint; no application-level cascade logic is needed.
- Confirmation dialogs for destructive actions (deletion) follow standard VS Code patterns.
