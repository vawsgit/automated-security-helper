# Tasks: SARIF Parser

**Feature**: 002-sarif-parser
**Branch**: `002-sarif-parser`
**Generated**: 2026-03-16

---

## Phase 1: Setup

**Goal**: Establish shared SARIF types importable by both production code and tests.

- [x] T001 Extract SARIF type interfaces (`SarifLog`, `SarifRun`, `SarifResult`) from `vsix/src/test/fixtures/sarif-factory.ts` into a new shared types file `vsix/src/types/sarif.ts`. Re-export them from the factory file so existing test imports remain unchanged. The types file must be importable by production code in `vsix/src/services/`.
- [x] T002 Define the `Severity` type (`'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO'`) and `ParsedFinding` interface in `vsix/src/services/sarif.ts` as exports. ParsedFinding fields: `ruleId: string`, `scanner: string`, `severity: Severity`, `file: string`, `startLine: number`, `endLine?: number`, `title: string`, `description: string`, `snippet?: string`. See contracts/sarif-parser.md for the full type definition.
- [x] T003 Add factory helper functions to `vsix/src/test/fixtures/sarif-factory.ts`: (a) `createAshSeverityResult(severity: string, level: string)` — creates a SarifResult with `properties.severity` set to the given severity and the given SARIF level; (b) `createMultiRunSarif(configs: Array<{toolName: string, results: SarifResult[]}>)` — creates a SarifLog with one run per config entry; (c) `createMinimalResult(overrides?: Partial<SarifResult>)` — creates a result with only required SARIF fields (ruleId, level, message), no locations or properties.

**Checkpoint**: `npm run compile` succeeds. Types are importable from both `vsix/src/services/` and `vsix/src/test/`.

---

## Phase 2: Foundational — Core Parser Functions

**Goal**: Implement all 4 exported functions in `vsix/src/services/sarif.ts`.

- [x] T004 Implement `extractSeverity(result: SarifResult, run: SarifRun): Severity` in `vsix/src/services/sarif.ts`. Priority chain: (1) check `result.properties?.severity`, uppercase and return if it's a valid Severity; (2) check `result.properties?.['ash/severity']`, same treatment; (3) fall back to SARIF level mapping: `error→HIGH`, `warning→MEDIUM`, `note→LOW`, `none→INFO`; (4) if level is missing, default to `MEDIUM` (SARIF spec default for absent level is "warning"). Define a `SEVERITY_ORDER` constant mapping severity to numeric rank for use by deduplication. See contracts/sarif-parser.md extractSeverity section and research.md R1.
- [x] T005 Implement `normalizeFilePath(uri: string, sourceDir: string): string` in `vsix/src/services/sarif.ts`. Steps: (1) if uri is empty/undefined, return `"unknown"`; (2) strip `file://` prefix if present (handle both `file:///path` and `file://path`); (3) decode URI-encoded characters via `decodeURIComponent`; (4) if the resulting path is absolute and starts with sourceDir (after normalizing trailing slash), compute relative path using `path.relative(sourceDir, absolutePath)`; (5) if already relative, return as-is. Use `node:path` for path operations. See contracts/sarif-parser.md normalizeFilePath section.
- [x] T006 Implement `deduplicateFindings(findings: ParsedFinding[]): ParsedFinding[]` in `vsix/src/services/sarif.ts`. Group findings by `(ruleId, file)` key using a Map. For each group with multiple findings: `startLine` = min of all, `endLine` = max of all defined endLines (undefined if none defined), `description` = longest text, `scanner` = unique names joined with `", "`, `title` = first non-empty, `snippet` = first non-empty, `severity` = highest using SEVERITY_ORDER constant from T004. Return one finding per unique key. See contracts/sarif-parser.md deduplicateFindings section and data-model.md Deduplication Rules.
- [x] T007 Implement `parseSarif(sarifJson: SarifLog, sourceDir: string): ParsedFinding[]` in `vsix/src/services/sarif.ts`. This is the main entry point. Steps: (1) if `sarifJson.runs` is falsy or empty, return `[]`; (2) for each run, get scanner name from `run.tool.driver.name`; (3) build a rules lookup Map from `run.tool.driver.rules` (id → shortDescription.text) for title extraction; (4) for each result in `run.results`, build a ParsedFinding: ruleId from `result.ruleId` or `"unknown"`, scanner from run, severity from `extractSeverity()`, file from `normalizeFilePath()` on first location's URI, startLine/endLine/snippet from first location's region (defaults: startLine=1, endLine=undefined, snippet=undefined), title from rules lookup or `result.message.text`, description from `result.message.text`; (5) call `deduplicateFindings()` on the collected array; (6) return result. Export all 4 functions. See contracts/sarif-parser.md parseSarif section.

**Checkpoint**: `npm run compile` succeeds. All 4 functions are exported and callable. Manual smoke test: create a simple script that calls `parseSarif()` with a minimal SarifLog and prints results.

---

## Phase 3: User Story 1 — Parse Multi-Scanner Scan Results (Priority: P1)

**Goal**: Verify parser correctly extracts findings from multi-scanner SARIF logs.

**Independent Test**: Provide a SARIF log with multiple scanner runs, verify each finding is extracted with correct scanner attribution.

- [x] T008 [US1] Create test file `vsix/src/test/unit/sarif.test.ts` with test infrastructure: import assert, import all 4 parser functions from `../../services/sarif`, import factory functions from `../fixtures/sarif-factory`. Create top-level `describe('SARIF Parser')` block.
- [x] T009 [US1] Add test "extracts findings from multi-run SARIF with all 8 ASH scanners" in `vsix/src/test/unit/sarif.test.ts`: use `createMultiRunSarif()` to create a SARIF log with 8 runs (one per scanner: bandit, checkov, semgrep, cdk-nag, cfn-nag, detect-secrets, grype, npm-audit), each with 1-2 results. Call `parseSarif()` and verify: (a) total finding count matches sum of all results (before dedup — use unique ruleId+file per result), (b) each finding's scanner field matches the expected tool name. Maps to spec US1 acceptance scenario 1, SC-001.
- [x] T010 [US1] Add test "handles empty results array (clean scan)" in `vsix/src/test/unit/sarif.test.ts`: create a SarifLog with 2 runs, both with empty `results: []`. Call `parseSarif()`, verify it returns `[]`. Maps to spec US1 acceptance scenarios 2-3, FR-011.
- [x] T011 [US1] Add test "extracts scanner name from run.tool.driver.name" in `vsix/src/test/unit/sarif.test.ts`: create a single-run SARIF with `tool.driver.name = 'semgrep'` and one result. Call `parseSarif()`, verify the finding's `scanner` field is `'semgrep'`. Maps to FR-002.

**Checkpoint**: US1 tests pass. `npx mocha out/test/unit/sarif.test.js`

---

## Phase 4: User Story 2 — Map Severity Accurately (Priority: P1)

**Goal**: Verify severity mapping prioritizes ASH properties over SARIF level.

**Independent Test**: Provide results with and without ASH-specific severity, verify correct mapping.

- [x] T012 [US2] Add test "maps ASH properties.severity when present" in `vsix/src/test/unit/sarif.test.ts`: create a result with `properties: { severity: 'CRITICAL' }` and `level: 'warning'`. Call `extractSeverity()`, verify it returns `'CRITICAL'` (ASH property overrides SARIF level). Maps to spec US2 acceptance scenario 1, FR-004.
- [x] T013 [US2] Add test "maps ASH properties['ash/severity'] when present" in `vsix/src/test/unit/sarif.test.ts`: create a result with `properties: { 'ash/severity': 'HIGH' }` and `level: 'note'`. Call `extractSeverity()`, verify it returns `'HIGH'`. Maps to FR-004.
- [x] T014 [US2] Add test "falls back to SARIF level mapping for all levels" in `vsix/src/test/unit/sarif.test.ts`: test all 4 SARIF levels without ASH properties: `error→HIGH`, `warning→MEDIUM`, `note→LOW`, `none→INFO`. Create one result per level, call `extractSeverity()` on each, verify correct mapping. Maps to spec US2 acceptance scenarios 2-5, SC-002.
- [x] T015 [US2] Add test "defaults to MEDIUM when level is missing" in `vsix/src/test/unit/sarif.test.ts`: create a result with no `level` field (or undefined). Call `extractSeverity()`, verify it returns `'MEDIUM'` (SARIF spec default for absent level is "warning"). Maps to research.md R6.

**Checkpoint**: US2 tests pass. Severity mapping is correct for all cases.

---

## Phase 5: User Story 3 — Normalize File Paths (Priority: P1)

**Goal**: Verify all file paths in output are relative with no `file://` prefix.

**Independent Test**: Provide results with various URI formats and a source directory, verify output paths.

- [x] T016 [US3] Add test "strips file:// prefix and makes path relative" in `vsix/src/test/unit/sarif.test.ts`: call `normalizeFilePath('file:///home/user/project/src/app.py', '/home/user/project')`, verify result is `'src/app.py'`. Maps to spec US3 acceptance scenario 1, FR-005, FR-006, SC-003.
- [x] T017 [US3] Add test "handles already-relative paths" in `vsix/src/test/unit/sarif.test.ts`: call `normalizeFilePath('src/app.py', '/home/user/project')`, verify result is `'src/app.py'` unchanged. Maps to spec US3 acceptance scenario 2.
- [x] T018 [US3] Add test "handles trailing slash on sourceDir" in `vsix/src/test/unit/sarif.test.ts`: call `normalizeFilePath('file:///home/user/project/src/app.py', '/home/user/project/')`, verify result is `'src/app.py'`. Maps to spec US3 acceptance scenario 3.
- [x] T019 [US3] Add test "returns 'unknown' for empty or missing URI" in `vsix/src/test/unit/sarif.test.ts`: call `normalizeFilePath('', '/source')` and `normalizeFilePath(undefined as any, '/source')`, verify both return `'unknown'`. Maps to FR-013, edge case.

**Checkpoint**: US3 tests pass. All paths are relative.

---

## Phase 6: User Story 4 — Deduplicate Findings (Priority: P2)

**Goal**: Verify deduplication merges findings correctly by (ruleId, file) key.

**Independent Test**: Provide findings with overlapping keys, verify one finding per key with merged metadata.

- [x] T020 [US4] Add test "deduplicates by (ruleId, file) and merges line ranges" in `vsix/src/test/unit/sarif.test.ts`: create 2 ParsedFinding objects with same ruleId and file but different scanners (lines 10-15 from bandit, lines 12-20 from semgrep). Call `deduplicateFindings()`, verify: (a) returns 1 finding, (b) startLine is 10, endLine is 20, (c) scanner contains both names. Maps to spec US4 acceptance scenario 1, FR-009, SC-004.
- [x] T021 [US4] Add test "keeps findings with different ruleIds or files separate" in `vsix/src/test/unit/sarif.test.ts`: create 3 findings: (ruleA, fileX), (ruleB, fileX), (ruleA, fileY). Call `deduplicateFindings()`, verify all 3 remain. Maps to spec US4 acceptance scenarios 2-3.
- [x] T022 [US4] Add test "keeps highest severity during dedup merge" in `vsix/src/test/unit/sarif.test.ts`: create 2 findings with same (ruleId, file) but severities LOW and HIGH. Call `deduplicateFindings()`, verify the merged finding has severity HIGH. Maps to data-model.md dedup rules.
- [x] T023 [US4] Add test "concatenates scanner names with comma separator" in `vsix/src/test/unit/sarif.test.ts`: create 3 findings with same (ruleId, file) from scanners "bandit", "semgrep", "bandit" (duplicate). Call `deduplicateFindings()`, verify scanner field is `"bandit, semgrep"` (unique names only). Maps to research.md R4.

**Checkpoint**: US4 tests pass. Dedup works correctly with merged metadata.

---

## Phase 7: User Story 5 — Handle Incomplete SARIF Gracefully (Priority: P2)

**Goal**: Verify parser handles all combinations of missing optional fields without errors.

**Independent Test**: Provide results with missing fields, verify no errors and correct defaults.

- [x] T024 [US5] Add test "handles missing region (no line numbers)" in `vsix/src/test/unit/sarif.test.ts`: create a SarifResult with a location that has `artifactLocation` but no `region`. Call `parseSarif()` with a single-run log containing this result. Verify finding has `startLine: 1` and `endLine: undefined`. Maps to spec US5 acceptance scenario 1, FR-014.
- [x] T025 [US5] Add test "handles missing snippet" in `vsix/src/test/unit/sarif.test.ts`: create a SarifResult with region that has startLine and endLine but no snippet. Call `parseSarif()`, verify finding has `snippet: undefined`. Maps to spec US5 acceptance scenario 2.
- [x] T026 [US5] Add test "handles missing endLine" in `vsix/src/test/unit/sarif.test.ts`: create a SarifResult with region that has startLine only, no endLine. Call `parseSarif()`, verify finding has `endLine: undefined`. Maps to spec US5 acceptance scenario 3.
- [x] T027 [US5] Add test "handles missing properties bag" in `vsix/src/test/unit/sarif.test.ts`: create a SarifResult with no `properties` field. Call `parseSarif()`, verify severity falls back to SARIF level mapping. Maps to spec US5 acceptance scenario 4.
- [x] T028 [US5] Add test "handles empty locations array" in `vsix/src/test/unit/sarif.test.ts`: create a SarifResult with `locations: []`. Call `parseSarif()`, verify finding has `file: 'unknown'` and `startLine: 1`. Maps to spec US5 acceptance scenario 5, FR-013.

**Checkpoint**: US5 tests pass. Parser is resilient to all missing-field combinations.

---

## Phase 8: Edge Cases

**Goal**: Cover additional edge cases from spec.

- [x] T029 Add test "returns empty array for zero runs" in `vsix/src/test/unit/sarif.test.ts`: create a SarifLog with `runs: []`. Call `parseSarif()`, verify returns `[]`. Maps to edge case 1.
- [x] T030 Add test "uses 'unknown' for missing ruleId" in `vsix/src/test/unit/sarif.test.ts`: create a SarifResult with `ruleId` set to `undefined` or empty string. Call `parseSarif()`, verify finding has `ruleId: 'unknown'`. Maps to edge case 2, FR-013.
- [x] T031 Add test "extracts title from rules[].shortDescription" in `vsix/src/test/unit/sarif.test.ts`: create a SarifRun with `tool.driver.rules` containing a rule with `shortDescription: { text: 'Hardcoded password' }` matching the result's ruleId. Call `parseSarif()`, verify finding title is `'Hardcoded password'`. Maps to FR-008, edge case 3.
- [x] T032 Add test "falls back to message.text for title when no rules match" in `vsix/src/test/unit/sarif.test.ts`: create a SarifRun with empty `rules: []` and a result with `message.text = 'Use of eval detected'`. Call `parseSarif()`, verify finding title is `'Use of eval detected'`. Maps to FR-008.

**Checkpoint**: All edge case tests pass.

---

## Phase 9: Polish & Cross-Cutting Concerns

- [x] T033 Run `npm run compile` in `vsix/` and fix any TypeScript errors in new/modified files.
- [x] T034 Run `npm run lint` in `vsix/` and fix any ESLint errors in `vsix/src/services/sarif.ts`, `vsix/src/test/unit/sarif.test.ts`, and `vsix/src/test/fixtures/sarif-factory.ts`.
- [x] T035 Run `npx mocha` in `vsix/` and verify ALL tests pass (existing smoke tests + new SARIF parser tests). Zero failures.
- [x] T036 Verify test suite completes within 5 seconds total (SC-005 performance, SC-006 all pass).

**Checkpoint**: All code compiles, lints clean, all tests pass within 5 seconds, no regressions.

---

## Dependencies

```
T001 ──► T002 ──► T004,T005,T006 ──► T007 ──► T008+ (tests)
T001 ──► T003 ──► T008+ (tests)

Phase 1 (T001-T003) ──► Phase 2 (T004-T007) ──► Phases 3-8 (T008-T032) ──► Phase 9 (T033-T036)
```

- T004, T005, T006 can be implemented in parallel (independent functions)
- All US test phases (3-8) can be written in parallel once Phase 2 is complete
- Phase 9 must run last

## Parallel Execution Opportunities

| Tasks | Reason |
|-------|--------|
| T004, T005, T006 | Independent functions in same file, no dependencies on each other |
| T008-T011 (US1), T012-T015 (US2), T016-T019 (US3) | Independent test groups targeting different functions |
| T020-T023 (US4), T024-T028 (US5), T029-T032 (Edge) | Independent test groups, all depend only on Phase 2 |

## Implementation Strategy

**MVP**: Phase 1 + Phase 2 + Phase 3 (US1 tests) — proves the parser extracts findings from multi-scanner SARIF correctly.

**Incremental delivery**: Each user story phase adds independently testable functionality. All P1 stories (US1-US3) should be completed before P2 stories (US4-US5).
