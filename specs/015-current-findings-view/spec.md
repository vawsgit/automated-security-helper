# Feature Specification: Unified Current Findings View

**Feature Branch**: `015-current-findings-view`
**Created**: 2026-03-19
**Status**: Draft
**Depends On**: Spec 012 (Scan Root), Spec 013 (.ash.yaml Read + Suppression Matching)
**Input**: User description: "Introduce a 'Current Findings' concept that becomes the primary view in ASH Workbench. Current findings = the latest completed scan's findings with .ash.yaml suppression status overlaid."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - View Current Active Findings (Priority: P1)

As a developer, I want to open ASH Workbench and immediately see my current active findings (findings from the latest scan that are not suppressed by .ash.yaml) so that I know what security issues need my attention right now without having to select a specific scan.

**Why this priority**: This is the core value proposition. Users should not have to select a scan to see what matters. The default experience should answer: "what's wrong in my codebase right now?"

**Independent Test**: Can be tested by running a scan, adding suppression rules to .ash.yaml, and verifying the dashboard and findings list show only active (non-suppressed) findings by default.

**Acceptance Scenarios**:

1. **Given** at least one completed scan exists for the configured scan root, **When** the user opens the sidebar dashboard, **Then** they see the count of active findings, count of suppressed findings, severity breakdown of active findings only, triage progress against active findings only, and the timestamp of the latest scan.
2. **Given** at least one completed scan exists, **When** the user opens the findings panel (via dashboard or "View Findings"), **Then** the findings list shows current findings from the latest scan with suppressed findings hidden by default.
3. **Given** no completed scans exist for the scan root, **When** the user opens the sidebar dashboard, **Then** they see the existing empty state with a "Run your first scan" prompt.
4. **Given** the latest scan has 20 findings and .ash.yaml suppresses 5 of them, **When** the dashboard loads, **Then** "15 active findings" is shown prominently, "5 suppressed" is shown as secondary info, and the severity breakdown reflects only the 15 active findings.

---

### User Story 2 - Toggle Suppressed Findings Visibility (Priority: P1)

As a developer reviewing findings, I want to toggle visibility of suppressed findings so that I can see the full picture when needed but focus on actionable findings by default.

**Why this priority**: Without the toggle, users cannot verify that suppression rules are working correctly or review what's been suppressed. This is essential for trust and auditability.

**Independent Test**: Can be tested by toggling the "Show suppressed" switch in the findings list and verifying suppressed findings appear/disappear with appropriate visual indicators.

**Acceptance Scenarios**:

1. **Given** the findings list is open with current findings, **When** the "Show suppressed" toggle is off (default), **Then** findings where .ash.yaml rules match are hidden from the list.
2. **Given** the "Show suppressed" toggle is off, **When** the user turns it on, **Then** all findings are shown and suppressed findings display a visual indicator (muted styling or "Suppressed" badge).
3. **Given** the user turns the toggle on and then navigates away, **When** the user returns to the findings list, **Then** the toggle resets to off (not persisted).

---

### User Story 3 - Suppression Overlay on Historical Scans (Priority: P2)

As a developer reviewing a past scan, I want to see which of those historical findings would be suppressed by my current .ash.yaml rules so that I understand how my suppression configuration applies across scan history.

**Why this priority**: Provides context when reviewing historical data. Not needed for the primary workflow but adds significant value for users managing suppression rules over time.

**Independent Test**: Can be tested by navigating to a historical scan and verifying findings that match current .ash.yaml rules show a "Currently suppressed" indicator.

**Acceptance Scenarios**:

1. **Given** the user navigates to a specific historical scan (not the latest), **When** the findings for that scan are displayed, **Then** each finding that matches a current .ash.yaml suppression rule shows a "Currently suppressed" badge/chip.
2. **Given** a historical scan is being viewed, **When** the "Show suppressed" toggle is available, **Then** the toggle controls visibility of the "Currently suppressed" overlay indicators (all findings remain visible regardless since this is a historical view).

---

### User Story 4 - Live Reactivity to .ash.yaml Changes (Priority: P2)

As a developer editing .ash.yaml while ASH Workbench is open, I want the findings view and dashboard to update automatically when I save .ash.yaml so that I get immediate feedback on my suppression rule changes.

**Why this priority**: Without reactivity, users must manually refresh or reopen panels to see the effect of suppression changes. This degrades the tight feedback loop that makes the tool useful.

**Independent Test**: Can be tested by opening the findings panel, editing .ash.yaml to add/remove a suppression rule, saving the file, and verifying the findings list and dashboard update within seconds.

**Acceptance Scenarios**:

1. **Given** the findings panel is open showing current findings, **When** the user saves a change to .ash.yaml that adds a new suppression rule matching an active finding, **Then** the finding moves from active to suppressed (disappears if toggle is off, shows suppressed indicator if toggle is on) and the dashboard summary updates.
2. **Given** the findings panel is open showing current findings, **When** the user saves a change to .ash.yaml that removes a suppression rule, **Then** the previously suppressed finding becomes active again and the dashboard summary updates.
3. **Given** the user is viewing a historical scan, **When** .ash.yaml changes, **Then** the "Currently suppressed" overlay on historical findings updates to reflect the new suppression state.

---

### User Story 5 - Suppress Button Disabled (Priority: P3)

As a developer triaging findings, I want the "Suppress" disposition button to be temporarily disabled with a clear explanation so that I understand suppression is managed via .ash.yaml and not through the in-app triage flow (until the .ash.yaml write feature is delivered).

**Why this priority**: Prevents user confusion about how suppression works in the new model. Other disposition actions (Fix, Defer, Pending) continue to work normally.

**Independent Test**: Can be tested by viewing a finding's triage controls and verifying the Suppress button is disabled with an explanatory tooltip.

**Acceptance Scenarios**:

1. **Given** a finding is selected in the findings panel, **When** the triage controls are displayed, **Then** the "Suppress" button is disabled and shows a tooltip: "Suppression is managed via .ash.yaml".
2. **Given** a finding is selected, **When** the user clicks "Fix", "Defer", or "Pending", **Then** those dispositions work as before (saved to database).
3. **Given** a finding is both suppressed (via .ash.yaml) and has a "Fix" disposition, **When** viewing the finding detail, **Then** both the suppression status and the disposition are shown (they are independent and additive).

---

### Edge Cases

- What happens when the latest scan has zero findings? Dashboard shows "0 active findings" with no severity breakdown; findings list shows an empty state.
- What happens when all findings in the latest scan are suppressed? Dashboard shows "0 active findings, N suppressed"; triage progress bar is not shown (or shows 100% complete since there's nothing to triage).
- What happens when .ash.yaml does not exist? All findings are active (none suppressed); dashboard and findings list behave as if suppression count is zero.
- What happens when .ash.yaml is malformed or has parse errors? Findings display as if no suppressions exist; an appropriate warning may be shown (per Spec 013 behavior).
- What happens when the user switches scan roots (via Spec 012 setting)? Current findings recompute for the new scan root's latest scan with the corresponding .ash.yaml state.
- What happens when a suppression rule has an expiration date that has passed? The expired suppression does not match — the finding remains active (per Spec 013 matching logic).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST compute "current findings" as the findings from the latest completed scan for the configured scan root, overlaid with .ash.yaml suppression matching status.
- **FR-002**: System MUST display current findings as the default view when the sidebar dashboard and findings panel load (no scan selection required).
- **FR-003**: System MUST show an "active findings" count (non-suppressed) prominently in the dashboard, with "suppressed" count as secondary information.
- **FR-004**: System MUST calculate severity breakdown and triage progress using only active (non-suppressed) findings.
- **FR-005**: System MUST provide a "Show suppressed" toggle in the findings list that is off by default and controls visibility of suppressed findings.
- **FR-006**: When the "Show suppressed" toggle is on, suppressed findings MUST display a distinct visual indicator differentiating them from active findings.
- **FR-007**: System MUST overlay current .ash.yaml suppression status on historical scan findings, showing a "Currently suppressed" indicator on matching findings.
- **FR-008**: System MUST reactively update current findings, dashboard summary, and suppression overlays when .ash.yaml changes are detected.
- **FR-009**: The "Suppress" disposition button MUST be disabled with a tooltip explaining that suppression is managed via .ash.yaml.
- **FR-010**: Disposition actions Fix, Defer, and Pending MUST continue to function as database-persisted state, independent of .ash.yaml suppression status.
- **FR-011**: A finding MUST be able to be both suppressed (via .ash.yaml) and have a Fix/Defer/Pending disposition simultaneously — these are independent attributes.
- **FR-012**: System MUST display "Last scanned: [timestamp]" on the dashboard, sourced from the latest completed scan.
- **FR-013**: When no completed scans exist for the scan root, system MUST show an empty state prompting the user to run their first scan.
- **FR-014**: The "Show suppressed" toggle state MUST NOT persist across navigation or panel reopens — it resets to off each time.

### Key Entities

- **Current Findings**: A computed view (not persisted separately) combining the latest scan's findings with real-time .ash.yaml suppression status. Each finding carries: its original scan data, whether it is currently suppressed, the source of suppression (currently only .ash.yaml), and suppression details (justification, expiration) when applicable.
- **Suppression Summary**: An aggregate count of total findings, suppressed findings, and active findings for the current scan root. Used by dashboards and summary views.
- **Suppression Status**: Per-finding attribute indicating whether an .ash.yaml rule matches, including the matched rule's justification and expiration. Independent of the finding's triage disposition.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can see their current active findings within 2 seconds of opening the sidebar dashboard, without any manual scan selection.
- **SC-002**: Dashboard summary (active count, suppressed count, severity breakdown, triage progress) reflects only non-suppressed findings and updates within 3 seconds of an .ash.yaml change.
- **SC-003**: Toggling "Show suppressed" instantly (under 500ms) updates the findings list to show or hide suppressed findings with clear visual differentiation.
- **SC-004**: Historical scan views display current suppression overlay on all findings, allowing users to understand suppression coverage across scan history.
- **SC-005**: 100% of .ash.yaml file changes are reflected in the findings view and dashboard without requiring manual refresh or panel reopen.
- **SC-006**: Users can continue to apply Fix, Defer, and Pending dispositions to findings regardless of their suppression status, with zero change to the existing triage workflow for those actions.

## Assumptions

- Spec 012 (Scan Root) is implemented: the system has a configured scan root setting.
- Spec 013 (.ash.yaml Read + Suppression Matching) is implemented: AshYamlService can read .ash.yaml, match findings against suppression rules, and emit change events when the file is modified.
- The suppression matching logic (including expiration handling) is fully defined by Spec 013.
- Writing to .ash.yaml is out of scope (deferred to a future spec). The Suppress button is disabled as a bridge behavior.
- SARIF-embedded suppression data is not used as a suppression source in this spec.
- The "Show suppressed" toggle default (off) is the right UX choice for most users who want to focus on actionable findings.

## Non-Goals

- Writing suppression rules to .ash.yaml from the UI (future spec).
- Suppression management UI (create, edit, delete rules) — future spec.
- Parsing SARIF suppression data as a suppression source.
- Persisting the "Show suppressed" toggle state across sessions.
- Aggregating findings across multiple scan roots.
