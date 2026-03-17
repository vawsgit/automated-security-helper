# Tasks: Finding Detail & Code Navigation

**Input**: Design documents from `/specs/008-finding-detail-navigation/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, quickstart.md

**Tests**: Included -- the plan specifies 2 test cases and the existing findings.test.ts establishes the test pattern.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2)
- Include exact file paths in descriptions

## Phase 1: Setup

**Purpose**: No setup needed -- all infrastructure exists from Specs 001-006.

(No tasks in this phase.)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Add the `getFindingDetail()` service method that both user stories depend on.

- [x] T001 [P] Add `getFindingDetail(findingId: string): Promise<FindingRow | null>` method to `FindingsService` that queries `db.finding.findUnique()` and maps through `mapFindingToRow()`, returning null when not found, in `vsix/src/services/findings.ts`
- [x] T002 [P] Add `describe('getFindingDetail')` test block with: (1) test that returns mapped `FindingRow` for an existing finding, (2) test that returns `null` for a non-existent finding ID, in `vsix/src/test/unit/findings.test.ts`

**Checkpoint**: Foundation ready -- `getFindingDetail()` is available and tested. User story wiring can now begin.

---

## Phase 3: User Story 1 -- View Finding Detail (Priority: P1)

**Goal**: When a user clicks a finding in the list, full details are loaded from the database via `FindingsService` (not inline Prisma) and displayed in the detail view.

**Independent Test**: Click any finding in the findings list after a completed scan. The detail panel populates with all fields from the database. Verify no direct `db.finding` calls remain in the selectFinding handler.

### Implementation for User Story 1

- [x] T003 [US1] Replace the `selectFinding` case in `handleMessage()` to call `this.findingsService.getFindingDetail()` instead of `this.db.finding.findUnique()` + `mapFindingToRow()`, in `vsix/src/providers/findingsPanelManager.ts`
- [x] T004 [US1] Remove the `mapFindingToRow` import from `vsix/src/providers/findingsPanelManager.ts` if no other handler in the file still uses it (check `setDisposition` and other cases first)

**Checkpoint**: Finding detail loads from the database through the service layer. The selectFinding handler no longer calls Prisma directly.

---

## Phase 4: User Story 2 -- Navigate to Code from Finding (Priority: P1)

**Goal**: Clicking a file path in the finding detail opens the source file in the editor at the correct line. Missing files show a helpful message.

**Independent Test**: From a finding detail view, click the file path. The editor opens the correct file at the start line. Delete a scanned file and click its path -- verify the "File not found" message appears.

### Implementation for User Story 2

(No implementation tasks -- the `navigateToCode` handler in `findingsPanelManager.ts` lines 227-242 is already complete and correct. It handles file resolution, existence checking, editor opening with line positioning, and file-not-found messaging. With real SARIF data from actual scans, the paths correspond to real workspace files.)

**Checkpoint**: Code navigation works end-to-end with real scan data.

---

## Phase 5: Polish & Cross-Cutting Concerns

**Purpose**: Verify everything compiles, all tests pass, no regressions.

- [x] T005 Run `npm run compile` in `vsix/` and verify zero TypeScript errors
- [x] T006 Run `npm run test` in `vsix/` and verify all tests pass (existing + new getFindingDetail tests)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Foundational (Phase 2)**: No dependencies -- can start immediately
  - T001 and T002 are parallel (different files: service vs test)
- **US1 (Phase 3)**: Depends on T001 (needs `getFindingDetail()` to exist)
  - T003 must complete before T004 (need to check if import is still used after T003 change)
- **US2 (Phase 4)**: No tasks -- already implemented. Can be validated at any time.
- **Polish (Phase 5)**: Depends on all previous phases

### User Story Dependencies

- **US1 (P1)**: Depends on Foundational (Phase 2) only. No dependency on US2.
- **US2 (P1)**: No dependencies -- already complete. Independent of US1.

### Parallel Opportunities

Within Phase 2:
- T001 and T002 can run in parallel (different files: findings.ts vs findings.test.ts)

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 2: Foundational (T001, T002 in parallel)
2. Complete Phase 3: US1 (T003, T004 sequentially)
3. **STOP and VALIDATE**: Run `npm run compile` + `npm run test`. Launch extension host (F5), run a scan, click a finding, verify detail loads from DB.
4. US2 requires no changes -- validate code navigation works with real scan data.

### Incremental Delivery

1. T001 + T002 → Service method exists and is tested
2. T003 + T004 → Panel manager routes through service (MVP!)
3. T005 + T006 → Full compile + test verification

---

## Notes

- All tasks modify existing files only -- no new files are created
- `vsix/src/services/findings.ts` gains ~10 lines (one new method)
- `vsix/src/providers/findingsPanelManager.ts` has ~5 lines changed (handler replacement + possible import cleanup)
- `vsix/src/test/unit/findings.test.ts` gets a new `describe` block (~2 test cases)
- The `navigateToCode` handler requires zero changes -- it is already complete
- Existing tests must continue to pass
