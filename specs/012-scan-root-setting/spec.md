# Feature Specification: Scan Root Setting

**Feature Branch**: `012-scan-root-setting`
**Created**: 2026-03-19
**Status**: Draft
**Input**: User description: "Add an ashWorkbench.scanRoot VS Code setting that scopes the entire ASH Workbench to a single root directory."

## Clarifications

### Session 2026-03-19

- Q: What should happen to findings from ad-hoc "Scan Folder..." context menu scans targeting directories outside the effective scan root? → A: Remove the "Scan Folder..." context menu option entirely. The scan root is the sole authority for what gets scanned. No ad-hoc scanning outside the scan root is allowed.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Zero-Config First Scan (Priority: P1)

A developer opens a project in VS Code and clicks "Run Scan" in the ASH Workbench sidebar. Without configuring any settings, the scan runs against the workspace root — exactly as it does today.

**Why this priority**: Preserves the existing zero-config experience. Every user hits this path first. If it breaks, the extension is unusable.

**Independent Test**: Open any single-folder workspace, click "Run Scan", verify the scan targets the workspace root directory.

**Acceptance Scenarios**:

1. **Given** a single-folder workspace with no `ashWorkbench.scanRoot` configured, **When** the user triggers "Run Scan", **Then** the scan runs against the first workspace folder's root path.
2. **Given** a single-folder workspace with `ashWorkbench.scanRoot` set to `""` (empty string), **When** the user triggers "Run Scan", **Then** the scan runs against the first workspace folder's root path (same as unset).
3. **Given** no workspace folder is open, **When** the extension activates, **Then** the extension shows a warning that a workspace folder is required and does not attempt to resolve a scan root.

---

### User Story 2 - Custom Scan Root (Priority: P1)

A developer working in a monorepo wants to scope ASH Workbench to a specific subdirectory (e.g., `services/backend`). They set `ashWorkbench.scanRoot` in their workspace settings and all scans, findings, and dashboard data are scoped to that directory.

**Why this priority**: This is the primary new capability the feature delivers. Without it, the setting has no purpose.

**Independent Test**: Set `ashWorkbench.scanRoot` to a valid subdirectory, run a scan, verify the scan targets that directory and findings display is scoped to it.

**Acceptance Scenarios**:

1. **Given** `ashWorkbench.scanRoot` is set to `/Users/dev/monorepo/services/backend`, **When** the user triggers "Run Scan", **Then** the scan targets `/Users/dev/monorepo/services/backend`.
2. **Given** `ashWorkbench.scanRoot` is set to a valid directory, **When** findings are displayed, **Then** only findings from scans whose target matches or is a subdirectory of the scan root are shown.
3. **Given** `ashWorkbench.scanRoot` is set to a valid directory, **When** the user views the scan history tree, **Then** only scans matching the current scan root are listed.
4. **Given** `ashWorkbench.scanRoot` is set to a valid directory, **When** the user views the dashboard summary, **Then** summary statistics reflect only data scoped to the scan root.

---

### User Story 3 - Real-Time Setting Change (Priority: P2)

A developer changes the `ashWorkbench.scanRoot` setting in VS Code preferences. The sidebar, scan history, and any open findings panel immediately refresh to reflect the new scope — without reloading the window.

**Why this priority**: Important for usability but secondary to the core scan/filter behavior. Users can work around this by reloading, but a live refresh is expected quality.

**Independent Test**: With the extension active and findings displayed, change `ashWorkbench.scanRoot` in settings, verify the UI updates without window reload.

**Acceptance Scenarios**:

1. **Given** the extension is active with findings displayed, **When** the user changes `ashWorkbench.scanRoot` to a different directory, **Then** the scan history tree refreshes to show only scans matching the new root.
2. **Given** the extension is active with a findings panel open, **When** the user changes `ashWorkbench.scanRoot`, **Then** a full state update is pushed to all active WebView panels (sidebar and editor panel) and the UI refreshes immediately.
3. **Given** the extension is active, **When** the user changes `ashWorkbench.scanRoot` back to a previously used root, **Then** historical scan data for that root reappears (data is filtered, not deleted).

---

### User Story 4 - Invalid Scan Root Recovery (Priority: P3)

A developer misconfigures `ashWorkbench.scanRoot` to a path that doesn't exist or isn't a directory. The extension shows a clear warning and falls back to the workspace root so the user isn't stuck.

**Why this priority**: Error handling edge case. Important for robustness but most users won't hit this path.

**Independent Test**: Set `ashWorkbench.scanRoot` to a nonexistent path, verify warning notification appears and extension falls back to workspace root.

**Acceptance Scenarios**:

1. **Given** `ashWorkbench.scanRoot` is set to a path that does not exist, **When** the extension resolves the scan root, **Then** a warning notification is displayed and the extension falls back to the first workspace folder.
2. **Given** `ashWorkbench.scanRoot` is set to a path that exists but is a file (not a directory), **When** the extension resolves the scan root, **Then** a warning notification is displayed and the extension falls back to the first workspace folder.
3. **Given** the user corrects an invalid `ashWorkbench.scanRoot` to a valid path, **When** the setting change is detected, **Then** the extension immediately uses the corrected path and clears any previous warning state.

---

### Edge Cases

- What happens when the effective scan root is changed while a scan is in progress? The running scan continues with its original target path. The new root only affects future scans and data filtering.
- What happens when the configured scan root is a relative path? The system treats the setting value as an absolute path. Relative paths are invalid and trigger the fallback behavior with a warning.
- What happens when there are no scans matching the current scan root? The dashboard and scan history show empty state — no scans found for this root.
- What happens in a multi-root workspace? The setting has `resource` scope, so each workspace folder can have its own `scanRoot` override in `.code-workspace`. The resolution reads the setting for the active context (first workspace folder by default).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST provide an `ashWorkbench.scanRoot` setting of type string with an empty string default.
- **FR-002**: System MUST resolve an empty `ashWorkbench.scanRoot` to the first workspace folder's file system path (preserving current behavior).
- **FR-003**: System MUST use a non-empty `ashWorkbench.scanRoot` value as the absolute scan root path.
- **FR-004**: System MUST validate that the resolved scan root exists and is a directory before using it.
- **FR-005**: System MUST display a warning notification when the configured scan root is invalid and fall back to the workspace folder.
- **FR-006**: System MUST default the scan target path to the effective scan root when a scan is initiated.
- **FR-007**: System MUST filter scan summaries, scan targets, dashboard summary, and findings to only include data whose scan target path matches or is a subdirectory of the effective scan root.
- **FR-008**: System MUST NOT delete historical data when the scan root changes — data is hidden by filtering, not removed.
- **FR-009**: System MUST detect changes to `ashWorkbench.scanRoot` in real time and re-resolve the effective scan root.
- **FR-010**: System MUST push a full state update to all active WebView panels (sidebar and editor panel) when the scan root changes.
- **FR-011**: System MUST refresh the scan history tree view when the scan root changes.
- **FR-012**: System MUST remove the "Scan Folder..." explorer context menu command. All scans target the effective scan root exclusively.

### Key Entities

- **Scan Root**: The single directory that scopes all ASH Workbench operations. Resolved from the `ashWorkbench.scanRoot` setting or the workspace folder. Not persisted in the database — computed at runtime.
- **Scan Target**: An existing database entity representing a directory that was scanned. Unchanged by this feature but now filtered by scan root proximity.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can run a scan with zero configuration and get the same behavior as before this feature (no regression).
- **SC-002**: Users can set a custom scan root and have all scans, findings, and dashboard data scoped to that directory within one user action (setting the value).
- **SC-003**: Changing the scan root setting causes all visible UI elements (sidebar, scan history, findings panel) to refresh within 2 seconds without requiring a window reload.
- **SC-004**: When a scan root is changed, 100% of previously visible data from a different root is hidden, and 100% of data matching the new root is shown.
- **SC-005**: Invalid scan root configurations produce a visible warning and automatic fallback — the user is never left in a broken state.

## Assumptions

- The VS Code workspace always has at least one folder open (the extension already enforces this at activation).
- The `ashWorkbench.scanRoot` value is always treated as an absolute path; relative path support is not needed.
- "Subdirectory matching" for data filtering means the scan target's path starts with the effective scan root path (string prefix match with path separator awareness).
- The existing `ScanTarget` database model and Prisma schema require no changes — filtering is applied at query time.
- The "Scan Folder..." explorer context menu command is removed. The scan root is the sole mechanism for controlling scan targets.
- A scan already in progress is not affected by a scan root change — it completes with its original target path.

## Dependencies

- No external dependencies. This is a foundation feature that other specs (e.g., .ash.yaml integration) will build upon.

## Non-Goals

- This feature does NOT add `.ash.yaml` configuration file reading.
- This feature does NOT modify the database schema or Prisma models.
- This feature does NOT remove the `ScanTarget` model — it scopes which targets are visible.
- This feature does NOT require a data migration — existing data continues to work, filtered differently.
- This feature removes the "Scan Folder..." context menu command and the ScanTargetPicker. The scan root setting is the only way to control what directory is scanned.
