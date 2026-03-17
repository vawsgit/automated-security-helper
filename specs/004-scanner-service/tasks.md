# Tasks: Scanner Service

**Input**: Design documents from `/specs/004-scanner-service/`
**Prerequisites**: plan.md, spec.md, data-model.md, contracts/scanner-service.md, research.md, quickstart.md

**Tests**: Included — explicitly requested in feature specification.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup

**Purpose**: Declare VS Code configuration settings required by the scanner service.

- [x] T001 Add `contributes.configuration` section to `vsix/package.json` with `ashWorkbench.ashPath` (string, default `"ash"`), `ashWorkbench.ashMode` (enum `local`/`container`, default `"local"`), and `ashWorkbench.scanTimeout` (number, default `600`, minimum `30`) per contracts/scanner-service.md

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Create the ScannerService class skeleton with types and the stale scan recovery method. MUST complete before any user story.

- [x] T002 Create `vsix/src/services/scanner.ts` with exported types (`SpawnFn`, `ScanProgress`, `StartScanParams`, `ScanResult`) and `ScannerService` class skeleton with constructor accepting `db: PrismaClient`, `projectId: string`, and optional `spawnFn: SpawnFn` (defaults to `child_process.spawn`). Include a `getConfig()` private helper that reads `ashWorkbench.*` settings from `vscode.workspace.getConfiguration()` with an injectable override for tests (FR-014, FR-015)
- [x] T003 Implement `recoverStaleScans(): Promise<number>` method in `vsix/src/services/scanner.ts` — queries scans with `status: RUNNING` for the project and updates them to `FAILED` with `errorMessage: "Scan interrupted: VS Code was closed while this scan was running."` and `completedAt: new Date()` (FR-017)
- [x] T004 Write test setup in `vsix/src/test/unit/scanner.test.ts`: import dependencies, create `createMockProcess()` helper (reuse pattern from `scanner-mock.smoke.test.ts`), set up `before`/`after` hooks for PGLite in-memory DB initialization and project creation, `beforeEach`/`afterEach` for sinon restore
- [x] T005 Write test in `vsix/src/test/unit/scanner.test.ts`: `recoverStaleScans()` marks stale RUNNING scans as FAILED — manually insert a RUNNING scan record, call `recoverStaleScans()`, verify status is FAILED with crash-recovery error message

**Checkpoint**: ScannerService class exists with types and stale recovery. Test infrastructure ready.

---

## Phase 3: User Story 1 - Execute a Security Scan (Priority: P1)

**Goal**: A user initiates a scan on a folder. The scanner runs, SARIF output is parsed, findings are stored, and the scan record is updated to COMPLETED.

**Independent Test**: Start a scan with a mock process that exits with code 2. Verify Scan record is COMPLETED with correct findingsCount, severity breakdown, and Finding records in the database.

### Implementation for User Story 1

- [x] T006 [US1] Implement `startScan()` method in `vsix/src/services/scanner.ts`: single-scan constraint check (query for RUNNING scans, throw if found), scan target find-or-create via `db.scanTarget.upsert()` with `path.basename()` as displayName, create Scan record with `status: RUNNING`, read config (ashPath, ashMode, scanTimeout), create temp dir via `fs.mkdtemp()`, build args array (`--source-dir`, `--output-dir`, `--output-formats sarif`, `--color false`, `--progress`, optional `--mode container`), spawn process via `spawnFn()` (FR-001, FR-002, FR-010, FR-011, FR-014, FR-015)
- [x] T007 [US1] Implement exit code handling in `startScan()` in `vsix/src/services/scanner.ts`: on exit 0 or 2, read `<tempDir>/reports/ash.sarif`, `JSON.parse()`, call `parseSarif()` from `services/sarif.ts`, map `ParsedFinding[]` to `db.finding.createMany()` records (linked to scan, project, scanTarget), compute severity breakdown as `Record<string, number>`, update Scan to `status: COMPLETED` with findingsCount and severityBreakdown. On exit 0 with missing SARIF file, treat as zero findings. On exit 1, capture stderr and update Scan to `status: FAILED` with errorMessage (FR-003, FR-004, FR-005, FR-006, FR-016)
- [x] T008 [US1] Implement temp directory cleanup and timer teardown in `startScan()` in `vsix/src/services/scanner.ts`: use `finally` block to `fs.rm(tempDir, { recursive: true, force: true })`, clear progress interval and timeout timers, reset `currentScanId` and `currentProcess` state (FR-009)

### Tests for User Story 1

- [x] T009 [P] [US1] Write test in `vsix/src/test/unit/scanner.test.ts`: successful scan with findings (exit code 2) — mock process emits exit 2, provide a mock SARIF file via `fs.writeFileSync()` in the temp dir, verify Scan record has `status: COMPLETED`, `findingsCount > 0`, non-null `severityBreakdown`, and Finding records exist in database
- [x] T010 [P] [US1] Write test in `vsix/src/test/unit/scanner.test.ts`: clean scan with no findings (exit code 0) — mock process emits exit 0, verify Scan record has `status: COMPLETED`, `findingsCount: 0`, and no Finding records in database

**Checkpoint**: Core scan execution works end-to-end with mocked process. Findings are parsed and stored.

---

## Phase 4: User Story 4 - Scan Target Management (Priority: P1)

**Goal**: Scan targets are automatically created for new folder paths and reused for repeated scans of the same folder.

**Independent Test**: Scan the same folder path twice. Verify only one ScanTarget record exists and both Scans reference it.

### Tests for User Story 4

> Implementation is embedded in US1's `startScan()` (scan target upsert). This phase validates the behavior independently.

- [x] T011 [P] [US4] Write test in `vsix/src/test/unit/scanner.test.ts`: first scan for a path creates a new ScanTarget with correct path and displayName derived from `path.basename()`
- [x] T012 [P] [US4] Write test in `vsix/src/test/unit/scanner.test.ts`: second scan of the same folder path reuses the existing ScanTarget — verify `db.scanTarget.count()` is 1 after two scans and both Scan records reference the same scanTargetId

**Checkpoint**: Scan target find-or-create is idempotent and correct.

---

## Phase 5: User Story 6 - Single Scan Constraint (Priority: P1)

**Goal**: Only one scan runs at a time per project. A second scan attempt while one is running is rejected immediately.

**Independent Test**: Start a scan (keep it running via mock), attempt a second scan, verify rejection.

### Tests for User Story 6

> Implementation is embedded in US1's `startScan()` (constraint check at method start). This phase validates the behavior independently.

- [x] T013 [US6] Write test in `vsix/src/test/unit/scanner.test.ts`: starting a second scan while one is running throws an error with message "A scan is already in progress" — start a scan with a mock process that does not exit, attempt a second `startScan()`, verify it rejects
- [x] T014 [US6] Write test in `vsix/src/test/unit/scanner.test.ts`: scan starts normally after a previous scan has completed — complete a scan (mock exit 0), start another scan, verify it succeeds

**Checkpoint**: Single-scan constraint is enforced and does not block after completion.

---

## Phase 6: User Story 2 - Cancel a Running Scan (Priority: P1)

**Goal**: A user can cancel a running scan. The process is terminated, the scan is marked as cancelled, and temp files are cleaned up.

**Independent Test**: Start a scan, cancel it, verify the process was killed and the scan status is CANCELLED.

### Implementation for User Story 2

- [x] T015 [US2] Implement `cancelScan(scanId: string): Promise<void>` method in `vsix/src/services/scanner.ts`: if no current process or scanId mismatch return silently, send `SIGTERM` to process, update Scan to `status: CANCELLED` with `completedAt: new Date()`, clean up temp dir, clear timers (FR-008, FR-009)

### Tests for User Story 2

- [x] T016 [P] [US2] Write test in `vsix/src/test/unit/scanner.test.ts`: cancel running scan sends SIGTERM and marks scan as CANCELLED — start a scan, call `cancelScan()`, verify `proc.kill` was called with `'SIGTERM'` and Scan record has `status: CANCELLED`
- [x] T017 [P] [US2] Write test in `vsix/src/test/unit/scanner.test.ts`: cancel with no running scan does nothing — call `cancelScan('nonexistent-id')` when no scan is running, verify no errors thrown

**Checkpoint**: Scan cancellation works gracefully in both running and idle states.

---

## Phase 7: User Story 3 - Handle Scanner Errors Gracefully (Priority: P1)

**Goal**: All scanner failure modes (not installed, crashes, timeout) produce clear error messages and mark the scan as FAILED.

**Independent Test**: Trigger ENOENT, exit code 1, and timeout. Verify each produces a FAILED scan with a meaningful error message.

### Implementation for User Story 3

- [x] T018 [US3] Implement ENOENT spawn error handling in `startScan()` in `vsix/src/services/scanner.ts`: listen for `error` event on the child process, detect `ENOENT` code, update Scan to `status: FAILED` with user-friendly message including install instructions (FR-007)
- [x] T019 [US3] Implement timeout handling in `startScan()` in `vsix/src/services/scanner.ts`: start a `setTimeout()` per `scanTimeout` config, on expiry call `process.kill('SIGTERM')`, update Scan to `status: FAILED` with `errorMessage: "Scan timed out after ${timeout} seconds"`, clean up temp dir (FR-012)

### Tests for User Story 3

- [x] T020 [P] [US3] Write test in `vsix/src/test/unit/scanner.test.ts`: ENOENT spawn error marks scan as FAILED with install instructions — mock process emits `error` with `code: 'ENOENT'`, verify Scan has `status: FAILED` and errorMessage contains install guidance
- [x] T021 [P] [US3] Write test in `vsix/src/test/unit/scanner.test.ts`: exit code 1 marks scan as FAILED with stderr content — mock process emits stderr data then exit 1, verify Scan has `status: FAILED` and errorMessage contains the stderr text
- [x] T022 [P] [US3] Write test in `vsix/src/test/unit/scanner.test.ts`: timeout kills process and marks FAILED — use a very short timeout config override, let mock process hang, verify `proc.kill` was called and Scan has `status: FAILED` with timeout message
- [x] T023 [P] [US3] Write test in `vsix/src/test/unit/scanner.test.ts`: missing SARIF file after exit 2 marks scan as FAILED — mock process emits exit 2 but no SARIF file exists at expected path, verify Scan has `status: FAILED` with error about missing output

**Checkpoint**: All error paths produce meaningful, actionable error messages. No scan gets stuck in RUNNING.

---

## Phase 8: User Story 5 - Scan Progress Feedback (Priority: P2)

**Goal**: While a scan runs, progress updates with elapsed time are emitted via the `onProgress` callback.

**Independent Test**: Start a scan with a progress callback, verify the callback is called with `elapsed` and `statusText` values.

### Implementation for User Story 5

- [x] T024 [US5] Implement progress reporting in `startScan()` in `vsix/src/services/scanner.ts`: if `onProgress` callback is provided, start a 1-second `setInterval()` that calls `onProgress({ elapsed: secondsSinceStart, statusText: 'Scanning...' })`, clear interval on scan completion/failure/cancellation (FR-013)

### Tests for User Story 5

- [x] T025 [US5] Write test in `vsix/src/test/unit/scanner.test.ts`: progress callback is called during scan with elapsed time — provide an `onProgress` spy, use `sinon.useFakeTimers()` to advance time, verify callback was called with `elapsed > 0` and a non-empty `statusText`

**Checkpoint**: Progress updates are emitted during scan execution.

---

## Phase 9: Polish & Cross-Cutting Concerns

**Purpose**: Wire the scanner service into the extension activation flow. Compile, lint, and test clean.

- [x] T026 Modify `vsix/src/extension.ts` to import and instantiate `ScannerService` after `ensureProject()`: create instance with `db`, `project.id`, call `scanner.recoverStaleScans()`, log recovery count if > 0
- [x] T027 Run `npm run compile` in `vsix/` and fix any TypeScript errors across all new and modified files
- [x] T028 Run `npm run lint` in `vsix/` and fix any ESLint errors in `scanner.ts`, `scanner.test.ts`, `extension.ts`, and `package.json`
- [x] T029 Run `npm run test:unit` in `vsix/` and verify all tests pass (existing sarif, project, scanner-mock tests + new scanner tests)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on Phase 1 (config settings must be declared)
- **US1 (Phase 3)**: Depends on Phase 2 (scanner class skeleton + test infra must exist)
- **US4 (Phase 4)**: Depends on Phase 3 (startScan must be implemented for scan target tests)
- **US6 (Phase 5)**: Depends on Phase 3 (startScan must be implemented for constraint tests)
- **US2 (Phase 6)**: Depends on Phase 3 (startScan must work to test cancellation)
- **US3 (Phase 7)**: Depends on Phase 3 (startScan base flow must exist for error paths)
- **US5 (Phase 8)**: Depends on Phase 3 (startScan must work for progress tests)
- **Polish (Phase 9)**: Depends on all previous phases

### User Story Dependencies

- **US1 (P1)**: Foundational → US1. No dependencies on other stories.
- **US4 (P1)**: US1 → US4. Tests validate behavior implemented in US1.
- **US6 (P1)**: US1 → US6. Tests validate behavior implemented in US1.
- **US2 (P1)**: US1 → US2. Adds `cancelScan()` method; tests need startScan working.
- **US3 (P1)**: US1 → US3. Adds error handling paths; tests need startScan base flow.
- **US5 (P2)**: US1 → US5. Adds progress callback; tests need startScan working.

After US1 completes: US4, US6, US2, US3, and US5 can proceed in parallel.

### Within Each User Story

- Implementation tasks before test tasks (except US4/US6 which are test-only)
- Core flow before edge cases
- Story complete before moving to next priority

### Parallel Opportunities

- After Phase 3 (US1) completes, Phases 4-8 can all run in parallel (different test cases, separate implementation additions)
- Within Phase 7 (US3): T020, T021, T022, T023 are all parallel (independent test cases)
- Within Phase 4: T011, T012 are parallel
- Within Phase 6: T016, T017 are parallel

---

## Parallel Example: After US1 Completes

```bash
# These can all run in parallel after Phase 3:
Task: T011 [US4] "Write test: first scan creates ScanTarget"
Task: T013 [US6] "Write test: second scan rejected while first is running"
Task: T015 [US2] "Implement cancelScan() method"
Task: T018 [US3] "Implement ENOENT handling"
Task: T024 [US5] "Implement progress reporting"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (package.json config)
2. Complete Phase 2: Foundational (class skeleton, stale recovery)
3. Complete Phase 3: User Story 1 (core scan execution)
4. **STOP and VALIDATE**: Run tests — scan execution works with mocked process
5. Core product value delivered: scans run and findings are stored

### Incremental Delivery

1. Setup + Foundational → Scanner class ready
2. US1 → Core scan execution works → **MVP!**
3. US4, US6 → Scan target and constraint validated
4. US2 → Cancellation works
5. US3 → Error resilience complete
6. US5 → Progress reporting added (P2)
7. Polish → Wired into extension, all checks pass

---

## Notes

- [P] tasks = different files or independent test cases, no dependencies
- [Story] label maps each task to its user story for traceability
- US4 and US6 are test-only phases — their implementation is integral to US1's `startScan()` method
- The scanner service uses SpawnFn dependency injection for testability (sinon cannot stub `child_process.spawn` under Node16 modules)
- Config reading uses an injectable override so unit tests can provide values without `vscode.workspace.getConfiguration()`
- All tests use in-memory PGLite for database isolation (same pattern as `project.test.ts`)
- The existing `scanner-mock.smoke.test.ts` validates the mock process pattern; new tests build on it
