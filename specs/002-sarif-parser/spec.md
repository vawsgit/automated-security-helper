# Feature Specification: SARIF Parser

**Feature Branch**: `002-sarif-parser`
**Created**: 2026-03-16
**Status**: Draft
**Input**: User description: "SARIF Parser — A standalone SARIF 2.1.0 parser that converts ASH CLI output into typed Finding records."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Parse Multi-Scanner Scan Results (Priority: P1)

When the ASH CLI completes a security scan, it produces a SARIF 2.1.0 log file containing results from multiple scanners (e.g., bandit, semgrep, checkov). The parser must extract every finding from every scanner run in that log and produce a uniform list of typed findings that downstream features can consume.

**Why this priority**: Without accurate extraction of findings from SARIF, no downstream feature (display, triage, storage) can function. This is the foundational correctness requirement.

**Independent Test**: Can be tested by providing a SARIF log with results from multiple scanners and verifying each finding is extracted with correct scanner name, rule identifier, severity, file, line number, title, and description.

**Acceptance Scenarios**:

1. **Given** a SARIF log with 3 scanner runs containing a total of 10 results, **When** the parser processes the log, **Then** it produces 10 typed findings, each attributed to the correct scanner.
2. **Given** a SARIF log with a run containing zero results, **When** the parser processes the log, **Then** it produces an empty list for that run without errors.
3. **Given** a SARIF log from a clean scan (no findings across all runs), **When** the parser processes the log, **Then** it returns an empty list.

---

### User Story 2 - Map Severity Accurately (Priority: P1)

The parser must determine the severity of each finding. ASH enriches SARIF results with custom severity properties. When present, those take precedence. When absent, the parser falls back to the standard SARIF level field, mapping it to the project's severity scale (CRITICAL, HIGH, MEDIUM, LOW, INFO).

**Why this priority**: Severity drives triage priority and display ordering. Incorrect severity mapping means users focus on the wrong findings.

**Independent Test**: Can be tested by providing SARIF results with and without ASH-specific severity properties and verifying the correct severity is assigned in each case.

**Acceptance Scenarios**:

1. **Given** a SARIF result with an ASH-specific severity property set to "CRITICAL", **When** the parser processes it, **Then** the finding severity is CRITICAL regardless of the SARIF level field.
2. **Given** a SARIF result with no ASH-specific properties and SARIF level "error", **When** the parser processes it, **Then** the finding severity is HIGH.
3. **Given** a SARIF result with no ASH-specific properties and SARIF level "warning", **When** the parser processes it, **Then** the finding severity is MEDIUM.
4. **Given** a SARIF result with no ASH-specific properties and SARIF level "note", **When** the parser processes it, **Then** the finding severity is LOW.
5. **Given** a SARIF result with no ASH-specific properties and SARIF level "none", **When** the parser processes it, **Then** the finding severity is INFO.

---

### User Story 3 - Normalize File Paths (Priority: P1)

Findings in the SARIF log contain absolute file URIs (e.g., `file:///home/user/project/src/app.py`). The parser must strip the `file://` prefix and make all paths relative to the scanned source directory, so findings are portable and display correctly regardless of where the scan was run.

**Why this priority**: Absolute paths break when the user opens the project from a different location. Relative paths are essential for linking findings to workspace files.

**Independent Test**: Can be tested by providing SARIF results with various URI formats and a source directory, then verifying all output paths are relative.

**Acceptance Scenarios**:

1. **Given** a finding at `file:///home/user/project/src/app.py` and source directory `/home/user/project`, **When** parsed, **Then** the file path is `src/app.py`.
2. **Given** a finding at `src/app.py` (already relative, no prefix), **When** parsed, **Then** the file path is `src/app.py` unchanged.
3. **Given** a finding at `file:///home/user/project/src/app.py` and source directory `/home/user/project/`, **When** parsed (trailing slash on source dir), **Then** the file path is `src/app.py`.

---

### User Story 4 - Deduplicate Findings (Priority: P2)

Multiple scanners may flag the same issue in the same file. The parser should deduplicate findings that share the same rule identifier and file path, merging their line ranges (smallest start line, largest end line), keeping the most detailed description, and concatenating scanner names so users see one consolidated finding.

**Why this priority**: Deduplication reduces noise and prevents users from triaging the same issue multiple times. It is important but not blocking for initial display.

**Independent Test**: Can be tested by providing findings with overlapping (ruleId, file) pairs and verifying the output contains exactly one finding per unique pair with merged metadata.

**Acceptance Scenarios**:

1. **Given** two findings with the same ruleId and file from different scanners (lines 10-15 and lines 12-20), **When** deduplicated, **Then** one finding remains with startLine 10, endLine 20, and both scanner names.
2. **Given** two findings with the same ruleId but different files, **When** deduplicated, **Then** both findings remain (no merge).
3. **Given** two findings with different ruleIds in the same file, **When** deduplicated, **Then** both findings remain (no merge).

---

### User Story 5 - Handle Incomplete SARIF Gracefully (Priority: P2)

SARIF results may have missing optional fields — no region (line numbers), no snippet, no endLine, no properties bag. The parser must handle all combinations of missing optional data without errors, using sensible defaults (e.g., startLine defaults to 1 when no region is provided).

**Why this priority**: Defensive handling prevents crashes and ensures the parser works with SARIF from any ASH version or third-party tool.

**Independent Test**: Can be tested by providing SARIF results with systematically removed optional fields and verifying no errors are thrown and defaults are applied.

**Acceptance Scenarios**:

1. **Given** a SARIF result with no `region` object, **When** parsed, **Then** the finding has startLine 1 and no endLine, and no error is thrown.
2. **Given** a SARIF result with no `snippet`, **When** parsed, **Then** the finding has no snippet and no error is thrown.
3. **Given** a SARIF result with no `endLine` in region, **When** parsed, **Then** the finding has no endLine and no error is thrown.
4. **Given** a SARIF result with no `properties` bag, **When** parsed, **Then** severity falls back to SARIF level mapping and no error is thrown.
5. **Given** a SARIF result with an empty `locations` array, **When** parsed, **Then** the finding uses default values for file and line and no error is thrown.

---

### Edge Cases

- What happens when the SARIF log has zero runs? Parser returns an empty list.
- What happens when a result has no `ruleId`? Parser uses "unknown" as the rule identifier.
- What happens when the tool driver has no `rules` array? Parser extracts title from the result message instead.
- What happens when the file URI uses Windows-style paths (`file:///C:/Users/...`)? Parser normalizes correctly.
- What happens when a result has multiple locations? Parser uses the first location.
- What happens when the `artifactLocation.uri` is missing? Parser uses "unknown" as the file path.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST extract all findings from all runs in a SARIF 2.1.0 log.
- **FR-002**: System MUST attribute each finding to its originating scanner using the tool driver name.
- **FR-003**: System MUST extract the rule identifier from each SARIF result.
- **FR-004**: System MUST determine severity by checking ASH-specific properties first (`severity` or `ash/severity` in the properties bag), falling back to SARIF level mapping (error→HIGH, warning→MEDIUM, note→LOW, none→INFO).
- **FR-005**: System MUST strip the `file://` prefix from artifact URIs.
- **FR-006**: System MUST convert absolute file paths to paths relative to the scanned source directory.
- **FR-007**: System MUST extract start line, end line (if present), and code snippet (if present) from each result.
- **FR-008**: System MUST extract the finding title from the tool driver's `rules[].shortDescription` when available, falling back to the result message.
- **FR-009**: System MUST deduplicate findings that share the same (ruleId, file) pair by merging line ranges and concatenating scanner names.
- **FR-010**: System MUST handle missing optional SARIF fields (region, snippet, endLine, properties, locations) without throwing errors.
- **FR-011**: System MUST return an empty list when the SARIF log contains no results.
- **FR-012**: System MUST produce an intermediate finding type that is independent of database identity fields (no id, scanId, or projectId).
- **FR-013**: System MUST default to "unknown" when ruleId or file path is absent from a result.
- **FR-014**: System MUST use startLine 1 as the default when no region is provided.

### Key Entities

- **ParsedFinding**: The output of the parser — represents a single security finding with scanner, ruleId, severity, file (relative path), startLine, endLine (optional), title, description, snippet (optional), and disposition (always PENDING for new findings).
- **SarifLog**: The input structure — a SARIF 2.1.0 log containing one or more runs, each from a different scanner, each containing zero or more results.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Parser correctly extracts 100% of findings from a multi-scanner SARIF log containing results from all 8 ASH scanners (bandit, checkov, semgrep, cdk-nag, cfn-nag, detect-secrets, grype, npm-audit).
- **SC-002**: Severity mapping produces the correct value in 100% of test cases, for both ASH-enriched and standard SARIF results.
- **SC-003**: All file paths in parser output are relative — zero absolute paths or `file://` prefixes.
- **SC-004**: Deduplication reduces findings with matching (ruleId, file) to exactly one finding per pair with merged line ranges.
- **SC-005**: Parser processes a 1000-finding SARIF log without errors and completes in under 1 second.
- **SC-006**: All unit tests pass with zero failures.

## Assumptions

- ASH CLI always produces valid SARIF 2.1.0 JSON. The parser does not need to validate SARIF schema compliance.
- ASH-specific severity properties, when present, use the keys `severity` or `ash/severity` in the result's properties bag.
- The SARIF log is fully loaded into memory before parsing (no streaming required).
- Deduplication key is (ruleId, file) — findings with the same rule and file but different line ranges are merged; findings with the same rule but different files are kept separate.
- The parser assigns `PENDING` as the default disposition for all findings.
- Multiple locations on a single result: only the first location is used.

## Scope

### In Scope
- Parsing SARIF 2.1.0 logs from ASH CLI
- Severity mapping (ASH properties + SARIF level fallback)
- File path normalization (strip prefix, make relative)
- Finding deduplication by (ruleId, file)
- Defensive handling of missing optional fields
- Typed intermediate output (ParsedFinding)

### Out of Scope
- Database storage of findings (handled by a separate spec)
- SARIF log file I/O (caller reads the file and passes JSON)
- SARIF validation or schema enforcement
- VS Code integration or UI display
- Support for SARIF versions other than 2.1.0
