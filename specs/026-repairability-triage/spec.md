# Feature Specification: Repairability Triage Analysis

**Feature Branch**: `026-repairability-triage`
**Created**: 2026-03-23
**Status**: Draft
**Input**: User description: "AI-driven repairability triage analysis for security findings with visual KPI charts, one-click suppress/fix actions, and detailed repair guidance for systemic issues."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Triage Dashboard with AI-Driven Classification (Priority: P1)

As a user, I want a dashboard that shows my security findings organized by severity and repairability category so I can understand at a glance where to focus my remediation effort.

The system performs AI-driven analysis on HIGH severity, non-suppressed findings and classifies each into one of three repairability categories:

- **Suppress** — The finding should be suppressed (false positive, acceptable risk, not applicable to context)
- **Easy Fix** — Non-risky fix, typically affecting one file, with a straightforward code change
- **Systemic** — Harder or riskier to fix, requiring deeper out-of-application analysis, possibly a coding agent

The dashboard displays visual charts communicating KPI breakdowns by severity and repairability category. This is a singular view representing the latest cumulative state of findings across the repository, not tied to a specific scan.

When the user clicks a severity × repairability cell, the view drills down to show a filtered list of those findings. Addressed findings (suppressed or fixed) are visually distinguished so the user can systematically work through a large number of findings.

**Why this priority**: This is the foundation of the entire feature. Without classification and the dashboard, none of the action workflows (P2–P4) can function. It delivers immediate value by giving users visibility into the repairability landscape of their findings, even before action buttons are available.

**Independent Test**: Can be fully tested by running a scan that produces HIGH severity findings, triggering triage analysis, and verifying the dashboard displays correct charts, counts, and drill-down filtering. Delivers visibility value standalone.

**Acceptance Scenarios**:

1. **Given** a repository with completed scans containing HIGH severity findings that are not suppressed, **When** the user opens the triage dashboard, **Then** the system initiates AI classification of unanalyzed HIGH severity findings and displays visual charts showing findings per severity, broken down by repairability category (suppress, easy fix, systemic).

2. **Given** HIGH severity findings that have already been analyzed and have not changed since their last analysis, **When** the triage dashboard loads, **Then** the system uses cached classification results without re-analyzing, and the dashboard displays the previously determined categories.

3. **Given** the triage dashboard is displayed, **When** the user clicks a specific severity × repairability combination (e.g., "HIGH / Easy Fix"), **Then** the view drills down to show a filtered list of findings matching that severity and category.

4. **Given** the drill-down list is displayed and some findings have been addressed (suppressed or fixed), **When** the user views the list, **Then** addressed findings are visually distinguished from unaddressed findings, enabling the user to track progress through the set.

5. **Given** findings of severities other than HIGH, **When** the dashboard displays, **Then** those severities show total finding counts only, without repairability breakdown, with an indication that analysis is scoped to HIGH severity in this release.

---

### User Story 2 - One-Click Suppress for "Should Suppress" Findings (Priority: P2)

As a user, when I drill down to findings classified as "should suppress," I want a clear explanation of the issue, the risk, and why it can be safely suppressed, with the option to suppress each finding with a single click.

**Why this priority**: Suppression is the fastest action a user can take. Clearing suppressible findings first reduces noise and lets the user focus on findings requiring real fixes. This leverages the existing suppression infrastructure.

**Independent Test**: Can be fully tested by viewing a finding classified as "suppress," reading the AI-generated explanation, clicking the suppress button, and verifying the suppression is written to the repository and the finding's status updates in the interface.

**Acceptance Scenarios**:

1. **Given** a finding classified as "suppress" is selected from the drill-down list, **When** it is displayed, **Then** the system shows: (a) what the issue is, (b) the risk level, and (c) a clear explanation of why it can be safely suppressed.

2. **Given** the suppress explanation is displayed, **When** the user clicks the suppress button, **Then** the suppression is written immediately to the repository's suppression configuration, and the finding's status updates in the interface to show it has been suppressed.

3. **Given** a finding has been suppressed via the one-click action, **When** the user returns to the drill-down list, **Then** the finding is visually marked as addressed, and the dashboard chart counts update to reflect the change.

---

### User Story 3 - One-Click Fix for "Easy Fix" Findings (Priority: P3)

As a user, when I drill down to findings classified as "easy fix," I want a clear explanation of the issue, the risk, and how to fix it — with a code sample — and the option to apply the fix with a single click.

**Why this priority**: Easy fixes represent quick wins that significantly reduce the total open finding count. Providing one-click fix application dramatically accelerates remediation for low-risk, single-file issues.

**Independent Test**: Can be fully tested by viewing a finding classified as "easy fix," reading the explanation and code sample, clicking the fix button, and verifying the code change is applied to the source file and the status updates in the interface.

**Acceptance Scenarios**:

1. **Given** a finding classified as "easy fix" is selected from the drill-down list, **When** it is displayed, **Then** the system shows: (a) what the issue is, (b) the risk level, and (c) how to fix it, including a code sample showing the before/after change.

2. **Given** the fix explanation and code sample are displayed, **When** the user clicks the fix button, **Then** the fix is applied to the source file immediately, and the interface displays: "Fix applied, status will be updated next scan."

3. **Given** an easy fix has been applied, **When** the user returns to the drill-down list, **Then** the finding is visually marked as addressed.

4. **Given** a finding classified as "easy fix" whose source file has been modified since the analysis was performed, **When** the user attempts to apply the fix, **Then** the system informs the user that the fix could not be safely applied and recommends re-analyzing the finding.

---

### User Story 4 - Comprehensive Repair Guidance for "Systemic" Findings (Priority: P4)

As a user, when I drill down to findings classified as "systemic," I want a clear explanation of the issue, the risk, and why it's hard to fix, along with comprehensive repair guidance detailed enough to hand off to a coding agent.

**Why this priority**: Systemic findings are the most complex to resolve. While they cannot be fixed with one click, providing detailed, portable repair guidance reduces time to resolution by enabling handoff to specialized tools or developers.

**Independent Test**: Can be fully tested by viewing a finding classified as "systemic," reading the explanation and repair guidance, clicking copy-to-clipboard, and verifying the guidance is comprehensive and formatted for use in an external coding agent.

**Acceptance Scenarios**:

1. **Given** a finding classified as "systemic" is selected from the drill-down list, **When** it is displayed, **Then** the system shows: (a) what the issue is, (b) the risk level, and (c) why the fix is difficult or risky.

2. **Given** the systemic finding explanation is displayed, **Then** the system also provides comprehensive repair guidance including: the affected code areas, the nature of the vulnerability, the recommended remediation approach, potential side effects and risks of the fix, and testing recommendations.

3. **Given** the repair guidance is displayed, **When** the user clicks the copy-to-clipboard button, **Then** the full repair guidance is copied to the clipboard in a portable, structured format suitable for pasting into a coding agent or issue tracker.

---

### Edge Cases

- What happens when AI classification fails for a specific finding? The finding remains "unanalyzed" in the dashboard with an error indicator; the user can retry analysis for that finding.
- What happens when all HIGH severity findings are already suppressed? The dashboard shows zero findings to analyze with a clear message indicating no HIGH severity findings require triage.
- What happens when a finding changes between analysis and action? For suppress: proceed, as the suppression justification is based on the rule/context. For easy fix: fail gracefully with a message to re-analyze, since the code has changed. For systemic: display a staleness indicator recommending re-analysis, but still show the existing guidance.
- What happens when the AI provider is not configured? The triage dashboard indicates that AI classification is required for repairability analysis and provides guidance on how to configure the AI provider.
- What happens when the user navigates away during batch classification? Classification continues in the background; results are available when the user returns to the dashboard.
- What happens when a previously classified finding is reclassified on re-analysis? The new classification replaces the old one, and any category-specific guidance is regenerated.
- What happens when no scans have been run yet? The triage dashboard shows an empty state with guidance to run a scan first.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST classify HIGH severity, non-suppressed findings into exactly one of three repairability categories: Suppress, Easy Fix, or Systemic.
- **FR-002**: Classification MUST be AI-driven, considering the finding's context (rule ID, severity, code snippet, file location, description, scanner) to determine the repairability category.
- **FR-003**: System MUST cache classification results and reuse them when the underlying finding has not changed since the last analysis.
- **FR-004**: System MUST determine whether a finding has changed by comparing its core attributes (rule ID, file, code snippet, severity, description) against the state at the time of last analysis.
- **FR-005**: System MUST display a triage dashboard with visual charts showing findings organized by severity and repairability category.
- **FR-006**: The triage dashboard MUST represent the latest cumulative state of findings across the repository, not a specific scan.
- **FR-007**: Users MUST be able to drill down from a severity × repairability combination to a filtered list of matching findings.
- **FR-008**: The drill-down view MUST visually distinguish addressed findings (suppressed, fixed) from unaddressed findings.
- **FR-009**: For "suppress" findings, the system MUST display an AI-generated explanation of the issue, the risk, and why suppression is appropriate.
- **FR-010**: For "suppress" findings, users MUST be able to suppress the finding with a single action, with the suppression written immediately and the interface status updated.
- **FR-011**: For "easy fix" findings, the system MUST display an AI-generated explanation of the issue, the risk, the recommended fix, and a before/after code sample.
- **FR-012**: For "easy fix" findings, users MUST be able to apply the fix with a single action, writing the code change to the source file immediately.
- **FR-013**: After an easy fix is applied, the system MUST display a confirmation message indicating the fix was applied and the finding status will update on the next scan.
- **FR-014**: The system MUST prevent applying an easy fix when the source file has been modified since the analysis, informing the user and recommending re-analysis.
- **FR-015**: For "systemic" findings, the system MUST display an AI-generated explanation of the issue, the risk, and why the fix is complex.
- **FR-016**: For "systemic" findings, the system MUST generate comprehensive repair guidance detailed enough to direct an external coding agent, including: affected code areas, vulnerability nature, recommended remediation approach, potential side effects, and testing recommendations.
- **FR-017**: The comprehensive repair guidance MUST be copyable to the clipboard with a single action, in a portable structured format.
- **FR-018**: Within the POC scope, only HIGH severity, non-suppressed findings MUST be analyzed; other severities are displayed with total counts but without repairability breakdown.
- **FR-019**: If AI classification fails for a finding, the system MUST indicate the failure and allow the user to retry.
- **FR-020**: If the AI provider is not configured, the system MUST inform the user and provide configuration guidance.
- **FR-021**: Dashboard chart counts MUST update to reflect actions taken (suppressions, fixes) without requiring the user to refresh.

### Key Entities

- **Repairability Analysis**: An AI-generated assessment linked to a specific finding. Contains the repairability category (Suppress, Easy Fix, Systemic), a category-specific explanation (issue description, risk assessment, action rationale), and category-specific action data (suppression justification for Suppress; fix code sample with before/after for Easy Fix; comprehensive repair guidance for Systemic). Invalidated when the underlying finding's core attributes change. One analysis per finding; re-analysis replaces the previous result.

- **Triage Summary**: A computed aggregate showing the count of findings per severity per repairability category, derived from the latest cumulative findings and their associated repairability analyses. Includes an "unanalyzed" count for findings not yet classified (either pending analysis or out of POC scope).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can identify the repairability category of every HIGH severity finding within a single view, without manual assessment of each finding.
- **SC-002**: Users can suppress a "should suppress" finding in two interactions or fewer (select finding, click suppress).
- **SC-003**: Users can apply a fix for an "easy fix" finding in two interactions or fewer (select finding, click fix).
- **SC-004**: Users can copy comprehensive repair guidance for a "systemic" finding to the clipboard in two interactions or fewer (select finding, click copy).
- **SC-005**: Previously analyzed findings that have not changed load their cached classification instantly, with no AI processing delay.
- **SC-006**: The triage dashboard provides a visual summary that allows users to assess the overall repairability landscape of their findings at a glance, within seconds of opening.
- **SC-007**: Users can work through a set of same-category findings systematically, with visual progress indicators showing what has been addressed versus what remains.
- **SC-008**: After addressing a finding (suppress or fix), the dashboard counts reflect the change without requiring the user to manually refresh or re-navigate.

## Assumptions

- Classification categories are mutually exclusive — each finding is assigned exactly one repairability category.
- "Finding has not changed" is determined by comparing core attributes (rule ID, file path, code snippet, severity, description) to the values at the time of last analysis.
- The triage dashboard is a dedicated view within the existing application, accessible alongside existing views.
- Suppression via the triage view follows the same mechanism and configuration format as the existing suppression system.
- Easy fix code application writes directly to the source file on disk; the user is expected to review the change via their normal version control workflow.
- Repair guidance for systemic findings is formatted as structured plain text optimized for pasting into an AI coding agent prompt.
- The batch classification process can run in the background while the user interacts with already-classified findings.
- Chart visualizations use finding counts as the primary metric.
