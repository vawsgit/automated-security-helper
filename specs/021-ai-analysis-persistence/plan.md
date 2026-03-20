# Implementation Plan: AI Analysis Persistence

**Feature Branch**: `021-ai-analysis-persistence`
**Spec**: [spec.md](./spec.md)
**Created**: 2026-03-20
**Status**: Complete (implementation exists)

## Technical Context

| Aspect | Detail |
|--------|--------|
| Database | PGLite (WASM PostgreSQL) with Prisma ORM |
| Schema file | `vsix/prisma/schema.prisma` |
| Migration runner | Custom `DatabaseService` (not Prisma CLI) |
| ORM | Prisma with `driverAdapters` preview feature |
| Type definitions | `vsix/src/models/types.ts` (shared manually with `webview/src/types/types.ts`) |
| Mapper layer | `vsix/src/models/mappers.ts` |
| Findings service | `vsix/src/services/findings.ts` |
| AI service | `vsix/src/services/aiService.ts` |
| Message protocol | `vsix/src/models/messages.ts` (ext→webview includes `aiAnalysisResult`) |

### Dependencies

- **Spec 018** (AI Provider Abstraction): Provides `AiService`, `AiProvider` interface, `ClaudeAgentProvider`, and the `analyzeFinding()` flow that emits `AnalysisEvent` objects.

## Constitution Check

| Principle | Status | Notes |
|-----------|--------|-------|
| I. VS Code Native | PASS | Data persisted in PGLite (in-process WASM), no external services |
| II. Extension Host Owns State | PASS | Analysis stored/retrieved by FindingsService in extension host; WebView receives via postMessage |
| III. Ship Fast / Simplicity First | PASS | JSON column on existing table; no new tables, no abstractions beyond what's needed |
| IV. Typed Contracts at Boundaries | PASS | `StoredAiAnalysis` envelope with `AiAnalysis` + `AnalysisMetadata` types; Prisma typed ORM; discriminated union messages |
| V. Theme Integration | N/A | No UI changes in this spec |
| VI. Security by Default | PASS | Data stays in local PGLite; no network exposure; JSON parsed defensively |

## Implementation Summary

All components of this feature are **already implemented**. This plan documents what was built and where each piece lives for traceability against the spec requirements.

### Phase 1: Schema & Migration

**Files modified**:
- `vsix/prisma/schema.prisma` — Added `aiAnalysis Json?` to the `Finding` model
- `vsix/prisma/migrations/20260320000000_add_ai_analysis/migration.sql` — `ALTER TABLE "Finding" ADD COLUMN "aiAnalysis" jsonb`

**Requirement mapping**: FR-001, FR-002, FR-007 (cascade via row deletion)

### Phase 2: Type Definitions

**Files modified**:
- `vsix/src/models/types.ts` — Added `AnalysisMetadata`, `StoredAiAnalysis` interfaces (lines 206-216)

**Existing types leveraged**: `AiAnalysis`, `RiskAssessment`, `SuggestedFix`, `AiReference`, `RiskLevel` (already defined in Spec 018)

**Requirement mapping**: FR-001, FR-002

### Phase 3: Mapper Layer

**Files modified**:
- `vsix/src/models/mappers.ts` — Added `parseStoredAiAnalysis()` function (lines 57-66); updated `mapFindingToRow()` to call it (line 85)

**Behavior**:
- Reads `finding.aiAnalysis` from the database row
- Type-guards the JSON: if it has an `analysis` object, returns it; otherwise returns `null`
- Gracefully handles corrupted/mismatched JSON by returning `null`

**Requirement mapping**: FR-003, FR-008

### Phase 4: FindingsService Methods

**Files modified**:
- `vsix/src/services/findings.ts` — Added `setAiAnalysis()` (lines 24-30) and `clearAiAnalysis()` (lines 32-37)

**`setAiAnalysis(findingId, analysis, metadata)`**:
- Wraps `AiAnalysis` + `AnalysisMetadata` into `StoredAiAnalysis` envelope
- Calls `prisma.finding.update()` to persist the JSON
- Overwrites any existing analysis (FR-005)

**`clearAiAnalysis(findingId)`**:
- Sets `aiAnalysis` to `Prisma.JsonNull` (not JS `null`)
- Idempotent — safe to call on findings with no analysis

**Requirement mapping**: FR-004, FR-005, FR-006

### Phase 5: AiService Integration

**Files modified**:
- `vsix/src/services/aiService.ts` — `analyzeFinding()` calls `findingsService.setAiAnalysis()` on `result` event (lines 126-131)

**Flow**:
1. AiService iterates the provider's async generator
2. On `event.type === 'result'`, persists via `findingsService.setAiAnalysis()`
3. Only successful, complete analyses trigger persistence (FR-006)
4. Errors and interruptions (abort) do not persist anything

**Requirement mapping**: FR-006

### Phase 6: Message Protocol

**Files modified**:
- `vsix/src/models/messages.ts` — `aiAnalysisResult` message includes `analysis: AiAnalysis` and `metadata: AnalysisMetadata`

The WebView receives the full analysis and metadata via postMessage after persistence. On subsequent loads, `mapFindingToRow()` hydrates `aiAnalysis` from the database.

**Requirement mapping**: FR-003

## Requirement Traceability Matrix

| Requirement | Implementation | Test Coverage |
|-------------|---------------|---------------|
| FR-001 (persist analysis) | `FindingsService.setAiAnalysis()` → Prisma update | Unit: findings.test.ts (fixture includes aiAnalysis: null) |
| FR-002 (persist metadata) | `StoredAiAnalysis` envelope in JSON column | Type-level: TypeScript compiler enforces shape |
| FR-003 (load on retrieval) | `parseStoredAiAnalysis()` in mapper | Unit: mapper returns null for missing data |
| FR-004 (clear analysis) | `FindingsService.clearAiAnalysis()` | Unit: sets to Prisma.JsonNull |
| FR-005 (overwrite on re-analyze) | `setAiAnalysis()` uses Prisma `update` (upsert semantics) | Same as FR-001 |
| FR-006 (success-only persist) | `AiService.analyzeFinding()` only persists on `result` event | Integration: verify no persist on error events |
| FR-007 (cascade delete) | Finding model has `onDelete: Cascade` from Scan; JSON column deleted with row | Structural: Prisma schema defines cascade |
| FR-008 (graceful corruption) | `parseStoredAiAnalysis()` returns null for non-conforming JSON | Unit: pass malformed JSON, verify null return |

## Test Gaps

The following areas would benefit from additional test coverage:

1. **`parseStoredAiAnalysis()` with malformed input** — Unit test with various corrupted JSON shapes (missing `analysis` key, wrong types, empty object) to verify FR-008
2. **`setAiAnalysis()` + `clearAiAnalysis()` round-trip** — Integration test using in-memory PGLite: persist, read back, clear, read back null
3. **`AiService.analyzeFinding()` persistence on success** — Verify `setAiAnalysis()` is called after a successful result event, not after error events

## File Inventory

| File | Change Type | Lines |
|------|------------|-------|
| `vsix/prisma/schema.prisma` | Modified | +1 (aiAnalysis field) |
| `vsix/prisma/migrations/20260320000000_add_ai_analysis/migration.sql` | New | 2 lines |
| `vsix/src/models/types.ts` | Modified | +11 (AnalysisMetadata, StoredAiAnalysis) |
| `vsix/src/models/mappers.ts` | Modified | +10 (parseStoredAiAnalysis, mapper update) |
| `vsix/src/services/findings.ts` | Modified | +14 (setAiAnalysis, clearAiAnalysis) |
| `vsix/src/services/aiService.ts` | Modified | +6 (persist on result event) |
