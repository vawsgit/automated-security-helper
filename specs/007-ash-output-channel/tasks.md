# Tasks: ASH Console Output Channel

**Input**: Design documents from `/specs/007-ash-output-channel/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, quickstart.md

**Tests**: Included — the plan specifies 11 detailed test cases and the existing scanner.test.ts establishes comprehensive test coverage patterns.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Phase 1: Setup

**Purpose**: Create the OutputChannel in the extension entry point and wire it to ScannerService.

- [x] T001 Create "ASH" OutputChannel in `activate()`, push to `context.subscriptions`, and pass as 4th argument to ScannerService constructor in `vsix/src/extension.ts`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Add OutputChannel infrastructure to ScannerService that ALL user stories depend on.

- [x] T002 Add optional `outputChannel` constructor parameter (type `vscode.OutputChannel | undefined`), store as `private readonly` instance field, and add `private scanStartTime: number | null = null` instance field to ScannerService in `vsix/src/services/scanner.ts`
- [x] T003 Add private `createLineBuffer(prefix?: string)` helper method that returns a closure accepting `Buffer` chunks, splitting on `\n`, calling `this.outputChannel?.appendLine()` for complete lines, and retaining partial trailing data in a captured buffer variable. Add a companion `flush()` function returned alongside the handler. Implement in `vsix/src/services/scanner.ts`
- [x] T004 [P] Add private `formatDuration(seconds: number): string` helper that returns `Xs` for durations under 60s and `Xm Ys` for longer durations in `vsix/src/services/scanner.ts`
- [x] T005 Add `this.outputChannel?.clear()` and `this.outputChannel?.show(true)` calls in `startScan()` after temp dir creation and before `executeScan()` call, and set `this.scanStartTime = Date.now()` after `this.cancelled = false` in `vsix/src/services/scanner.ts`

**Checkpoint**: Foundation ready — OutputChannel is created, wired, cleared on scan start, and helper methods are available. User story implementation can now begin.

---

## Phase 3: User Story 1 — Real-Time Scan Output Visibility (Priority: P1)

**Goal**: Stream raw ASH CLI stdout and stderr to the Output Channel line-by-line in real time during scan execution.

**Independent Test**: Trigger a scan, observe CLI stdout appearing line-by-line in the "ASH" Output Channel. Stderr lines appear with `[stderr]` prefix. Partial lines are buffered until complete.

### Implementation for User Story 1

- [x] T006 [US1] Add stdout piping: create a line buffer (no prefix) via `createLineBuffer()` and attach to `proc.stdout.on('data', ...)` after `this.spawnFn()` call in `executeScan()` in `vsix/src/services/scanner.ts`
- [x] T007 [US1] Add stderr piping: create a line buffer with `'[stderr] '` prefix via `createLineBuffer('[stderr] ')` and attach to `proc.stderr.on('data', ...)`, keeping existing `stderrChunks.push(chunk)` collection intact, in `executeScan()` in `vsix/src/services/scanner.ts`
- [x] T008 [US1] Add `proc.on('close', ...)` handler that flushes both stdout and stderr line buffers (any remaining partial line content) in `executeScan()` in `vsix/src/services/scanner.ts`
- [x] T009 [US1] Add `describe('Output Channel integration')` test block with: (1) test stdout piped to channel via mock proc.stdout data emit, (2) test stderr piped with `[stderr]` prefix via mock proc.stderr data emit, (3) test partial line buffering across split chunks, (4) test backward compat — no channel constructor, no errors in `vsix/src/test/unit/scanner.test.ts`

**Checkpoint**: stdout/stderr streaming works end-to-end. User can see raw CLI output in real time.

---

## Phase 4: User Story 2 — Scan Session Context (Priority: P1)

**Goal**: Display a scan header (target, timestamp, command) before CLI output and a footer (status, duration, findings) after the process exits.

**Independent Test**: Trigger a scan, verify header appears with target path, timestamp, and full command. On completion, verify footer shows COMPLETED/FAILED/CANCELLED status with duration and finding count.

### Implementation for User Story 2

- [x] T010 [US2] Write scan header block using box-drawing separators (`═══`) in `startScan()` after channel clear/show, containing: target path from `params.targetPath`, ISO timestamp, and full command string (`config.ashPath` + args array joined), in `vsix/src/services/scanner.ts`
- [x] T011 [US2] Write COMPLETED footer after successful SARIF processing (after `findingsCount` is computed, before `resolve()`), containing: `═══` separator, "ASH Scan Completed", status, formatted duration via `formatDuration()`, and finding count, in `executeScan()` in `vsix/src/services/scanner.ts`
- [x] T012 [US2] Write FAILED footer in both the error exit path (exit code 1) and the `proc.on('error')` handler, containing: separator, "ASH Scan Failed", status, formatted duration, and error message, in `executeScan()` in `vsix/src/services/scanner.ts`
- [x] T013 [US2] Write CANCELLED footer in `cancelScan()` after `this.currentProcess.kill('SIGTERM')`, containing: separator, "ASH Scan Cancelled", and formatted duration computed from `this.scanStartTime`, in `vsix/src/services/scanner.ts`
- [x] T014 [US2] Add tests: (1) header contains target path, timestamp, and command args, (2) completed footer shows COMPLETED + duration + finding count, (3) failed footer shows FAILED + error, (4) cancelled footer shows CANCELLED + duration, (5) channel.clear() called once at scan start, (6) channel.show(true) called with preserveFocus, in `vsix/src/test/unit/scanner.test.ts`

**Checkpoint**: Every scan session has clear context — header identifies the scan, footer summarizes the result.

---

## Phase 5: User Story 3 — Error Surfacing for Missing CLI (Priority: P2)

**Goal**: Display a clear error message in the Output Channel when the ASH CLI executable cannot be found.

**Independent Test**: Configure a non-existent ASH CLI path, trigger a scan, verify the Output Channel shows an error about the missing executable.

### Implementation for User Story 3

- [x] T015 [US3] Ensure the existing `proc.on('error')` handler writes the ENOENT error message (already computed as `message` variable) to the channel via `this.outputChannel?.appendLine(message)` before writing the failed footer, in `executeScan()` in `vsix/src/services/scanner.ts`
- [x] T016 [US3] Add test: emit ENOENT error on mock process, verify `appendLine` was called with text containing "ASH CLI not found" and the configured path, in `vsix/src/test/unit/scanner.test.ts`

**Checkpoint**: Users who don't have ASH installed see actionable guidance in the Output Channel.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Verify everything compiles, all tests pass, no regressions.

- [x] T017 Run `npm run compile` in `vsix/` and verify zero TypeScript errors
- [x] T018 Run `npm run test` in `vsix/` and verify all tests pass (existing + new Output Channel tests)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on T001 (channel must exist to be passed). T003 and T004 are parallel (independent helper methods). T005 depends on T002 (needs instance fields).
- **US1 (Phase 3)**: Depends on T003 (line buffer helper) and T005 (clear/show). T006 and T007 are parallel (stdout and stderr are independent handlers). T008 depends on T006+T007 (needs both buffers to flush). T009 depends on T006-T008.
- **US2 (Phase 4)**: Depends on T004 (formatDuration) and T005 (clear/show). T010 is independent. T011, T012, T013 are parallel (modify different methods). T014 depends on T010-T013.
- **US3 (Phase 5)**: Depends on T002 (outputChannel field). T015 is independent of US1/US2 (modifies error handler only). T016 depends on T015.
- **Polish (Phase 6)**: Depends on all previous phases.

### User Story Dependencies

- **US1 (P1)**: Depends on Foundational (Phase 2) only. No dependency on US2 or US3.
- **US2 (P1)**: Depends on Foundational (Phase 2) only. No dependency on US1 or US3.
- **US3 (P2)**: Depends on Foundational (Phase 2) only. No dependency on US1 or US2.

All three user stories can be implemented in parallel after Phase 2 completes.

### Parallel Opportunities

Within Phase 2:
- T003 and T004 can run in parallel (independent helper methods)

Within Phase 3 (US1):
- T006 and T007 can run in parallel (stdout vs stderr, separate stream handlers)

Within Phase 4 (US2):
- T011, T012, and T013 can run in parallel (different methods: executeScan success, executeScan error, cancelScan)

Across Phases 3-5:
- US1, US2, and US3 can all run in parallel after Phase 2 completes (different parts of scanner.ts)

---

## Parallel Example: User Story 1

```text
# After Phase 2 completes, launch stdout and stderr piping in parallel:
Task T006: "Pipe stdout through line buffer to channel in executeScan()"
Task T007: "Pipe stderr through line buffer with [stderr] prefix in executeScan()"

# Then sequentially:
Task T008: "Add close handler to flush both line buffers"
Task T009: "Add tests for streaming and buffering"
```

## Parallel Example: User Story 2

```text
# After T010 (header) completes, launch footers in parallel:
Task T011: "Write COMPLETED footer in executeScan() success path"
Task T012: "Write FAILED footer in executeScan() error paths"
Task T013: "Write CANCELLED footer in cancelScan()"

# Then:
Task T014: "Add tests for header and all footer variants"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001)
2. Complete Phase 2: Foundational (T002-T005)
3. Complete Phase 3: US1 — Real-Time Streaming (T006-T009)
4. **STOP and VALIDATE**: Run `npm run compile` + `npm run test`. Launch extension host (F5), trigger a scan, verify stdout/stderr appear in "ASH" Output Channel.
5. This alone delivers the core observability value.

### Incremental Delivery

1. Setup + Foundational → Channel exists, clears on scan start, shows with preserved focus
2. Add US1 → stdout/stderr streaming works → Test independently (MVP!)
3. Add US2 → Header/footer framing → Test independently
4. Add US3 → ENOENT error surfacing → Test independently
5. Polish → Full compile + test verification

---

## Notes

- All tasks modify existing files only — no new files are created
- `vsix/src/services/scanner.ts` is the primary file (~80 lines of changes)
- `vsix/src/extension.ts` has minimal changes (~3 lines)
- `vsix/src/test/unit/scanner.test.ts` gets a new `describe` block (~11 test cases)
- The `createLineBuffer()` return type should include both the data handler and a flush function
- Mock OutputChannel for tests: `{ appendLine: sinon.stub(), clear: sinon.stub(), show: sinon.stub(), name: 'ASH', ... }`
- Existing tests must continue to pass — OutputChannel is optional (backward compat verified by T009 test 4)
