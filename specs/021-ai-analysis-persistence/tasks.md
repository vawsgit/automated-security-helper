# Tasks: AI Analysis Persistence

**Input**: Design documents from `/specs/021-ai-analysis-persistence/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md

**Status**: Implementation is complete. All tasks below address **test coverage gaps** identified in plan.md. No new production code is required.

**Organization**: Tasks are grouped by user story to enable independent testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- **Extension host**: `vsix/src/` (TypeScript, Node.js)
- **Tests**: `vsix/src/test/unit/` (Mocha, in-memory PGLite)
- **Schema**: `vsix/prisma/schema.prisma`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: No setup needed — all production code and infrastructure already exists.

**Already complete**:
- `aiAnalysis Json?` column on Finding model in `vsix/prisma/schema.prisma`
- Migration `vsix/prisma/migrations/20260320000000_add_ai_analysis/migration.sql`
- `StoredAiAnalysis` and `AnalysisMetadata` types in `vsix/src/models/types.ts`
- WebView type sync in `webview/src/types/types.ts`
- `parseStoredAiAnalysis()` mapper in `vsix/src/models/mappers.ts`
- `setAiAnalysis()` and `clearAiAnalysis()` in `vsix/src/services/findings.ts`
- `AiService.analyzeFinding()` persistence integration in `vsix/src/services/aiService.ts`
- Message protocol types in `vsix/src/models/messages.ts` and `webview/src/types/messages.ts`

No tasks in this phase.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: No foundational work needed — all blocking prerequisites already exist.

No tasks in this phase.

---

## Phase 3: User Story 1 - Persisted Analysis Survives Session Restart (Priority: P1)

**Goal**: Verify that AI analysis results persist to the database and load back correctly on session restart.

**Independent Test**: Create a finding, persist an analysis via `setAiAnalysis()`, read it back via `getFindingDetail()`, verify the analysis is hydrated from the database.

### Tests for User Story 1

- [x] T001 [P] [US1] Add `setAiAnalysis` and round-trip persistence tests to `vsix/src/test/unit/findings.test.ts`: create a finding, call `setAiAnalysis()` with a full `AiAnalysis` + `AnalysisMetadata`, then call `getFindingDetail()` and assert `aiAnalysis` matches the original analysis content (FR-001, FR-002, FR-003, SC-001)
- [x] T002 [P] [US1] Add overwrite-on-re-analysis test to `vsix/src/test/unit/findings.test.ts`: call `setAiAnalysis()` twice on the same finding with different analysis data, call `getFindingDetail()`, and assert only the latest analysis is returned (FR-005, SC-002)
- [x] T003 [P] [US1] Add `parseStoredAiAnalysis` malformed input tests to `vsix/src/test/unit/findings.test.ts`: test mapper with `null`, `undefined`, empty object `{}`, object missing `analysis` key, object with non-object `analysis` value, and verify all return `null` (FR-008, SC-005)

**Checkpoint**: Persistence and retrieval behavior fully validated.

---

## Phase 4: User Story 2 - Clear Stale Analysis (Priority: P2)

**Goal**: Verify that clearing analysis resets a finding to the unanalyzed state.

**Independent Test**: Create a finding, persist an analysis, call `clearAiAnalysis()`, read it back, verify `aiAnalysis` is `null`.

### Tests for User Story 2

- [x] T004 [P] [US2] Add `clearAiAnalysis` round-trip test to `vsix/src/test/unit/findings.test.ts`: persist an analysis, call `clearAiAnalysis()`, call `getFindingDetail()`, and assert `aiAnalysis` is `null` (FR-004, SC-003)
- [x] T005 [P] [US2] Add `clearAiAnalysis` idempotency test to `vsix/src/test/unit/findings.test.ts`: call `clearAiAnalysis()` on a finding that has no analysis, assert it completes without error (FR-004 edge case)

**Checkpoint**: Clear behavior and idempotency validated.

---

## Phase 5: User Story 3 - Analysis Metadata Visibility (Priority: P3)

**Goal**: Verify that metadata (analyzedAt, modelId, costUsd, toolsUsed) is stored and retrievable alongside the analysis.

**Independent Test**: Covered by T001 — the round-trip test already asserts metadata fields are present in the stored envelope.

### Tests for User Story 3

No additional tasks — metadata persistence is validated by T001's round-trip assertion on the full `StoredAiAnalysis` envelope. The `AnalysisMetadata` shape is enforced at compile time by TypeScript (FR-002).

**Checkpoint**: Metadata persistence covered by US1 tests.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Cascade deletion verification and edge case coverage.

- [x] T006 [US1] Add cascade-delete test to `vsix/src/test/unit/findings.test.ts`: create a finding with a persisted analysis, delete the parent scan via `deleteScan()`, assert the finding and its analysis are both removed (FR-007, SC-004)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No tasks — already complete
- **Phase 2 (Foundational)**: No tasks — already complete
- **Phase 3 (US1)**: Can start immediately — T001, T002, T003 are independent
- **Phase 4 (US2)**: Can start immediately — T004, T005 are independent of US1 tests
- **Phase 5 (US3)**: No tasks — covered by T001
- **Phase 6 (Polish)**: Can start after Phase 1 setup (already done) — T006 uses `deleteScan()` which already exists

### User Story Dependencies

- **User Story 1 (P1)**: No dependencies — all production code exists
- **User Story 2 (P2)**: No dependencies — all production code exists
- **User Story 3 (P3)**: Covered by US1 tests — no separate tasks

### Parallel Opportunities

All test tasks (T001–T006) target the same file (`findings.test.ts`) but test independent `describe` blocks. They can be written in parallel as separate test functions, then merged into the file sequentially.

---

## Parallel Example: All User Stories

```bash
# All test tasks can be written in a single session since they
# go into different describe blocks within findings.test.ts:

T001: "setAiAnalysis round-trip"        → describe('setAiAnalysis')
T002: "overwrite on re-analysis"        → describe('setAiAnalysis')
T003: "parseStoredAiAnalysis malformed"  → describe('parseStoredAiAnalysis')
T004: "clearAiAnalysis round-trip"      → describe('clearAiAnalysis')
T005: "clearAiAnalysis idempotency"     → describe('clearAiAnalysis')
T006: "cascade-delete with analysis"    → describe('deleteScan') [existing block]
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Write T001, T002, T003 (all parallelizable)
2. Run `npm test` — all tests should pass against existing code
3. **STOP and VALIDATE**: Full persistence round-trip confirmed

### Incremental Delivery

1. T001 + T002 + T003 → US1 persistence validated
2. T004 + T005 → US2 clear behavior validated
3. T006 → Cascade deletion validated
4. Each batch adds confidence without modifying production code

---

## Notes

- All tasks are **test-only** — no production code changes required
- All tests follow the existing pattern in `findings.test.ts`: in-memory PGLite, `DatabaseService.initialize()`, Mocha `describe`/`it` blocks, `node:assert/strict`
- The `parseStoredAiAnalysis` tests (T003) may be placed directly in `findings.test.ts` or in a new `mappers.test.ts` file — agent discretion based on file size
- Run tests with `cd vsix && npm test`
