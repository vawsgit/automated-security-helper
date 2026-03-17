# Feature Specification: Finding Triage

**Feature Branch**: `009-finding-triage`
**Created**: 2026-03-17
**Status**: Draft
**Dependencies**: Spec 006 (Finding Queries, Filters & Summary)

## Overview

When a developer reviews security findings, they need to classify each finding with a disposition (Pending, Fix, Suppress, Defer) and optionally attach notes explaining their reasoning. These triage decisions persist to the database so that progress is retained across sessions. After each disposition change, the summary bar immediately reflects the updated counts.

## User Scenarios & Testing

### User Story 1 - Set Finding Disposition (Priority: P1)

A developer reviewing a security finding decides how to handle it by setting a disposition: Fix (will address the issue), Suppress (false positive or accepted risk), Defer (address later), or reset to Pending. The disposition is saved immediately and the finding list and summary bar reflect the change without requiring a page refresh or manual save.

**Why this priority**: Triage is the core action that converts a raw scan result into an actionable work item. Without persistent dispositions, the developer loses all triage progress when they close the editor.

**Independent Test**: After a scan with findings, click a finding, set its disposition to "Fix." Close and reopen the extension. The finding's disposition should still show "Fix." The summary bar should show the correct count for each disposition category.

**Acceptance Scenarios**:

1. **Given** a finding with disposition "Pending", **When** the user sets the disposition to "Fix", **Then** the disposition is persisted and the finding list shows "Fix"
2. **Given** a finding with disposition "Fix", **When** the user changes it to "Suppress", **Then** the disposition updates to "Suppress" and the summary bar counts adjust (Fix -1, Suppress +1)
3. **Given** a finding with any disposition, **When** the user sets it to any other valid disposition, **Then** the transition succeeds (all four states are reachable from any state)
4. **Given** a finding whose disposition was changed, **When** the extension is reloaded, **Then** the finding retains the previously set disposition

---

### User Story 2 - Add Triage Notes (Priority: P2)

A developer wants to record reasoning for their triage decision. They add a short text note to a finding explaining why they chose to suppress, defer, or fix it. Notes are saved immediately as the user types (or on blur) and persist across sessions.

**Why this priority**: Notes provide context for triage decisions. Without them, a "Suppress" disposition is opaque -- no one knows why. However, disposition is more critical to basic workflow than notes.

**Independent Test**: Select a finding, type a note in the notes field. Close and reopen the extension. The note should still be there. Notes should be limited to 500 characters.

**Acceptance Scenarios**:

1. **Given** a finding with no notes, **When** the user types a note and the input loses focus, **Then** the note is saved to the database
2. **Given** a finding with an existing note, **When** the user modifies the note, **Then** the updated note is persisted
3. **Given** a finding with a saved note, **When** the extension is reloaded, **Then** the note content is preserved
4. **Given** a note input, **When** the user types more than 500 characters, **Then** the input is limited to 500 characters (enforced by the UI)

---

### Edge Cases

- What happens when a disposition update fails (e.g., finding was deleted between listing and triage)? The system should display an error message and not crash.
- What happens when two panels attempt to update the same finding's disposition simultaneously? The last write wins; no conflict resolution is needed for a single-user extension.
- What happens when a notes save fails? The system should display an error and retain the note in the UI so the user can retry.
- What happens when the user sets a disposition on a finding from a previous scan that is no longer the active scan? The disposition should still be saved (dispositions are per-finding, not per-scan-session).

## Requirements

### Functional Requirements

- **FR-001**: The system MUST persist disposition changes to the database immediately when the user selects a disposition
- **FR-002**: The system MUST support all four disposition values: Pending, Fix, Suppress, Defer
- **FR-003**: Any disposition state MUST be reachable from any other disposition state (no restricted transitions)
- **FR-004**: The summary bar MUST update disposition counts immediately after a disposition change
- **FR-005**: The finding list MUST reflect the updated disposition immediately after a change
- **FR-006**: Disposition changes MUST survive extension reload (persisted in database)
- **FR-007**: The disposition update handler MUST route through the findings service for consistent data access patterns
- **FR-008**: The system MUST persist triage notes to the database when the user saves a note
- **FR-009**: Triage notes MUST be limited to 500 characters (enforced by the UI)
- **FR-010**: Notes MUST survive extension reload (persisted in database)
- **FR-011**: The system MUST handle failed disposition or notes updates gracefully with an error message and no crash

### Key Entities

- **Finding**: Existing entity. The `disposition` field already exists. A `notes` text field needs to be added to support triage notes.
- **Disposition**: Existing enum with four values: PENDING, FIX, SUPPRESS, DEFER. No changes needed.

## Success Criteria

### Measurable Outcomes

- **SC-001**: Disposition changes are persisted and reflected in the UI within 200ms of user action
- **SC-002**: 100% of disposition transitions between any two states succeed without error
- **SC-003**: Disposition and notes data survives extension reload with zero data loss
- **SC-004**: Summary bar counts are mathematically correct after any sequence of disposition changes (sum of all dispositions equals total finding count)
- **SC-005**: Notes of up to 500 characters are persisted and retrieved without truncation or corruption
- **SC-006**: Zero unhandled exceptions when a disposition update targets a finding that no longer exists

## Assumptions

- The WebView triage controls (disposition buttons, notes textarea) already exist and emit the correct message types
- The `setDisposition` message type already exists in the message protocol
- The `dispositionUpdated` response message type already exists in the message protocol
- A `setNotes` message type may need to be added to the message protocol
- The `notes` field on `FindingRow` view type already exists but maps to an empty string; the database column needs to be added
- The 500-character limit for notes is enforced in the WebView UI, not in the service layer

## Out of Scope

- Bulk disposition changes (setting disposition on multiple findings at once)
- Disposition history or audit trail (tracking who changed what and when)
- Suppression YAML generation from disposition data
- AI-powered triage suggestions
- Disposition filtering (already implemented in Spec 006)
