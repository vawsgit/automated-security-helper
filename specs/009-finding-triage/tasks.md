# Tasks: Finding Triage

**Input**: Design documents from `/specs/009-finding-triage/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, quickstart.md

**Tests**: Included -- the plan specifies 4 test cases for the new service methods.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2)
- Include exact file paths in descriptions

## Phase 1: Setup

**Purpose**: Schema change and Prisma client regeneration needed before any service work.

- [x] T001 Add `notes String?` column to the Finding model (after `snippet`, before `disposition`) in `vsix/prisma/schema.prisma`
- [x] T002 Run `npx prisma generate` in `vsix/` to regenerate the Prisma client with the new `notes` field

**Checkpoint**: Prisma client recognizes the `notes` field on Finding. Build should compile.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Update mapper, message types, and service methods that both user stories depend on.

- [x] T003 Update `mapFindingToRow()` to read `finding.notes ?? ''` instead of hardcoded `''` on line 62 of `vsix/src/models/mappers.ts`
- [x] T004 [P] Add `setNotes` to `WebviewToExtMessage` and `notesUpdated` to `ExtToWebviewMessage` discriminated unions in `vsix/src/models/messages.ts`
- [x] T005 [P] Mirror the same `setNotes` and `notesUpdated` message type additions in `webview/src/types/messages.ts`
- [x] T006 Add `setDisposition(findingId: string, disposition: Disposition): Promise<FindingRow>` method to `FindingsService` that calls `db.finding.update()` and returns `mapFindingToRow(updated)`, in `vsix/src/services/findings.ts`
- [x] T007 Add `setNotes(findingId: string, notes: string): Promise<FindingRow>` method to `FindingsService` that calls `db.finding.update()` and returns `mapFindingToRow(updated)`, in `vsix/src/services/findings.ts`
- [x] T008 Add `describe('setDisposition')` and `describe('setNotes')` test blocks to `vsix/src/test/unit/findings.test.ts` with: (1) setDisposition updates and returns correct disposition, (2) setNotes updates and returns correct notes, (3) setDisposition throws for non-existent finding ID, (4) notes field maps from database in getFindingDetail

**Checkpoint**: Foundation ready -- service methods exist and are tested. Mapper reads notes from DB. Message types are synced across packages.

---

## Phase 3: User Story 1 -- Set Finding Disposition (Priority: P1)

**Goal**: Route the `setDisposition` handler through `FindingsService` instead of inline Prisma calls. Summary bar updates after each change.

**Independent Test**: Set a finding's disposition to "Fix", reload the extension, verify it persists. Check summary bar counts are correct.

### Implementation for User Story 1

- [x] T009 [US1] Replace the `setDisposition` case in `handleMessage()` to call `this.findingsService.setDisposition()` instead of `this.db.finding.update()`, keeping the `dispositionUpdated` post and `postStateUpdate()` call, in `vsix/src/providers/findingsPanelManager.ts`
- [x] T010 [US1] Check if `this.db` is still used directly anywhere in `findingsPanelManager.ts` after T009; if not, remove the `PrismaClient` constructor parameter and `this.db` field (update callers in `vsix/src/extension.ts` if constructor signature changes)

**Checkpoint**: Disposition updates route through the service layer. Summary bar refreshes after each change.

---

## Phase 4: User Story 2 -- Add Triage Notes (Priority: P2)

**Goal**: Add `setNotes` message handler so notes typed in the WebView are persisted to the database.

**Independent Test**: Type a note on a finding, reload the extension, verify the note persists.

### Implementation for User Story 2

- [x] T011 [US2] Add `case 'setNotes'` handler in `handleMessage()` that calls `this.findingsService.setNotes()` and posts `notesUpdated` message to WebView, in `vsix/src/providers/findingsPanelManager.ts`

**Checkpoint**: Notes are persisted via the extension host and survive reload.

---

## Phase 5: Polish & Cross-Cutting Concerns

**Purpose**: Verify everything compiles, all tests pass, no regressions.

- [x] T012 Run `npm run compile` in `vsix/` and verify zero TypeScript errors
- [x] T013 Run `npm run test` in `vsix/` and verify all tests pass (existing + new triage tests)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies -- can start immediately. T001 then T002 (sequential).
- **Foundational (Phase 2)**: Depends on Phase 1 (Prisma client must be regenerated). T003 depends on T002. T004 and T005 are parallel (different packages). T006 and T007 depend on T003 (mapper must be updated first). T008 depends on T006+T007.
- **US1 (Phase 3)**: Depends on T006 (needs `setDisposition()` service method). T009 before T010.
- **US2 (Phase 4)**: Depends on T007 (needs `setNotes()` service method) and T004 (needs `setNotes` message type). T011 is independent of US1.
- **Polish (Phase 5)**: Depends on all previous phases.

### User Story Dependencies

- **US1 (P1)**: Depends on Foundational (Phase 2) only. No dependency on US2.
- **US2 (P2)**: Depends on Foundational (Phase 2) only. No dependency on US1.

Both user stories can run in parallel after Phase 2.

### Parallel Opportunities

Within Phase 2:
- T004 and T005 can run in parallel (different packages: vsix vs webview)
- T006 and T007 can run in parallel (independent methods in the same file, but sequential is safer)

Across Phases 3-4:
- US1 and US2 can run in parallel after Phase 2 completes

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001, T002)
2. Complete Phase 2: Foundational (T003-T008)
3. Complete Phase 3: US1 (T009, T010)
4. **STOP and VALIDATE**: Run `npm run compile` + `npm run test`. Launch extension host (F5), run a scan, set a disposition, reload, verify it persists.

### Incremental Delivery

1. T001-T002 → Schema updated, Prisma regenerated
2. T003-T008 → Service methods, mapper, message types, tests (Foundation!)
3. T009-T010 → Disposition routes through service (MVP!)
4. T011 → Notes persistence wired up
5. T012-T013 → Full compile + test verification

---

## Notes

- `vsix/prisma/schema.prisma` gains 1 line (notes column)
- `vsix/src/services/findings.ts` gains ~15 lines (two new methods)
- `vsix/src/providers/findingsPanelManager.ts` gains ~15 lines (handler changes + new handler)
- `vsix/src/models/messages.ts` gains 2 lines (new message types)
- `vsix/src/models/mappers.ts` changes 1 line (notes mapping)
- `webview/src/types/messages.ts` gains 2 lines (mirrored message types)
- `vsix/src/test/unit/findings.test.ts` gains ~4 test cases
- T010 may change `findingsPanelManager.ts` constructor signature if `db` is no longer needed -- check `extension.ts` callers
