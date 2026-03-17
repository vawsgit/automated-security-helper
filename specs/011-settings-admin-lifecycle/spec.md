# Feature Specification: Settings, Admin & Application Lifecycle

**Feature Branch**: `011-settings-admin-lifecycle`
**Created**: 2026-03-17
**Status**: Draft
**Input**: User description: "Settings, Admin & Application Lifecycle"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Extension Settings Configuration (Priority: P1)

A developer installs the ASH Workbench extension and wants to configure how it behaves — where the ASH CLI executable is located, which execution mode to use (local or container), scan timeout limits, default severity thresholds, and LLM provider settings. They open VS Code Settings, navigate to the "ASH Workbench" section, and adjust values. The extension immediately respects their updated preferences on the next scan.

**Why this priority**: Settings are foundational — every other feature (scanning, triage, AI enrichment) depends on correct configuration values. Without user-accessible settings, the extension is locked to hardcoded defaults.

**Independent Test**: Open VS Code Settings, filter by "ASH Workbench", verify all configuration properties are visible with correct defaults, types, and descriptions. Change a value, trigger a scan, and confirm the extension uses the updated setting.

**Acceptance Scenarios**:

1. **Given** a fresh install with no user overrides, **When** the developer opens Settings and filters by "ASH Workbench", **Then** all configuration properties appear with their documented default values.
2. **Given** the developer has changed the ASH CLI path setting, **When** they start a scan, **Then** the extension uses the configured path to invoke the CLI.
3. **Given** the developer sets the scan timeout to 60 seconds, **When** a scan exceeds 60 seconds, **Then** the scan is terminated and marked as failed with a timeout message.
4. **Given** the developer sets execution mode to "container", **When** they start a scan, **Then** the extension passes the container flag to the ASH CLI.

---

### User Story 2 - Application Reset (Priority: P2)

A developer's database has become corrupted or they want a clean slate. They invoke a "Reset Application" command, confirm through a warning dialog, and the extension drops all data, reinitializes the database, and returns to a fresh-install state. All scan history, findings, and triage data are permanently removed.

**Why this priority**: Reset is the critical safety net for database corruption or schema migration failures. It gives users a guaranteed recovery path without reinstalling the extension.

**Independent Test**: Run a scan to populate data, invoke the reset command, confirm the dialog, verify all data is gone, and verify the extension behaves as a fresh install.

**Acceptance Scenarios**:

1. **Given** the database contains scans and findings, **When** the developer invokes "Reset Application" and confirms the dialog, **Then** all scans, findings, and triage data are permanently deleted, the database is reinitialized, and the extension behaves as a fresh install.
2. **Given** the developer invokes "Reset Application", **When** the confirmation dialog appears and they cancel, **Then** no data is deleted and the extension continues operating normally.
3. **Given** the reset completes successfully, **When** the developer views the scan history tree and sidebar, **Then** both show empty state (no scans, no findings).

---

### User Story 3 - Application Info Display (Priority: P3)

A developer wants to check the current state of the extension — what version is installed, what database schema version is active, and how much data is stored. They request application info through the workbench UI and see a summary of extension version, schema version, and database statistics (project count, scan count, finding count).

**Why this priority**: Diagnostics are helpful for troubleshooting and support, but not essential for core functionality.

**Independent Test**: Invoke the application info request, verify the response contains extension version, schema version, and accurate counts of projects, scans, and findings.

**Acceptance Scenarios**:

1. **Given** the extension is running with populated data, **When** the developer requests application info, **Then** they see the extension version, database schema version, and counts for projects, scans, and findings.
2. **Given** a fresh install with no data, **When** the developer requests application info, **Then** they see version information with all counts at zero (except the auto-created project).

---

### User Story 4 - Automatic Schema Migration on Activation (Priority: P2)

A developer updates the ASH Workbench extension to a newer version that includes database schema changes. On activation, the extension detects the schema is behind the expected version, automatically runs pending migrations, and continues operation with no user intervention required. If migration fails, the developer sees an error with options to retry or reset.

**Why this priority**: Same priority as reset — without forward migration, any schema change becomes a breaking update that forces users to reset. Together, US2 and US4 provide the complete lifecycle safety net.

**Independent Test**: Start the extension with an older schema version, verify migrations run automatically, verify no data is lost, verify the extension operates normally afterward. Simulate a migration failure and verify the error/retry/reset options appear.

**Acceptance Scenarios**:

1. **Given** the database schema is one version behind, **When** the extension activates, **Then** pending migrations run automatically, existing data is preserved, and the extension operates normally.
2. **Given** a fresh install with no database, **When** the extension activates, **Then** all migrations run from scratch and the database is fully initialized.
3. **Given** a migration fails during activation, **When** the error is displayed, **Then** the developer sees options to retry the migration or reset the application.
4. **Given** the schema is already up to date, **When** the extension activates, **Then** no migration runs and activation proceeds without delay.

---

### Edge Cases

- What happens when the ASH CLI path setting points to a non-existent executable? The scanner reports a clear "CLI not found" error with installation instructions.
- What happens when a reset is attempted while a scan is running? The reset is blocked with a message to cancel the scan first.
- What happens when a migration partially completes before failing? The system rolls back the failed migration and reports the error, leaving the database in the pre-migration state.
- What happens when the user sets an invalid value for scan timeout (e.g., negative number)? The setting schema enforces a minimum value; invalid entries revert to the default.
- What happens when the LLM settings are configured but the LLM feature is not yet available? The settings are stored but have no effect until the AI enrichment feature is implemented.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The extension MUST expose all configuration properties in the VS Code Settings UI under the "ASH Workbench" group.
- **FR-002**: The extension MUST provide a CLI path setting (string, default "ash") that controls which executable is invoked for scans.
- **FR-003**: The extension MUST provide an execution mode setting (choice of "local" or "container", default "local") that controls how the ASH CLI runs.
- **FR-004**: The extension MUST provide a scan timeout setting (number in seconds, minimum 30, default 600) that terminates scans exceeding the limit.
- **FR-005**: The extension MUST provide a default severity threshold setting (choice of CRITICAL, HIGH, MEDIUM, LOW, or INFO; default "LOW") for filtering scan results.
- **FR-006**: The extension MUST provide LLM configuration settings for provider, region, and model identifier with sensible defaults for future AI enrichment features.
- **FR-007**: The extension MUST provide a "Reset Application" command that permanently deletes all data and reinitializes the database after user confirmation.
- **FR-008**: The reset confirmation MUST use a modal warning dialog that requires explicit confirmation before proceeding.
- **FR-009**: The reset MUST be blocked if a scan is currently running, with a message instructing the user to cancel the scan first.
- **FR-010**: The extension MUST provide application info that includes extension version, database schema version, and data counts (projects, scans, findings).
- **FR-011**: The extension MUST automatically detect and run pending database migrations when activated with an older schema.
- **FR-012**: Migration failures MUST display an error with retry and reset options.
- **FR-013**: Successful migrations MUST preserve all existing data.
- **FR-014**: After a reset, all UI surfaces (sidebar, tree view, editor panels) MUST reflect the empty state.

### Key Entities

- **Configuration Property**: A user-adjustable setting with a name, type, default value, and validation constraints. Grouped under the "ASH Workbench" category in VS Code Settings.
- **Application Info**: A read-only snapshot of extension version, schema version, and aggregate data counts. Not persisted — computed on demand.
- **Schema Migration**: An ordered, idempotent database transformation that moves the schema from one version to the next. Tracked via a migrations metadata table.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of documented configuration properties are visible and editable in the VS Code Settings UI with correct defaults.
- **SC-002**: Users can reset the application and return to a clean state in under 5 seconds, with zero residual data.
- **SC-003**: Application info accurately reports version, schema version, and data counts that match actual database contents.
- **SC-004**: Schema migrations complete automatically on activation with zero user intervention when the schema is behind.
- **SC-005**: Migration failures present actionable recovery options (retry/reset) within 2 seconds of failure detection.

## Assumptions

- LLM settings (provider, region, model ID) are stored for future use by an AI enrichment feature that is not yet implemented. These settings have no runtime effect in this spec.
- The "default severity threshold" setting will be consumed by future filtering features; for now it is stored but not actively used for automatic filtering.
- The database migration runner already exists from Spec 001 and will be enhanced, not replaced.
- The extension version is read from the extension's package metadata at runtime.
- Schema version is determined by the count or name of the latest applied migration in the metadata table.

## Dependencies

- **Spec 001 (Database)**: Provides the existing database initialization and migration infrastructure.
- **Spec 003 (Project Lifecycle)**: Provides project record creation on first run.
- **Spec 005 (Scan Execution)**: Scanner service reads CLI path and execution mode settings.
