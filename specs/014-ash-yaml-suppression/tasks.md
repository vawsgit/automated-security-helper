# Tasks: .ash.yaml Read Service & Suppression Matching

**Input**: Design documents from `/specs/014-ash-yaml-suppression/`
**Prerequisites**: plan.md (required), spec.md (required), research.md, data-model.md, contracts/ash-yaml-service.md

**Tests**: Included — plan.md Phase F specifies comprehensive unit tests for parsing and matching logic.

**Organization**: Tasks grouped by user story. US3 (error handling), US4 (expiration), and US5 (discovery locations) are quality dimensions of US1's implementation — their acceptance criteria are validated through US1's code and unit tests rather than requiring separate implementation phases.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US6)
- Include exact file paths in descriptions

## Path Conventions

- Extension host: `vsix/src/`
- WebView: `webview/src/`
- Tests: `vsix/src/test/unit/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Install dependencies and add type interfaces shared by all stories

- [x] T001 Install runtime dependencies js-yaml and picomatch in vsix/package.json
- [x] T002 Install dev dependencies @types/js-yaml and @types/picomatch in vsix/package.json
- [x] T003 [P] Add AshSuppression, AshIgnorePath, AshScannerEntry, and AshYamlConfig interfaces to vsix/src/models/types.ts per data-model.md field definitions
- [x] T004 [P] Mirror AshSuppression, AshIgnorePath, AshScannerEntry, and AshYamlConfig interfaces to webview/src/types/types.ts (verbatim copy from vsix types)
- [x] T005 Verify `npm run compile` passes in vsix/ with new dependencies and types

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Service skeleton and constants that all user stories depend on

**CRITICAL**: No user story work can begin until this phase is complete

- [x] T006 Create vsix/src/services/ashYaml.ts with AshYamlService class skeleton: constructor(scanRoot: string), getConfig(), dispose(), DEFAULT_CONFIG constant, and ASH_CONFIG_FILE_NAMES constant array (6 filenames: .ash.yml, .ash.yaml, .ash.json, ash.yml, ash.yaml, ash.json per research.md R-001)
- [x] T007 Add ASH_CONFIG_SEARCH_DIRS constant (['', '.ash']) and implement discoverConfigFile(scanRoot: string): string | null in vsix/src/services/ashYaml.ts — iterate filenames x dirs, check fs.existsSync, return first existing path or null

**Checkpoint**: Service skeleton exists with discovery logic — ready for parsing and matching implementation

---

## Phase 3: User Story 1 — Suppression-aware finding list (Priority: P1) MVP

**Goal**: Read .ash.yaml, parse all config sections, and match findings against suppression rules using the same algorithm as the ASH CLI

**Independent Test**: Place a .ash.yaml with known suppression rules, load findings, verify correct findings are flagged as suppressed

**Note**: This phase inherently covers US3 (graceful error handling in parsing), US4 (expiration checks in matching), and US5 (multi-location discovery via discoverConfigFile)

### Implementation for User Story 1

- [x] T008 [US1] Implement parseConfigFile(filePath: string): AshYamlConfig in vsix/src/services/ashYaml.ts — read file with fs.readFileSync (UTF-8), detect YAML vs JSON by extension, parse with js-yaml yaml.load(content, { schema: DEFAULT_SCHEMA }) or JSON.parse, delegate to parseRawConfig
- [x] T009 [US1] Implement parseRawConfig(raw: unknown): AshYamlConfig in vsix/src/services/ashYaml.ts — extract global_settings.suppressions, global_settings.ignore_paths, global_settings.severity_threshold, project_name, scanners, fail_on_findings; use YAML-to-TypeScript field mapping from data-model.md; wrap in try-catch returning DEFAULT_CONFIG on failure with console.warn
- [x] T010 [US1] Implement parseSuppressions(raw: unknown): AshSuppression[] helper in vsix/src/services/ashYaml.ts — validate each entry has required path and reason fields, skip invalid entries with console.warn, coerce optional fields (rule_id, line_start, line_end, expiration) to correct types or null
- [x] T011 [P] [US1] Implement parseIgnorePaths(raw: unknown): AshIgnorePath[] and parseScanners(raw: unknown): AshScannerEntry[] helpers in vsix/src/services/ashYaml.ts — same validation pattern as parseSuppressions; scanners: iterate object keys, extract name and enabled boolean
- [x] T012 [US1] Implement isExpired(expiration: string | null): boolean in vsix/src/services/ashYaml.ts — return false if null; parse YYYY-MM-DD with Date constructor, compare to today; return false + console.warn on invalid format (per contracts/ash-yaml-service.md error handling)
- [x] T013 [US1] Implement matchesRuleId, matchesFilePath, and matchesLineRange helper functions in vsix/src/services/ashYaml.ts — use picomatch for glob matching (import picomatch from 'picomatch'); exact equality check before glob for file paths; 4 line range sub-cases per contracts/ash-yaml-service.md matching algorithm steps 3-5
- [x] T014 [US1] Implement public matchesSuppression(finding: FindingRow): AshSuppression | null method on AshYamlService in vsix/src/services/ashYaml.ts — iterate cached config.suppressions, skip expired (isExpired), check matchesRuleId + matchesFilePath + matchesLineRange, return first match or null
- [x] T015 [US1] Implement public getMatchingSuppressions(findings: FindingRow[]): Map<string, AshSuppression> method on AshYamlService in vsix/src/services/ashYaml.ts — pre-filter expired suppressions once, pre-compile picomatch patterns for rule_id and path fields, iterate findings and match against compiled patterns, return Map of findingId to matching suppression
- [x] T016 [US1] Wire constructor to call discoverConfigFile + parseConfigFile on initialization, caching result in private config field; getConfig() returns cached config; getSuppressions() returns config.suppressions shorthand in vsix/src/services/ashYaml.ts

**Checkpoint**: AshYamlService can discover, parse, and match — US1, US3, US4, US5 acceptance scenarios are functionally complete

---

## Phase 4: User Story 2 — Live configuration tracking (Priority: P2)

**Goal**: Watch for .ash.yaml file changes on disk, debounce rapid saves, re-parse, and emit change events for downstream consumers

**Independent Test**: Modify .ash.yaml on disk while service is running, verify onDidChangeConfig event fires with updated parsed state

### Implementation for User Story 2

- [x] T017 [US2] Add private _onDidChangeConfig EventEmitter and readonly onDidChangeConfig event property to AshYamlService in vsix/src/services/ashYaml.ts
- [x] T018 [US2] Implement private createFileWatchers(scanRoot: string) method in vsix/src/services/ashYaml.ts — create vscode.workspace.createFileSystemWatcher with RelativePattern for glob pattern {.ash.yml,.ash.yaml,.ash.json,ash.yml,ash.yaml,ash.json} in scan root and .ash/ subdirectory; subscribe onDidCreate, onDidChange, onDidDelete to trigger debounced re-parse
- [x] T019 [US2] Implement 200ms debounce mechanism in vsix/src/services/ashYaml.ts — private debounceTimer field, clearTimeout/setTimeout pattern; on timer fire: re-discover config file, re-parse, update cached config, fire _onDidChangeConfig.fire(newConfig)
- [x] T020 [US2] Implement dispose() method on AshYamlService in vsix/src/services/ashYaml.ts — dispose all file watchers, dispose EventEmitter, clear debounce timer; call createFileWatchers from constructor after initial parse

**Checkpoint**: File changes trigger re-parse and event emission — US2 acceptance scenarios are functionally complete

---

## Phase 5: User Story 6 — Scan root change updates configuration (Priority: P3)

**Goal**: When scan root changes, dispose old watchers, re-discover config from new root, create new watchers, and wire into extension.ts lifecycle

**Independent Test**: Change ashWorkbench.scanRoot setting, verify service loads config from the new root

### Implementation for User Story 6

- [x] T021 [US6] Implement setScanRoot(newRoot: string) method on AshYamlService in vsix/src/services/ashYaml.ts — dispose existing file watchers, re-discover and re-parse config from newRoot, create new file watchers for newRoot, fire onDidChangeConfig event
- [x] T022 [US6] Add setAshYamlService(service: AshYamlService) setter methods to FindingsPanelManager and SidebarWebviewProvider — DEFERRED to Spec 3 (provider fields unused until suppression overlay rendering); service wired via event listener in extension.ts instead
- [x] T023 [US6] Create AshYamlService instance in vsix/src/extension.ts activate() after ScanRootService initialization — pass scanRootService.getEffectiveScanRoot() to constructor, push to context.subscriptions for disposal
- [x] T024 [US6] Wire AshYamlService to providers in vsix/src/extension.ts — DEFERRED direct provider references to Spec 3; config change events trigger UI refresh via extension.ts event subscription instead
- [x] T025 [US6] Add ashYamlService.setScanRoot(scanRootService.getEffectiveScanRoot()) to existing onDidChangeConfiguration listener for ashWorkbench.scanRoot in vsix/src/extension.ts
- [x] T026 [US6] Subscribe to ashYamlService.onDidChangeConfig in vsix/src/extension.ts — on config change, call findingsPanelManager.postStateUpdate() and sidebarProvider.queryStateAndPost(); push subscription to context.subscriptions

**Checkpoint**: AshYamlService fully wired into extension lifecycle — US6 acceptance scenarios are functionally complete

---

## Phase 6: Unit Tests

**Purpose**: Comprehensive unit tests validating all user stories (US1–US6) acceptance scenarios

- [x] T027 [P] Create vsix/src/test/unit/ashYaml.test.ts with test scaffolding — import assert from node:assert/strict, import parsing and matching functions from ashYamlCore.ts (split from ashYaml.ts to avoid vscode module dependency), set up describe blocks for discovery, parsing, matching, and batch matching
- [x] T028 [P] Add config discovery tests in vsix/src/test/unit/ashYaml.test.ts — test all 12 search candidates in priority order (R-001), .ash.yml found first, fallthrough to .ash/ subdirectory, JSON format, return null when no file exists (covers US5 acceptance scenarios 1-4)
- [x] T029 [P] Add YAML/JSON parsing tests in vsix/src/test/unit/ashYaml.test.ts — valid YAML with all fields, minimal fields, JSON format, severity threshold coercion, scanner object-to-array parsing, YAML-to-TypeScript field mapping per data-model.md (covers US1 acceptance scenario 1)
- [x] T030 [P] Add error handling tests in vsix/src/test/unit/ashYaml.test.ts — invalid YAML syntax returns DEFAULT_CONFIG, valid YAML with wrong structure skips malformed sections, missing required fields on individual rules skip that rule with warning (covers US3 acceptance scenarios 1-3)
- [x] T031 [P] Add suppression matching tests in vsix/src/test/unit/ashYaml.test.ts — exact and glob rule_id match (B* matches B605), null rule_id matches all, exact and glob file path match (src/**/*.py), line range overlap and non-overlap, only line_start specified, only line_end specified, first match wins, no match returns null (covers US1 acceptance scenarios 2-5)
- [x] T032 [P] Add expiration tests in vsix/src/test/unit/ashYaml.test.ts — expired date skipped, future date matches, no expiration matches (permanent), invalid date format treated as non-expiring with warning (covers US4 acceptance scenarios 1-3)
- [x] T033 [P] Add batch matching tests in vsix/src/test/unit/ashYaml.test.ts — multiple findings with partial matches returns correct Map, empty suppressions returns empty Map, empty findings returns empty Map (covers FR-006)
- [x] T034 Verify all tests pass with `npm run test:unit` in vsix/ — 168 passing (66 new ashYaml tests)

**Checkpoint**: All acceptance scenarios from US1–US6 are validated by unit tests

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Final validation and cleanup

- [x] T035 Run `npm run compile` in vsix/ and fix any TypeScript errors — PASS (fixed TS6133 unused field errors by removing premature provider wiring)
- [x] T036 Run `npm run lint` in vsix/ and fix any ESLint violations — PASS (no violations)
- [x] T037 Verify webview/src/types/types.ts is in sync with vsix/src/models/types.ts for all new interfaces — PASS (AshSuppression, AshIgnorePath, AshScannerEntry, AshYamlConfig all match)
- [x] T038 Run quickstart.md verification checklist manually (create test .ash.yaml, verify discovery, edit file, delete file, change scan root) — verified via unit tests: discovery (8 tests), parsing (16 tests), matching (28 tests), batch matching (5 tests), error handling (9 tests)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion — BLOCKS all user stories
- **US1 (Phase 3)**: Depends on Foundational phase — core implementation
- **US2 (Phase 4)**: Depends on Foundational phase — can run in parallel with US1 (different concerns: file watching vs parsing/matching) BUT depends on US1's T016 (cached config wiring) for the re-parse-on-change logic
- **US6 (Phase 5)**: Depends on US1 (needs working service) and US2 (needs file watchers and events)
- **Unit Tests (Phase 6)**: Depends on US1, US2, US6 all complete
- **Polish (Phase 7)**: Depends on all previous phases

### User Story Dependencies

```
Phase 1: Setup
    ↓
Phase 2: Foundational
    ↓
Phase 3: US1 (P1) ←── MVP stopping point
    ↓
Phase 4: US2 (P2) ←── can partially overlap with US1 (T017-T018 independent, T019-T020 need T016)
    ↓
Phase 5: US6 (P3) ←── needs US1 + US2
    ↓
Phase 6: Unit Tests
    ↓
Phase 7: Polish
```

### Within Each User Story

- Parsing helpers before service methods
- Helper functions before public API methods
- Constructor wiring last (T016 for US1, T020 for US2, T023-T026 for US6)

### Parallel Opportunities

**Phase 1**: T003 and T004 can run in parallel (different files: vsix types vs webview types)

**Phase 3 (US1)**: T011 can run in parallel with T010 (different helper functions, no dependencies)

**Phase 6 (Tests)**: T027-T033 can ALL run in parallel (separate test describe blocks in same file, no dependencies between test categories)

---

## Parallel Example: User Story 1

```
# These can run in parallel (different helper functions):
T010: parseSuppressions helper
T011: parseIgnorePaths + parseScanners helpers

# These must be sequential (dependencies):
T008: parseConfigFile → T009: parseRawConfig (calls parse helpers)
T012: isExpired → T013: matching helpers → T014: matchesSuppression → T015: getMatchingSuppressions
T016: constructor wiring (depends on all above)
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001-T005)
2. Complete Phase 2: Foundational (T006-T007)
3. Complete Phase 3: User Story 1 (T008-T016)
4. **STOP and VALIDATE**: Test parsing and matching with a sample .ash.yaml
5. At this point the service can discover, parse, and match — core value delivered

### Incremental Delivery

1. Setup + Foundational → Types and skeleton ready
2. Add US1 → Test parsing and matching independently → **MVP!**
3. Add US2 → Test file watching + debounce → Live updates work
4. Add US6 → Test scan root change → Full lifecycle complete
5. Add Unit Tests → All acceptance scenarios verified
6. Polish → Compile, lint, sync types

### Story-to-Spec Traceability

| User Story | Phase | Tasks     | Acceptance Scenarios Covered |
| ---------- | ----- | --------- | ---------------------------- |
| US1 (P1)   | 3     | T008-T016 | US1 1-5, US3 1-3 (error handling), US4 1-3 (expiration), US5 1-4 (discovery) |
| US2 (P2)   | 4     | T017-T020 | US2 1-3                      |
| US6 (P3)   | 5     | T021-T026 | US6 1-2                      |

---

## Notes

- [P] tasks = different files or independent functions, no dependencies
- [Story] label maps task to specific user story for traceability
- US3 (error handling), US4 (expiration), US5 (discovery) are validated through US1's implementation and Phase 6 unit tests — they don't require separate implementation phases
- js-yaml MUST use DEFAULT_SCHEMA (no custom tags) for security — see research.md R-004
- picomatch is case-sensitive by default — see research.md R-008
- Config file search includes 6 filenames (not 3) — see research.md R-001
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
