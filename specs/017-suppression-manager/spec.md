# Feature Specification: Suppression Management View

**Feature Branch**: `017-suppression-manager`
**Created**: 2026-03-20
**Status**: Draft
**Depends on**: Spec 013 (.ash.yaml read), Spec 016 (.ash.yaml write)
**Input**: User description: "Add a dedicated suppression management interface to the ASH Workbench that shows all .ash.yaml suppression rules, their status, and provides edit/remove/add capabilities."

## User Scenarios & Testing *(mandatory)*

### User Story 1 — View All Suppression Rules (Priority: P1)

A developer wants to see every suppression rule defined in their `.ash.yaml` file in one place, with each rule's current status — whether it is actively suppressing findings, sitting unused, or expired. This centralised view replaces manually opening the YAML file and cross-referencing findings.

**Why this priority**: Without a complete, at-a-glance view of all rules and their statuses, none of the other management actions (edit, remove, add) have a meaningful surface. This is the foundational capability.

**Independent Test**: Can be fully tested by loading any `.ash.yaml` file with suppression rules and verifying the list renders with correct statuses and counts. Delivers immediate value by surfacing rules the user cannot see today.

**Acceptance Scenarios**:

1. **Given** a project with an `.ash.yaml` containing 5 suppression rules and a completed scan, **When** the user opens the Suppression Manager, **Then** all 5 rules are listed with columns for Rule ID, Path, Line range, Reason, Expiration, Status, and Match count.
2. **Given** a rule that matches 3 findings in the latest scan and has no expiration, **When** displayed in the list, **Then** its status is "Active" and its match count shows 3.
3. **Given** a rule with an expiration date in the past, **When** displayed in the list, **Then** its status is "Expired" regardless of whether it matches findings.
4. **Given** a rule that is not expired but matches zero findings in the latest scan, **When** displayed in the list, **Then** its status is "Unused".
5. **Given** no `.ash.yaml` file exists, **When** the user opens the Suppression Manager, **Then** an empty state is shown with a message indicating no suppression rules are defined and a prompt to add one.

---

### User Story 2 — Navigate to Suppression Manager (Priority: P1)

A developer needs to access the Suppression Manager quickly from multiple entry points: the sidebar dashboard, the editor panel header, and a VS Code command.

**Why this priority**: Equal to Story 1 — users cannot use the manager if they cannot reach it. Multiple entry points match the existing navigation patterns.

**Independent Test**: Can be tested by verifying each entry point transitions to the Suppression Manager view.

**Acceptance Scenarios**:

1. **Given** the sidebar dashboard is visible and at least one suppression rule exists, **When** the user clicks "Manage Suppressions", **Then** the editor panel opens (or navigates) to the Suppression Manager view.
2. **Given** the editor panel is open showing findings, **When** the user clicks the Suppressions tab/button in the header, **Then** the panel navigates to the Suppression Manager view.
3. **Given** VS Code is open with the extension active, **When** the user runs the "ASH: Manage Suppressions" command from the Command Palette, **Then** the Suppression Manager view opens.
4. **Given** the sidebar dashboard has no suppression rules, **When** displayed, **Then** the "Manage Suppressions" link still appears but shows "0 rules".

---

### User Story 3 — Filter, Sort, and Search Suppression Rules (Priority: P2)

A developer with many suppression rules (10+) needs to quickly find specific rules by filtering on status, sorting by column, or searching by rule ID, path, or reason text.

**Why this priority**: Supports usability at scale but is not required for basic rule visibility.

**Independent Test**: Can be tested by loading mock data with 15+ rules of mixed statuses and verifying filter, sort, and search all narrow the displayed list correctly.

**Acceptance Scenarios**:

1. **Given** a list of 15 rules with mixed statuses, **When** the user selects only the "Expired" filter chip, **Then** only expired rules are displayed.
2. **Given** the filter chips for Active, Unused, and Expired, **When** the user selects multiple chips, **Then** rules matching any selected status are shown.
3. **Given** the list is displayed, **When** the user clicks the "Match count" column header, **Then** the list sorts by match count (ascending/descending toggle).
4. **Given** the search box, **When** the user types "bandit", **Then** only rules whose Rule ID, Path, or Reason contain "bandit" are shown.
5. **Given** active filters and a search term, **When** both are applied, **Then** the list shows the intersection (rules matching the search AND the selected statuses).

---

### User Story 4 — View Matched Findings for a Rule (Priority: P2)

A developer wants to understand the impact of a suppression rule by seeing which findings from the latest scan it matches. This helps them decide whether to keep, narrow, or remove a rule.

**Why this priority**: High information value but dependent on the rule list (Story 1). Not required for basic management actions.

**Independent Test**: Can be tested by expanding a rule row and verifying the matched findings list shows correct finding references with severity, title, file, and line.

**Acceptance Scenarios**:

1. **Given** a rule with match count of 3, **When** the user expands the row, **Then** 3 findings are listed showing severity, title, file path, and line number.
2. **Given** an expanded finding in the matched list, **When** the user clicks it, **Then** the view navigates to the finding detail view for that finding.
3. **Given** a rule with match count of 0, **When** the user expands the row, **Then** a message states "No findings matched by this rule in the latest scan."

---

### User Story 5 — Remove a Suppression Rule (Priority: P2)

A developer identifies an expired or unwanted suppression rule and removes it directly from the management view, without needing to edit the YAML file by hand.

**Why this priority**: Core management action. Removal is simpler than editing and directly reduces suppression debt.

**Independent Test**: Can be tested by clicking Remove on a rule, confirming, and verifying the rule disappears and the `.ash.yaml` file is updated.

**Acceptance Scenarios**:

1. **Given** a rule with match count of 2, **When** the user clicks "Remove", **Then** a confirmation dialog appears: "Remove this suppression rule? This will unsuppress 2 finding(s) in the current scan."
2. **Given** the confirmation dialog is shown, **When** the user confirms, **Then** the rule is removed from `.ash.yaml`, the list refreshes without the rule, and previously suppressed findings become active throughout the app.
3. **Given** the confirmation dialog is shown, **When** the user cancels, **Then** no changes are made and the list remains unchanged.
4. **Given** a rule with match count of 0 (unused), **When** the user clicks "Remove", **Then** the confirmation dialog shows "Remove this suppression rule? No findings are currently matched by this rule."

---

### User Story 6 — Edit a Suppression Rule (Priority: P2)

A developer wants to modify an existing suppression rule — for example, to narrow its path, add an expiration date, or update the justification — without manually editing YAML.

**Why this priority**: Enables rule refinement. More complex than removal but essential for ongoing suppression hygiene.

**Independent Test**: Can be tested by clicking Edit on a rule, changing fields, saving, and verifying the `.ash.yaml` file reflects the changes.

**Acceptance Scenarios**:

1. **Given** a rule in the list, **When** the user clicks "Edit", **Then** an edit form appears pre-filled with the rule's current path, rule ID, reason, line range, and expiration.
2. **Given** the edit form is open, **When** the user clears the Rule ID field, **Then** it represents "any rule" (null).
3. **Given** the edit form with a changed path, **When** the user clicks "Save", **Then** the rule is updated in `.ash.yaml`, the list refreshes with the updated rule, and suppression statuses are recalculated across all findings.
4. **Given** the edit form is open, **When** the user clicks "Cancel", **Then** no changes are made and the form closes.
5. **Given** the edit form, **When** the user submits with an empty reason, **Then** the form shows a validation error requiring a justification.

---

### User Story 7 — Add a New Suppression Rule from the Management View (Priority: P3)

A developer wants to create a suppression rule that does not originate from a specific finding — for example, a broad rule to suppress all findings for a vendor directory. This is distinct from the finding-driven "Suppress" flow (Spec 016).

**Why this priority**: Useful for power users creating broad rules, but the finding-driven flow covers the most common suppression scenario.

**Independent Test**: Can be tested by clicking "Add Suppression", filling the form, saving, and verifying the rule appears in the list and `.ash.yaml`.

**Acceptance Scenarios**:

1. **Given** the Suppression Manager is open, **When** the user clicks "Add Suppression", **Then** a blank form opens with fields for Path, Rule ID, Reason, Line start/end, and Expiration.
2. **Given** the add form is open, **When** the user types a path, **Then** autocomplete suggestions appear based on file paths known from the latest scan.
3. **Given** the add form is open, **When** the user types a rule ID, **Then** autocomplete suggestions appear based on rule IDs known from the latest scan.
4. **Given** a valid form submission, **When** the user clicks "Save", **Then** the rule is added to `.ash.yaml`, the list refreshes showing the new rule with computed status and match count.
5. **Given** no `.ash.yaml` file exists, **When** the user saves a new rule, **Then** the file is created with the rule as the first suppression entry.

---

### User Story 8 — View Ignore Paths (Priority: P3)

A developer wonders why certain files have no findings and wants to check whether those files are excluded from scanning via `global_settings.ignore_paths` in `.ash.yaml`.

**Why this priority**: Informational value only — no write actions. Helps with debugging "missing" findings.

**Independent Test**: Can be tested by loading an `.ash.yaml` with ignore paths and verifying they render in a read-only table below the suppressions list.

**Acceptance Scenarios**:

1. **Given** an `.ash.yaml` with 3 ignore paths, **When** the user scrolls below the suppression list, **Then** a section titled "Ignore Paths" shows a table with columns: Path, Reason, Expiration, Status.
2. **Given** an ignore path with a past expiration date, **When** displayed, **Then** its status shows "Expired".
3. **Given** no ignore paths in `.ash.yaml`, **When** the section renders, **Then** it is hidden entirely (not shown as empty).

---

### User Story 9 — View Configuration Summary (Priority: P3)

A developer wants a quick glance at their `.ash.yaml` scan configuration (project name, severity threshold, enabled scanners, fail-on-findings flag) without opening the file.

**Why this priority**: Purely informational. Lowest priority but completes the "full picture" of the suppression management view.

**Independent Test**: Can be tested by loading an `.ash.yaml` with all config fields and verifying the info panel renders correct values.

**Acceptance Scenarios**:

1. **Given** an `.ash.yaml` with project name "my-app", severity threshold "MEDIUM", and 3 enabled scanners, **When** the config info panel renders, **Then** it shows all values read-only.
2. **Given** the source file path display, **When** the user clicks it, **Then** the `.ash.yaml` file opens in the VS Code editor.

---

### Edge Cases

- What happens when `.ash.yaml` is modified externally (e.g., by git pull) while the Suppression Manager is open? The view auto-refreshes via the existing file watcher.
- What happens when a suppression rule is edited and the underlying `.ash.yaml` has changed since the view loaded? A conflict is detected and the user warned, consistent with Spec 016 conflict handling.
- What happens when the latest scan has zero findings? All non-expired rules show as "Unused", match count is 0 for all.
- What happens when there are no scans yet? Status computation does not run; all rules show a neutral "No scan data" indicator instead of Active/Unused.
- What happens when two suppression rules overlap (both match the same finding)? Each rule independently shows its own match count; the same finding may appear under multiple rules.
- What happens when the user edits a rule to match the exact same pattern as an existing rule? The system allows it (YAML supports duplicate entries) but shows a warning.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST display all suppression entries from `.ash.yaml` in a list with Rule ID, Path, Line range, Reason, Expiration, Status, and Match count columns.
- **FR-002**: System MUST compute each rule's status as "Active" (not expired, matched at least one finding), "Unused" (not expired, matched zero findings), or "Expired" (past expiration date).
- **FR-003**: System MUST provide navigation to the Suppression Manager from the sidebar dashboard, editor panel header, and a VS Code command.
- **FR-004**: System MUST display the sidebar dashboard link with the count of active suppression rules (e.g., "Manage Suppressions (12 rules)").
- **FR-005**: System MUST display a summary header showing total rules, active count, unused count, expired count, and the source file path.
- **FR-006**: System MUST allow sorting the suppression list by any column.
- **FR-007**: System MUST allow filtering the suppression list by status using toggle chips (Active, Unused, Expired).
- **FR-008**: System MUST allow searching the suppression list by Rule ID, Path, or Reason text.
- **FR-009**: System MUST allow expanding a suppression row to see matched findings from the latest scan, each showing severity, title, file, and line number.
- **FR-010**: Clicking a matched finding MUST navigate to that finding's detail view.
- **FR-011**: System MUST allow removing a suppression rule with a confirmation dialog that shows the number of affected findings.
- **FR-012**: System MUST allow editing a suppression rule via a form pre-filled with the rule's current values.
- **FR-013**: The edit form MUST validate that Reason is non-empty before allowing save.
- **FR-014**: System MUST allow adding a new suppression rule via a blank form with the same fields as edit.
- **FR-015**: The add form MUST offer autocomplete suggestions for Path and Rule ID based on the latest scan's known file paths and rule IDs.
- **FR-016**: System MUST display ignore paths from `global_settings.ignore_paths` in a read-only table below the suppression list (hidden if none exist).
- **FR-017**: System MUST display a read-only configuration info panel showing project name, severity threshold, enabled scanners, and fail_on_findings flag.
- **FR-018**: The source file path in the summary header MUST be clickable to open `.ash.yaml` in the VS Code editor.
- **FR-019**: System MUST auto-refresh the suppression list when `.ash.yaml` changes externally (via the existing file watcher).
- **FR-020**: System MUST handle the case where no `.ash.yaml` exists by showing an empty state with a prompt to add a suppression.
- **FR-021**: System MUST handle the case where no scans exist by showing rules without status computation and a "No scan data" indicator.
- **FR-022**: When a suppression rule is removed or edited, the change MUST propagate to all other views (findings list, dashboard counts, finding detail suppression status).
- **FR-023**: Expiration date field MUST only accept dates in the future when adding or editing a rule.

### Key Entities

- **Suppression Entry**: An `.ash.yaml` suppression rule enriched with computed status (active/unused/expired), match count, and lightweight references to matched findings.
- **Ignore Path**: A read-only entry from `global_settings.ignore_paths` with path, reason, expiration, and computed active/expired status.
- **Configuration Summary**: A read-only snapshot of `.ash.yaml` settings including project name, severity threshold, enabled scanners list, and fail-on-findings flag.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can view all suppression rules and their statuses within 2 seconds of opening the Suppression Manager.
- **SC-002**: Users can identify and remove expired or unused suppression rules without opening a text editor, completing the action in under 30 seconds.
- **SC-003**: Users can find a specific suppression rule from a list of 50+ rules in under 10 seconds using search or filters.
- **SC-004**: All suppression changes made in the management view are reflected across the entire application (findings list, dashboard, detail view) within 2 seconds.
- **SC-005**: Users can navigate to the Suppression Manager from any context in 2 clicks or fewer (or 1 command palette invocation).
- **SC-006**: The management view provides complete suppression visibility — users never need to open `.ash.yaml` manually to understand their suppression configuration.

## Assumptions

- The existing AshYamlService (Spec 013) file watcher and config parsing are reused as-is.
- The existing AshYamlWriteService (Spec 016) add/remove suppression logic is extended with an update operation.
- The "Suppress" button in TriageControls remains disabled per Spec 015 — this spec does not change that behavior.
- Autocomplete suggestions for Path and Rule ID in the add form are sourced from the latest scan's findings, not from filesystem scanning.
- Status computation is based only on the latest scan's findings, not historical scans.
- Duplicate suppression rules (identical path + rule_id) are allowed by YAML but the system warns the user if detected during add/edit.

## Scope Boundaries

**In scope**:
- Viewing, adding, editing, and removing suppression rules
- Status computation (active/unused/expired) based on latest scan
- Read-only display of ignore paths and configuration summary
- Navigation from dashboard, panel header, and command palette
- Kitchen Sink demos for all new components

**Out of scope**:
- Editing non-suppression sections of `.ash.yaml` (scanners, reporters, etc.)
- Editing ignore paths from the UI (read-only in this spec)
- Full `.ash.yaml` visual editor
- Bulk operations (select-all, bulk delete)
- Import/export of suppression rules
- Suppression rule templates or presets
