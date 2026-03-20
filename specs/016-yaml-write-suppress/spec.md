# Feature Specification: .ash.yaml Write & Suppress Action

**Feature Branch**: `016-yaml-write-suppress`
**Created**: 2026-03-19
**Status**: Draft
**Depends On**: Spec 013 (.ash.yaml read service), Spec 015 (current findings view with suppression overlay)

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Suppress a Finding via the Workbench (Priority: P1)

A security analyst reviewing findings in the workbench wants to suppress a specific finding by writing a suppression entry directly to `.ash.yaml` without leaving the editor. They click "Suppress" on a finding, provide a justification, review the generated YAML entry, and confirm. The workbench writes the entry to `.ash.yaml` and the finding immediately shows as suppressed.

**Why this priority**: This is the core value proposition — closing the loop between viewing suppressions (read) and creating them (write). Without this, users must hand-edit `.ash.yaml`, which is error-prone and breaks the triage workflow.

**Independent Test**: Can be fully tested by suppressing a single finding and verifying the entry appears in `.ash.yaml` and the finding's suppression status updates in the UI.

**Acceptance Scenarios**:

1. **Given** a finding is displayed in the findings view, **When** the user clicks "Suppress," **Then** a suppression form is shown with the finding's file path and rule pre-populated.
2. **Given** the suppression form is open, **When** the user enters a justification and clicks "Add Suppression," **Then** the entry is written to `.ash.yaml` and the finding displays as suppressed.
3. **Given** the suppression form is open, **When** the user changes the scope to "This rule everywhere," **Then** the YAML preview updates to show `path: "**"` with the rule ID.
4. **Given** the suppression form is open, **When** the user leaves the justification empty and clicks "Add Suppression," **Then** validation prevents submission and highlights that justification is required.
5. **Given** no `.ash.yaml` file exists in the scan root, **When** the user confirms a suppression, **Then** the system creates the file with a valid skeleton structure containing the new entry.

---

### User Story 2 - Review Suppression Before Writing (Priority: P1)

Before committing a suppression to `.ash.yaml`, the analyst wants to review exactly what will be written. The form shows a live YAML preview that updates as they fill in the justification, adjust scope, or toggle line ranges. This gives them confidence that the generated entry is correct.

**Why this priority**: Equally critical to Story 1 — `.ash.yaml` is a shared configuration file checked into source control. Users must see exactly what they're writing before it's committed. A wrong entry could suppress findings globally or unintentionally.

**Independent Test**: Can be tested by opening the suppression form and verifying that changes to justification, scope, and line range options are immediately reflected in the YAML preview.

**Acceptance Scenarios**:

1. **Given** the suppression form is open, **When** the user types in the justification field, **Then** the YAML preview updates in real time to reflect the reason text.
2. **Given** the suppression form is open with scope set to "This file + rule," **When** the user switches scope to "This file (all rules)," **Then** the YAML preview removes the `rule_id` field.
3. **Given** the suppression form is open, **When** the user toggles "Include line range" on, **Then** the YAML preview adds `line_start` and `line_end` fields matching the finding's line numbers.
4. **Given** the suppression form is open, **When** the user sets an expiration date, **Then** the YAML preview includes the `expiration` field with the selected date.

---

### User Story 3 - Unsuppress a Finding (Priority: P2)

An analyst reviewing previously suppressed findings decides a suppression is no longer appropriate — perhaps the code has changed or the justification is outdated. They click "Unsuppress" on a suppressed finding, confirm the removal, and the entry is deleted from `.ash.yaml`. The finding returns to its active (unsuppressed) state.

**Why this priority**: Important for maintaining `.ash.yaml` hygiene, but less frequent than creating suppressions. Users can also hand-edit the file to remove entries. This provides a convenient UI path.

**Independent Test**: Can be tested by unsuppressing a currently suppressed finding and verifying the entry is removed from `.ash.yaml` and the finding's suppression status updates.

**Acceptance Scenarios**:

1. **Given** a finding is currently suppressed via `.ash.yaml`, **When** the user clicks "Unsuppress," **Then** a confirmation dialog shows the matching rule and file path.
2. **Given** the unsuppress confirmation is shown, **When** the user confirms, **Then** the matching suppression entry is removed from `.ash.yaml` and the finding no longer shows as suppressed.
3. **Given** the unsuppress confirmation is shown, **When** the user cancels, **Then** no changes are made to `.ash.yaml`.

---

### User Story 4 - Configure Suppression Scope (Priority: P2)

An analyst suppressing a finding wants control over how broadly the suppression applies. They can choose between suppressing just this file + rule (default), the rule across all files, or all rules in this file. This prevents the need to hand-edit `.ash.yaml` for common suppression patterns.

**Why this priority**: Scope control prevents common mistakes (e.g., accidentally suppressing a rule globally when only one file was intended). The default "This file + rule" is the safest choice, making other scopes opt-in.

**Independent Test**: Can be tested by creating suppressions with each scope option and verifying the correct `path` and `rule_id` values are written to `.ash.yaml`.

**Acceptance Scenarios**:

1. **Given** the suppression form is open, **When** the user selects "This file + rule" (default), **Then** the entry uses the finding's file path and rule ID.
2. **Given** the suppression form is open, **When** the user selects "This rule everywhere," **Then** the entry uses `path: "**"` (wildcard) with the finding's rule ID.
3. **Given** the suppression form is open, **When** the user selects "This file (all rules)," **Then** the entry uses the finding's file path with no `rule_id` (matches all rules).

---

### Edge Cases

- **Invalid YAML file**: If `.ash.yaml` contains invalid YAML that cannot be parsed, the system refuses to write and displays a clear error message instructing the user to fix the file manually. It never overwrites or corrupts a file it cannot parse.
- **External modification during suppress flow**: The system re-reads the file immediately before writing. If the file changed since last read (detected via modification timestamp), it retries once with fresh content. If the retry also detects a conflict, it shows an error.
- **Suppress on already-suppressed finding**: The suppress action is not available for findings already suppressed via `.ash.yaml`. Only the "Unsuppress" action is shown.
- **Unsuppress when entry already removed externally**: The system re-reads the file, finds no matching entry, and informs the user that the suppression no longer exists in `.ash.yaml`.
- **Finding has no specific line numbers**: The "Include line range" option is hidden or disabled. The entry is written without `line_start`/`line_end` fields.
- **Missing `global_settings.suppressions` key**: If `.ash.yaml` exists but lacks this key, the system creates the missing key structure and appends the entry.
- **Suppression entry matches multiple findings**: Each matched finding shows as suppressed. Unsuppressing removes the single entry, which may unsuppress multiple findings — the confirmation dialog warns about this when applicable.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST allow users to create suppression entries from any finding displayed in the findings view.
- **FR-002**: The system MUST require a non-empty justification (reason) before allowing a suppression to be created.
- **FR-003**: The system MUST show a live YAML preview of the suppression entry that updates as the user modifies form fields.
- **FR-004**: The system MUST support three suppression scope presets: "This file + rule" (default), "This rule everywhere," and "This file (all rules)."
- **FR-005**: The system MUST allow users to optionally include line range constraints in the suppression entry.
- **FR-006**: The system MUST allow users to optionally set an expiration date on the suppression entry.
- **FR-007**: The system MUST write the suppression entry to the `.ash.yaml` file in the scan root directory.
- **FR-008**: If no `.ash.yaml` file exists, the system MUST create one with a valid skeleton structure containing the new entry.
- **FR-009**: The system MUST preserve existing content, structure, and comments in `.ash.yaml` when writing new entries.
- **FR-010**: The system MUST re-read `.ash.yaml` immediately before every write operation to avoid overwriting external changes.
- **FR-011**: The system MUST refuse to write to `.ash.yaml` if the file contains invalid YAML, and MUST display a clear error message.
- **FR-012**: The system MUST allow users to remove a suppression entry from `.ash.yaml` for any currently suppressed finding ("Unsuppress").
- **FR-013**: The system MUST show a confirmation before removing a suppression entry, displaying the matching rule and file path.
- **FR-014**: After writing or removing a suppression, the finding's suppression status MUST update automatically in the UI without manual refresh.
- **FR-015**: The suppress action MUST NOT change the finding's in-app triage disposition (PENDING, FIX, DEFER). Triage state and `.ash.yaml` suppression are independent.
- **FR-016**: The suppress action MUST be visually distinct from triage disposition actions (FIX, DEFER) to communicate that it writes to a file rather than updating in-app state.
- **FR-017**: The suppression form MUST pre-populate the justification from existing finding notes if available.
- **FR-018**: The "Include line range" option MUST default to off, since line numbers shift as code changes.
- **FR-019**: The suppress action MUST NOT be available for findings that are already suppressed via `.ash.yaml`. Only the unsuppress action should be shown for those findings.

### Key Entities

- **Suppression Entry**: A record in `.ash.yaml` that tells ASH CLI and the workbench to treat matching findings as suppressed. Key attributes: file path pattern, rule ID pattern, justification reason, optional line range, optional expiration date.
- **Suppression Input**: The user's choices when creating a suppression — scope selection, justification text, line range toggle, and optional expiration.
- **Finding**: An existing security finding from a scan. The suppress action reads the finding's file path, rule ID, and line numbers to generate a suppression entry.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can suppress a finding from the workbench in under 30 seconds (open form, enter justification, confirm).
- **SC-002**: 100% of suppression entries written by the workbench are valid and recognized by the ASH CLI.
- **SC-003**: The suppression status of a finding updates in the UI within 2 seconds of the `.ash.yaml` write completing.
- **SC-004**: Users can unsuppress a finding in under 10 seconds (click unsuppress, confirm).
- **SC-005**: Zero data loss — writing a suppression never corrupts or loses existing `.ash.yaml` content, including comments and formatting.
- **SC-006**: The YAML preview in the suppression form matches what is written to the file (the entry portion).

## Assumptions

- The `.ash.yaml` file is located in the scan root directory as established by Spec 012 (scan root setting).
- The existing file watcher (Spec 013) handles re-parsing `.ash.yaml` after writes, so no additional refresh mechanism is needed.
- The AshSuppression composite key (path + rule_id + line_start + line_end) is sufficient to uniquely identify suppression entries for removal.
- Users understand that `.ash.yaml` is a file checked into source control, and that suppressions created in the workbench will appear in git diffs.
- The suppression form UI is designed with a clear insertion point for a future "Generate with AI" button next to the justification textarea, though AI justification is not part of this feature.

## Scope Boundaries

**In Scope**:
- Writing new suppression entries to `.ash.yaml`
- Removing existing suppression entries from `.ash.yaml`
- Interactive suppression form with scope, line range, expiration, and justification fields
- Live YAML preview
- Conflict detection on write (re-read + modification timestamp check)

**Out of Scope**:
- Standalone suppression management view (listing/editing all suppressions) — future spec
- AI-generated justifications — future feature; this spec only ensures the architecture supports it
- Modifying non-suppression sections of `.ash.yaml` (scanners, reporters, etc.)
- Updating an existing suppression's fields in place (users should unsuppress + re-suppress, or hand-edit)
- Bulk suppress/unsuppress actions across multiple findings
