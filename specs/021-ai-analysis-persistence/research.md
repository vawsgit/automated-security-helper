# Research: AI Analysis Persistence

**Feature**: 021-ai-analysis-persistence
**Date**: 2026-03-20

## Summary

All technical decisions for this feature have already been resolved through implementation. This research document captures the decisions made and their rationale.

## Decision 1: JSON Column vs Separate Table

- **Decision**: Store AI analysis as a `Json?` (jsonb) column on the `Finding` model
- **Rationale**: 1:1 relationship between Finding and its analysis. A separate table adds join complexity with no normalization benefit. The JSON blob is read/written atomically alongside the finding — no partial reads needed.
- **Alternatives considered**:
  - Separate `AiAnalysis` table with foreign key to `Finding` — adds migration complexity and join overhead for a strict 1:1 relationship
  - VS Code `globalState` / `ExtensionContext.secrets` — doesn't support structured queries, doesn't cascade with finding deletion

## Decision 2: StoredAiAnalysis Envelope Pattern

- **Decision**: Wrap `AiAnalysis` and `AnalysisMetadata` in a `StoredAiAnalysis` envelope (`{ analysis, metadata }`) stored as a single JSON document
- **Rationale**: Keeps analysis content and provenance metadata together as one atomic unit. The mapper can extract the `analysis` field for the view layer while keeping metadata available for display. Simple to version — if the shape changes, the old shape fails the type guard and returns null gracefully (FR-008).
- **Alternatives considered**:
  - Flat structure (merge metadata fields into AiAnalysis) — mixes concerns, harder to distinguish content from provenance
  - Separate columns for analysis and metadata — two JSON columns on one row is unnecessary when they're always read/written together

## Decision 3: Graceful Corruption Handling

- **Decision**: `parseStoredAiAnalysis()` returns `null` for any JSON that doesn't match the expected shape, rather than throwing
- **Rationale**: A security tool must not crash due to stale data from a previous schema version. Treating corrupted analysis as "not yet analyzed" is safe — the user can re-analyze. This supports forward-compatible schema evolution without migration of existing JSON data.
- **Alternatives considered**:
  - Strict validation with error propagation — risks crashing the extension on schema changes
  - JSON Schema validation — over-engineering for a single-developer project (constitution: Ship Fast)

## Decision 4: Prisma Migration Strategy

- **Decision**: Simple additive migration (`ALTER TABLE "Finding" ADD COLUMN "aiAnalysis" jsonb`)
- **Rationale**: No production data exists (active development). The column is nullable, so existing rows get `NULL` (unanalyzed) by default. No backfill needed.
- **Alternatives considered**:
  - Multi-step migration with default values — unnecessary complexity for a nullable column in development
