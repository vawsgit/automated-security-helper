# Feature Specification: Batch Analysis and Session Management

**Feature Branch**: `023-batch-ai-analysis`
**Created**: 2026-03-20
**Status**: Draft
**Input**: User description: "Sequential batch analysis of all findings in a scan, with session persistence for efficiency and a scan-level UI for triggering and tracking batch progress."

## Clarifications

### Session 2026-03-20

- Q: Should budget enforcement apply across the batch? → A: No. Remove budget enforcement from batch analysis entirely to reduce complexity.
- Q: Should the batch stop after repeated consecutive failures? → A: Yes. Stop after 3 consecutive failures (default), with the limit configurable in settings.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Batch Analyze All Findings (Priority: P1)

A security engineer has completed a scan that produced 17 findings. Rather than clicking "Analyze with AI" on each finding individually, they want to analyze all findings at once. They click "Analyze All Findings" in the scan view, and the system sequentially analyzes each finding that doesn't already have an AI analysis. They can see progress ("Analyzing finding 3 of 17...") and the overall batch status while it runs.

**Why this priority**: This is the core value proposition — eliminating repetitive manual triggering of individual analyses. Without batch analysis, users with large scans face tedious one-by-one workflows.

**Independent Test**: Can be fully tested by triggering "Analyze All Findings" on a scan with multiple unanalyzed findings and verifying that each finding receives an AI analysis sequentially with visible progress.

**Acceptance Scenarios**:

1. **Given** a scan with 10 findings where none have AI analysis, **When** the user clicks "Analyze All Findings", **Then** the system begins analyzing findings sequentially, showing progress like "Analyzing finding 1 of 10..." and updating the counter as each finding completes.
2. **Given** a scan with 10 findings where 4 already have AI analysis, **When** the user clicks "Analyze All Findings", **Then** only the 6 unanalyzed findings are processed, and the progress reflects the actual count ("Analyzing finding 1 of 6...").
3. **Given** a scan where all findings already have AI analysis, **When** the user views the scan, **Then** the "Analyze All Findings" button is disabled with a label indicating all findings are already analyzed.
4. **Given** a batch analysis is in progress, **When** the user views the scan, **Then** they see overall batch progress (current/total count) in addition to per-finding tool activity messages for the currently-active finding.

---

### User Story 2 - Cancel Batch Analysis (Priority: P2)

During a batch analysis, the user realizes they need to stop the process — perhaps they started the wrong scan, or need to reconfigure their AI provider. They click a cancel button, and the system stops after completing the current finding's analysis. All findings that were already analyzed are preserved.

**Why this priority**: Cancellation is essential for user control and confidence. Without it, users are locked into potentially expensive, long-running operations with no way out.

**Independent Test**: Can be tested by starting a batch analysis on a scan with multiple findings, cancelling mid-batch, and verifying that completed analyses are preserved while remaining findings are skipped.

**Acceptance Scenarios**:

1. **Given** a batch analysis is processing finding 5 of 17, **When** the user cancels the batch, **Then** the current finding's analysis is aborted, findings 1-4 retain their completed analyses, and findings 6-17 are not processed.
2. **Given** a batch analysis was cancelled after completing 4 of 10 findings, **When** the user views the findings list, **Then** findings 1-4 show their AI analysis results and findings 5-10 show no analysis.
3. **Given** a batch analysis was cancelled, **When** the user clicks "Analyze All Findings" again, **Then** only the remaining unanalyzed findings are processed (resumes from where it left off based on analysis presence).

---

### User Story 3 - Session Persistence for Efficiency (Priority: P3)

When analyzing multiple findings from the same scan, the system reuses the AI session established for the first finding. This keeps the subprocess warm and allows the AI to build cross-finding context (e.g., noticing that multiple findings relate to the same vulnerable pattern). The user doesn't directly interact with session management — it happens transparently to improve speed and analysis quality.

**Why this priority**: Session reuse is an optimization that improves speed and analysis quality but is not user-facing. The batch works correctly without it (just slower and without cross-finding context).

**Independent Test**: Can be tested by running batch analysis and observing that after the first finding, subsequent findings start faster and the AI references patterns from earlier findings in its analysis.

**Acceptance Scenarios**:

1. **Given** a batch analysis of a scan with multiple findings, **When** the first finding is analyzed, **Then** the system captures the session identifier from the initial response and uses it for subsequent findings.
2. **Given** a session is active from a previous finding in the batch, **When** the next finding's analysis begins, **Then** the AI receives the resume session identifier, enabling it to reference prior findings' context.
3. **Given** a batch analysis completes or is cancelled, **When** the batch ends, **Then** the session is not reused for any future operations (session scope is limited to the batch).

---

### Edge Cases

- What happens when a single finding's analysis fails mid-batch? The batch logs the error for that finding, preserves it as a per-finding error, and continues to the next finding.
- What happens if the AI provider becomes unavailable during a batch? After the configurable consecutive failure limit (default: 3) is reached, the batch stops automatically, preserving all completed analyses and notifying the user of repeated failures.
- What happens if the user starts a batch analysis while a single finding analysis is already in progress? The batch waits for or skips that finding (since it's already being analyzed) and processes the remaining unanalyzed findings.
- What happens if the scan has zero unanalyzed findings? The button is disabled; if somehow triggered, the batch completes immediately with a "nothing to analyze" status.
- What happens if session resumption fails (e.g., session expired)? The batch falls back to creating a new session and continues processing.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST provide a batch analysis operation that sequentially analyzes all findings in a scan that do not already have an AI analysis result.
- **FR-002**: System MUST report batch-level progress showing the current finding number and total count (e.g., "Analyzing finding 3 of 17...") in addition to per-finding tool activity.
- **FR-003**: System MUST provide a visible "Analyze All Findings" button in the scan-level view (findings list header or scan detail area).
- **FR-004**: The "Analyze All Findings" button MUST be disabled when all findings in the scan already have AI analysis results.
- **FR-005**: The "Analyze All Findings" button MUST show batch progress state (progress indicator and count) while a batch is running.
- **FR-006**: System MUST support cancellation of a batch analysis. Cancellation aborts the currently-active finding's analysis and skips all remaining findings.
- **FR-007**: All findings that completed analysis before a cancellation MUST retain their analysis results in the database.
- **FR-008**: When a `cancelAiAnalysis` request includes a scan-level identifier (instead of a single finding identifier), the system MUST cancel the entire batch operation.
- **FR-009**: System MUST capture the session identifier from the first finding's analysis response and pass it as a resume identifier for subsequent findings in the batch.
- **FR-010**: If session resumption fails, the system MUST fall back to creating a new session and continue processing the remaining findings.
- **FR-011**: After a batch completes (success or cancellation), the session MUST NOT be reused for any future operations.
- **FR-012**: If a single finding's analysis fails during a batch, the system MUST record the error for that finding and continue processing the next finding in the batch.
- **FR-013**: System MUST prevent starting a new batch analysis if one is already in progress for the same scan.
- **FR-014**: System MUST stop the batch if a configurable number of consecutive finding analyses fail (default: 3). The consecutive failure limit MUST be exposed as a user-configurable setting.
- **FR-015**: When the batch stops due to consecutive failures, the system MUST notify the user that repeated failures were detected and suggest checking AI provider configuration.

### Key Entities

- **Batch Analysis**: A transient operation representing the sequential analysis of multiple findings within a single scan. Tracked by scan identifier, includes progress state (current index, total count), and maintains an optional session identifier for reuse.
- **Batch Progress**: A progress report containing the current finding index, total findings count, the currently-active finding's identifier, and batch-level status (running, completed, cancelled, consecutive-failures, error).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can trigger analysis of all unanalyzed findings in a scan with a single action.
- **SC-002**: Users see real-time progress of the batch operation, including both the overall count (finding N of M) and per-finding activity.
- **SC-003**: Users can cancel a batch operation at any time, with all completed analyses preserved.
- **SC-004**: Subsequent findings in a batch begin analysis faster than the first finding due to session reuse (measurable by comparing time-to-first-progress between the first and subsequent findings).
- **SC-005**: If a single finding fails during batch analysis, the remaining findings still get analyzed (fault isolation).

## Assumptions

- Spec 022 (single finding analysis) is fully implemented, providing `analyzeFinding()`, per-finding progress events, cancellation, and budget tracking.
- The Claude Agent SDK supports session resumption via a session identifier returned in the initial response — the batch captures this from the first finding and passes it for subsequent findings.
- Sequential processing (one finding at a time) is the correct approach for batch analysis to work with session resumption and to keep resource usage predictable. Concurrent batch analysis is out of scope.
- Budget enforcement is not applied at the batch level. Individual finding analyses may still respect per-finding budget limits as defined by Spec 022, but the batch itself does not track or enforce cumulative cost.
- Batch analysis is not persisted as a first-class entity in the database — it's a transient operation. Only the individual finding analyses are persisted.
- The "Analyze All Findings" button appears in the findings list header area, not as a separate view.
- When a batch completes successfully, the progress indicator disappears, the button becomes disabled (all findings analyzed), and each finding displays its analysis inline. No separate completion notification is required.

## Dependencies

- **Spec 022** (Finding Analysis Core): Provides `AiService.analyzeFinding()`, the AI provider interface, message protocol, progress events, cancellation, and database persistence for individual findings.

## Scope Boundaries

**In scope**:
- `analyzeAllFindings(scanId)` method on AiService
- Batch progress messages (scan-level progress reporting)
- Scan-level "Analyze All Findings" button with progress UI
- Batch cancellation (cancel entire batch via scanId)
- Session resumption within a batch
- Error isolation (single finding failure doesn't stop batch)

**Out of scope**:
- Concurrent/parallel finding analysis within a batch
- Batch analysis across multiple scans
- Batch scheduling or automation (cron-like batch triggers)
- Batch analysis history or reporting
- Re-analysis of already-analyzed findings in batch mode (user must re-analyze individually or clear analyses first)
- Custom finding ordering or prioritization within the batch
