# Feature Specification: .ash.yaml Read Service & Suppression Matching

**Feature Branch**: `014-ash-yaml-suppression`
**Created**: 2026-03-19
**Status**: Draft
**Input**: User description: ".ash.yaml Read Service & Suppression Matching — Introduce a service that reads .ash.yaml, parses suppression rules, and provides matching logic identical to the ASH CLI."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Suppression-aware finding list (Priority: P1)

A developer opens ASH Workbench after running a scan. Some findings in the codebase have corresponding suppression rules defined in `.ash.yaml`. The workbench reads the configuration file and matches each finding against the suppression rules using the same logic as the ASH CLI. Findings that match a suppression rule are identifiable as "suppressed" so the developer can focus triage effort on unsuppressed findings.

**Why this priority**: This is the core value — bridging the gap between `.ash.yaml` suppression state and the workbench's view of findings. Without this, developers must mentally cross-reference `.ash.yaml` with scan results.

**Independent Test**: Can be tested by placing a `.ash.yaml` with known suppression rules next to a SARIF file with matching findings, loading both, and verifying that the correct findings are flagged as suppressed.

**Acceptance Scenarios**:

1. **Given** a scan root containing `.ash.yaml` with two suppression rules, **When** the workbench loads findings from a completed scan, **Then** findings matching either rule are identified as suppressed and the matching rule is associated with each suppressed finding.
2. **Given** a suppression rule with `rule_id: "B*"` (glob pattern), **When** the workbench evaluates a finding with ruleId `B605`, **Then** the finding matches the suppression rule.
3. **Given** a suppression rule scoped to `path: "src/**/*.py"`, **When** the workbench evaluates a finding in `src/app/main.py`, **Then** the finding matches; a finding in `tests/test_main.py` does not match.
4. **Given** a suppression rule with `line_start: 10` and `line_end: 20`, **When** the workbench evaluates a finding spanning lines 15–25, **Then** the finding matches (overlap exists); a finding on lines 30–35 does not match.
5. **Given** multiple suppression rules where the first does not match a finding but the second does, **When** matching is evaluated, **Then** the second (matching) rule is returned as the match.

---

### User Story 2 - Live configuration tracking (Priority: P2)

A developer edits `.ash.yaml` in their editor (adds a new suppression rule, removes an existing one, or changes a rule's scope) while the workbench is open. The workbench detects the file change and re-evaluates suppression matching without requiring a manual refresh or rescan.

**Why this priority**: Developers iterate on suppressions frequently during triage. Immediate feedback closes the edit-verify loop and prevents stale suppression state.

**Independent Test**: Can be tested by modifying `.ash.yaml` on disk while the workbench is loaded and verifying that the service emits a configuration-changed event with updated parsed state.

**Acceptance Scenarios**:

1. **Given** the workbench is running with a loaded `.ash.yaml`, **When** the user adds a new suppression rule and saves the file, **Then** the workbench re-parses the file and the new rule is included in subsequent suppression matching.
2. **Given** the workbench is running with a loaded `.ash.yaml`, **When** the user deletes the file, **Then** the workbench reverts to an empty configuration (no suppressions, no ignore paths) and emits a change event.
3. **Given** the user saves `.ash.yaml` multiple times in rapid succession (e.g., auto-save), **When** the workbench detects changes, **Then** it processes only the final state (debounced) rather than re-parsing on every intermediate save.

---

### User Story 3 - Graceful handling of missing or invalid configuration (Priority: P2)

A developer opens ASH Workbench in a project that has no `.ash.yaml` file, or has a malformed one. The workbench operates normally with default behavior — no suppressions are applied, and no error dialogs disrupt the workflow.

**Why this priority**: Many projects start without `.ash.yaml`. The workbench must work seamlessly whether or not the file exists, and degrade gracefully on parse errors.

**Independent Test**: Can be tested by loading the workbench in a project with no `.ash.yaml` and verifying the service returns default/empty configuration without errors.

**Acceptance Scenarios**:

1. **Given** a scan root with no `.ash.yaml`, `.ash.yml`, or `.ash.json` file, **When** the workbench initializes, **Then** the configuration service returns empty suppressions, empty ignore paths, and default values for all other fields.
2. **Given** a `.ash.yaml` file containing invalid YAML syntax, **When** the workbench attempts to parse it, **Then** a warning is logged, the service returns default/empty configuration, and no error dialog is shown to the user.
3. **Given** a `.ash.yaml` file with valid YAML but unexpected structure (e.g., `suppressions` is a string instead of an array), **When** the workbench parses it, **Then** the malformed section is ignored and other valid sections are still parsed.

---

### User Story 4 - Expiration-aware suppression rules (Priority: P3)

A developer has suppression rules with expiration dates. The workbench respects these dates — expired rules no longer suppress findings, prompting the developer to re-evaluate those findings.

**Why this priority**: Expiration dates are a governance mechanism. Respecting them ensures temporary suppressions don't silently persist past their intended lifetime.

**Independent Test**: Can be tested by creating a suppression rule with a past expiration date and verifying it does not match any findings.

**Acceptance Scenarios**:

1. **Given** a suppression rule with `expiration: "2025-01-01"` (past date), **When** the workbench evaluates a finding that would otherwise match, **Then** the finding is NOT identified as suppressed.
2. **Given** a suppression rule with `expiration: "2099-12-31"` (future date), **When** the workbench evaluates a matching finding, **Then** the finding IS identified as suppressed.
3. **Given** a suppression rule with no expiration field, **When** the workbench evaluates a matching finding, **Then** the finding IS identified as suppressed (no expiration = permanent).

---

### User Story 5 - Configuration file discovery across standard locations (Priority: P3)

A developer may place the ASH configuration file in various standard locations supported by the CLI. The workbench finds the file regardless of which supported location is used.

**Why this priority**: Consistency with the CLI ensures developers don't need to restructure their project to use the workbench. Less critical than matching logic itself.

**Independent Test**: Can be tested by placing configuration files in each supported location and verifying the correct one is discovered.

**Acceptance Scenarios**:

1. **Given** `.ash.yml` exists in the scan root, **When** the workbench searches for configuration, **Then** it finds and uses `.ash.yml`.
2. **Given** no configuration file exists in the scan root but `.ash.yaml` exists in the `.ash/` subdirectory, **When** the workbench searches for configuration, **Then** it finds and uses `.ash/.ash.yaml`.
3. **Given** both `.ash.yml` (in root) and `.ash.yaml` (in `.ash/` subdirectory), **When** the workbench searches for configuration, **Then** it uses the root `.ash.yml` (first match in priority order wins).
4. **Given** `.ash.json` exists in the scan root (JSON format), **When** the workbench searches for configuration, **Then** it parses the JSON file and extracts the same configuration fields.

---

### User Story 6 - Scan root change updates configuration (Priority: P3)

A developer changes the scan root setting (from Spec 012). The workbench re-discovers and re-reads `.ash.yaml` from the new scan root, ensuring suppression matching reflects the correct project context.

**Why this priority**: Scan root changes are infrequent but must correctly cascade to configuration discovery.

**Independent Test**: Can be tested by changing the scan root setting and verifying the configuration service loads `.ash.yaml` from the new root.

**Acceptance Scenarios**:

1. **Given** the scan root is `/projectA` with its own `.ash.yaml`, **When** the user changes the scan root to `/projectB` (which has a different `.ash.yaml`), **Then** the workbench loads and uses `/projectB`'s configuration.
2. **Given** the scan root changes to a directory with no `.ash.yaml`, **When** the configuration is re-loaded, **Then** the service returns default/empty configuration.

---

### Edge Cases

- What happens when `.ash.yaml` is a symlink? Follow the symlink (standard file system behavior).
- What happens when the file is very large (thousands of suppression rules)? The service should parse and match without noticeable delay for typical workloads (under 1000 rules).
- What happens when a suppression rule has `line_end` less than `line_start`? Treat it as invalid — skip the line range check (match regardless of lines), matching the CLI's lenient behavior.
- What happens when `rule_id` contains special characters? The glob matching handles them per fnmatch conventions.
- What happens when the configuration file changes encoding? Assume UTF-8 (standard for YAML files).
- What happens when `expiration` is not a valid date string? Skip the expiration check for that rule (treat as non-expiring), log a warning.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST discover configuration files by searching the scan root in this priority order: `.ash.yml`, `.ash.yaml`, `.ash.json` in the root directory, then `.ash.yml`, `.ash.yaml`, `.ash.json` in the `.ash/` subdirectory. The first file found is used.
- **FR-002**: System MUST parse the following configuration sections: suppression rules, ignore paths, severity threshold, project name, scanner entries, and fail-on-findings flag.
- **FR-003**: System MUST match findings against suppression rules using glob-style pattern matching on rule ID and file path, line range overlap checking, and expiration date validation.
- **FR-004**: System MUST skip expired suppression rules (expiration date in the past) during matching — expired rules suppress nothing.
- **FR-005**: System MUST return the first matching suppression rule for a given finding, or indicate no match if none applies.
- **FR-006**: System MUST support batch matching of multiple findings against all suppression rules, returning a mapping of finding identifiers to their matching suppression rules.
- **FR-007**: System MUST watch for changes to configuration files in the scan root and automatically re-parse when files are created, modified, or deleted.
- **FR-008**: System MUST debounce rapid file changes (e.g., from auto-save) so that re-parsing occurs only once after changes settle.
- **FR-009**: System MUST re-discover and re-parse configuration when the scan root changes.
- **FR-010**: System MUST emit an event after re-parsing so that dependent features can update their state (e.g., re-compute suppression overlays).
- **FR-011**: System MUST return default/empty configuration when no configuration file is found — this is not an error condition.
- **FR-012**: System MUST handle malformed files gracefully — log a warning and fall back to default/empty configuration for unparseable sections.
- **FR-013**: System MUST support both YAML and JSON configuration file formats.
- **FR-014**: System MUST treat environment variable interpolation syntax (`${VAR_NAME}`) as literal strings — no variable expansion is performed. This is a known limitation documented for users.

### Key Entities

- **Suppression Rule**: A directive in `.ash.yaml` that identifies findings to suppress. Composed of: file path pattern (required), justification reason (required), rule ID pattern (optional), line range (optional), and expiration date (optional).
- **Ignore Path**: A directive in `.ash.yaml` that identifies file paths to exclude from scanning. Composed of: file path pattern (required), reason (required), and expiration date (optional).
- **ASH Configuration**: The complete parsed state of an `.ash.yaml` file, including: suppression rules, ignore paths, severity threshold, project name, scanner entries, and fail-on-findings flag.
- **Finding** (existing): A security finding from a scan, with rule ID, file path, line range, severity, and scanner information.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of findings matching valid, non-expired suppression rules in `.ash.yaml` are correctly identified as suppressed (zero false negatives for the documented matching algorithm).
- **SC-002**: Zero findings are incorrectly identified as suppressed when they do not match any suppression rule (zero false positives).
- **SC-003**: Configuration file changes are detected and re-parsed within 1 second of the file being saved (excluding debounce window).
- **SC-004**: The workbench operates normally (no errors, no missing functionality) when no `.ash.yaml` file exists in the scan root.
- **SC-005**: Suppression matching for a batch of 500 findings against 100 rules completes within 500 milliseconds.
- **SC-006**: The workbench's suppression matching produces identical results to the ASH CLI for the same `.ash.yaml` and finding set (behavioral parity).

## Scope & Boundaries

### In Scope

- Reading and parsing `.ash.yaml` / `.ash.yml` / `.ash.json` configuration files
- Suppression rule matching logic (rule ID glob, path glob, line overlap, expiration)
- File system watching for configuration changes with debounce
- Scan root change integration (re-discovery on root change)
- Exposing parsed configuration state (suppressions, ignore paths, severity threshold, project name, scanners, fail-on-findings)
- Emitting change events for downstream consumers

### Out of Scope

- Writing to `.ash.yaml` (covered by a separate future spec)
- Modifying the WebView UI to display suppression state (covered by a separate future spec)
- Changing finding disposition logic based on suppression matches (covered by a separate future spec)
- Configuring scanners via `.ash.yaml` — scanner entries are read-only/informational
- Environment variable interpolation in `.ash.yaml` values (documented known limitation)

## Dependencies & Assumptions

### Dependencies

- **Spec 012 (Scan Root Setting)**: The configuration file discovery depends on the effective scan root resolved by the scan root service.

### Assumptions

- `.ash.yaml` files use UTF-8 encoding.
- The ASH CLI's suppression matching algorithm (fnmatch glob on rule ID and path, line range overlap, expiration check) is stable and will not change in breaking ways.
- Typical projects have fewer than 1000 suppression rules in `.ash.yaml`.
- The glob matching for rule IDs and file paths follows fnmatch conventions (shell-style wildcards: `*`, `?`, `[seq]`, `[!seq]`), consistent with the ASH CLI.
- The severity threshold, project name, scanner list, and fail-on-findings fields are informational in this spec — they are parsed and exposed but do not drive any workbench behavior in this feature.
