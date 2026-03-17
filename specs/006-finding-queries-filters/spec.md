# Feature Specification: Finding Queries, Filters & Summary

**Feature Branch**: `006-finding-queries-filters`
**Created**: 2026-03-16
**Status**: Draft
**Input**: User description: "Finding Queries, Filters & Summary — replace mock data with real database queries, add filtering, enrich scan targets with computed aggregates, and compute real disposition summaries."

## User Scenarios & Testing

### User Story 1 — View Real Findings for a Scan (Priority: P1)

After completing a security scan, the user selects a scan from the scan history. The findings panel loads the actual findings stored in the database — not mock data — and displays them in the findings list. The disposition summary shown on the dashboard reflects the true count of findings in each triage state (PENDING, FIX, SUPPRESS, DEFER).

**Why this priority**: This is the core value of the feature. Without real data flowing from the database to the UI, every other capability (filtering, scan targets) is meaningless. This replaces the last remaining mock data dependencies and closes the loop from scan execution to finding display.

**Independent Test**: Run a scan, then navigate to the dashboard and findings list. Verify the findings shown match what was stored during the scan, counts are accurate, and no mock/placeholder data appears.

**Acceptance Scenarios**:

1. **Given** a completed scan with 5 findings stored in the database, **When** the user opens the findings panel for that scan, **Then** exactly those 5 findings appear with correct titles, severities, file paths, and line numbers.
2. **Given** a project with 10 findings where 3 are triaged as FIX and 7 remain PENDING, **When** the user views the dashboard, **Then** the disposition summary shows total: 10, FIX: 3, PENDING: 7, SUPPRESS: 0, DEFER: 0.
3. **Given** no completed scans exist, **When** the user opens the dashboard, **Then** the scan list is empty, the summary shows zero totals, and the UI displays an appropriate empty state.
4. **Given** a completed scan, **When** the sidebar requests state, **Then** the sidebar receives the real scan list and summary from the database.

---

### User Story 2 — Filter Findings by Criteria (Priority: P2)

While reviewing findings for a scan, the user applies filters to narrow the list. Filters include severity level(s), scanner name, disposition state(s), and file path pattern. The filtered results update immediately in the findings list without reloading the entire panel.

**Why this priority**: Scans can produce hundreds of findings. Filtering is essential for productive triage — users need to focus on critical findings, findings from a specific scanner, or findings in a particular file or directory.

**Independent Test**: Open a findings list with mixed severities and scanners. Apply a severity filter for CRITICAL only. Verify only CRITICAL findings appear. Clear the filter. Apply a file pattern filter. Verify the list updates accordingly.

**Acceptance Scenarios**:

1. **Given** a scan with findings of mixed severities, **When** the user filters by severity CRITICAL and HIGH, **Then** only findings with those severities appear in the list.
2. **Given** a scan with findings from multiple scanners, **When** the user filters by scanner "bandit", **Then** only bandit findings appear.
3. **Given** a scan with findings across many files, **When** the user filters by file pattern "src/auth", **Then** only findings in files matching that pattern appear.
4. **Given** active filters, **When** the user clears all filters, **Then** the full unfiltered finding list is restored.
5. **Given** a scan with 50 findings, **When** the user applies a filter that matches 0 findings, **Then** the list shows an empty state with a message indicating no findings match the current filters.
6. **Given** active filters on severity and disposition, **When** the user applies both simultaneously, **Then** only findings matching ALL active filter criteria appear (AND logic).

---

### User Story 3 — View Enriched Scan Targets on Dashboard (Priority: P3)

The dashboard displays scan target cards showing real computed data: how many findings each target has, the severity breakdown, how many scans have been run, and triage progress. This replaces the placeholder scan target data currently shown.

**Why this priority**: Scan targets provide the organizational structure for multi-target projects. Enriched target cards give users an at-a-glance view of which areas of their codebase need the most attention, but the core triage workflow (US1, US2) works without them.

**Independent Test**: Run scans against two different target folders. Open the dashboard. Verify each scan target card shows the correct finding count, severity breakdown, scan count, and triage progress for its specific target.

**Acceptance Scenarios**:

1. **Given** two scan targets with different finding counts and severities, **When** the user views the dashboard, **Then** each target card shows its own correct counts and severity breakdown.
2. **Given** a scan target where 5 of 10 findings are triaged, **When** the user views the dashboard, **Then** that target's triage progress shows 50% complete.
3. **Given** a scan target with no findings, **When** the user views the dashboard, **Then** the target card shows zero findings and full triage completion.
4. **Given** a new scan completes for an existing target, **When** the dashboard refreshes, **Then** the target card reflects the updated totals including findings from the new scan.

---

### Edge Cases

- What happens when a scan has thousands of findings? The query must return results promptly without blocking the UI.
- What happens when a filter combination matches zero results? An informative empty state is shown, not a blank screen.
- What happens when the user applies filters and then switches to a different scan? The filters should reset for the new scan context.
- What happens when findings are being loaded from the database while a new scan is running? The loading state should not interfere with the progress display.
- What happens when the database contains findings with null or empty fields (e.g., no snippet, no endLine)? The system must handle these gracefully with sensible defaults.

## Requirements

### Functional Requirements

- **FR-001**: The system MUST query findings from the database when a scan is selected, returning results shaped for display with correct field mappings.
- **FR-002**: The system MUST compute a disposition summary from the database reflecting the actual count of findings per disposition state (PENDING, FIX, SUPPRESS, DEFER) across the project.
- **FR-003**: The system MUST query scan records from the database ordered by most recent first and deliver them to both the sidebar and findings panel.
- **FR-004**: The system MUST support filtering findings by one or more severity levels (e.g., CRITICAL, HIGH).
- **FR-005**: The system MUST support filtering findings by scanner name (e.g., "bandit", "semgrep").
- **FR-006**: The system MUST support filtering findings by one or more disposition states (e.g., PENDING, FIX).
- **FR-007**: The system MUST support filtering findings by file path pattern (substring match against the file path).
- **FR-008**: The system MUST apply all active filters simultaneously using AND logic (a finding must match all active filter criteria to be included).
- **FR-009**: The system MUST query scan target records enriched with computed per-target finding counts, severity breakdown, and triage progress.
- **FR-010**: The system MUST deliver scan target data to the dashboard so real computed data replaces placeholder values.
- **FR-011**: The system MUST handle findings with missing optional fields (no snippet, no endLine) by providing sensible defaults.
- **FR-012**: The system MUST centralize finding query logic in a single service layer rather than scattering it across multiple UI handlers.
- **FR-013**: The system MUST support the filter request as a distinct message type in the communication protocol between the UI and extension host.
- **FR-014**: The system MUST remove all remaining dependencies on mock/placeholder data in both the extension host and the UI.

### Key Entities

- **Finding**: A security issue detected by a scanner. Key attributes: severity, disposition, scanner name, file path, line range, code snippet. Identified by a unique ID. Belongs to a scan and a scan target.
- **Scan**: A single execution of the security scanner against a target. Key attributes: status, start time, completion time, finding count, severity breakdown. Belongs to a project and a scan target.
- **Scan Target**: A directory or path that has been scanned. Enriched with computed aggregates: total finding count, severity breakdown, scan count, triage progress (disposition summary).
- **Disposition Summary**: An aggregate view showing the total number of findings and the count per disposition state (PENDING, FIX, SUPPRESS, DEFER).
- **Filter State**: The set of active filter criteria: severity level(s), scanner name, disposition state(s), and file path pattern. All criteria are optional; when multiple are active they combine with AND logic.

## Success Criteria

### Measurable Outcomes

- **SC-001**: Users see real findings data within 1 second of selecting a scan, for scans with up to 500 findings.
- **SC-002**: The disposition summary on the dashboard accurately reflects the true triage state of all findings — verified by comparing displayed counts against the database.
- **SC-003**: Users can reduce a finding list of 200+ items to a focused subset in under 3 seconds using any combination of filters.
- **SC-004**: Dashboard scan target cards show correct per-target finding counts, severity breakdowns, and triage progress — verified against database totals.
- **SC-005**: Zero mock or placeholder data is visible in the application when real scan data exists in the database.
- **SC-006**: All filter combinations (including those matching zero results) produce a coherent user experience with no errors or blank screens.

## Assumptions

- The database schema already supports all necessary fields for findings, scans, scan targets, and dispositions. No schema migrations are needed.
- The existing mapper functions that convert database records to display-ready shapes are reusable and correct.
- Findings are scoped to a single scan when displayed in the findings list. Cross-scan finding views (e.g., "all findings across all scans") are out of scope for this feature.
- The file path filter uses simple substring matching, not glob or regex patterns.
- The UI already has components for displaying findings, scan targets, and summaries — this feature provides the real data to populate them.

## Out of Scope

- AI-powered finding analysis and enrichment (aiAnalysis field remains null).
- Suppression generation (suppression field remains null).
- Cross-scan deduplication views (showing the same finding across multiple scans).
- Sorting controls for the findings list (default order from the database is sufficient for this feature).
- Pagination of findings (all findings for a scan are loaded at once; virtual scrolling in the UI handles large lists).
- Notes field persistence in the database (notes are displayed but database-backed note storage is a separate feature).

## Dependencies

- **Spec 001 (Database)**: Provides the embedded database with the Prisma schema for findings, scans, scan targets, and dispositions.
- **Spec 005 (Scan Execution)**: Provides the end-to-end scan flow that creates real scan and finding records in the database. Also provides the existing mapper functions and the basic inline query patterns in providers.
