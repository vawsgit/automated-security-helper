# Research: Finding Triage

**Branch**: `009-finding-triage` | **Date**: 2026-03-17

## Summary

No unknowns identified. All patterns are established from Specs 006-008. One schema change confirmed.

## Findings

### R1: Service-Layer Routing for setDisposition (Confirmatory)

**Decision**: Add `setDisposition()` to `FindingsService`, same pattern as `getFindingDetail()` from Spec 008.

**Rationale**: The constitution requires domain queries to go through service classes. The current `setDisposition` handler calls `this.db.finding.update()` directly in the panel manager.

**Alternatives considered**: None -- convention is established.

### R2: Notes Column on Finding Model (Confirmatory)

**Decision**: Add `notes String?` to the Prisma Finding model.

**Rationale**: `FindingRow` already has a `notes: string` field in the view type, but `mapFindingToRow()` hardcodes it to `''` because no DB column exists. Adding a nullable column preserves backward compatibility -- existing findings get null (mapped to empty string).

**Alternatives considered**: Non-nullable with `@default("")`. Rejected because nullable is more semantically accurate and avoids storing empty strings for the majority of findings that have no notes.

### R3: PGLite Schema Migration (Confirmatory)

**Decision**: Use `npx prisma db push` for the schema change.

**Rationale**: PGLite uses push-based migration (no migration files). The `db push` command applies schema changes directly. Adding a nullable column is non-destructive -- no data loss.

**Alternatives considered**: Prisma migrate. Not applicable for PGLite WASM in-process database.

### R4: Message Protocol Addition (Confirmatory)

**Decision**: Add `setNotes` (WebView -> Extension) and `notesUpdated` (Extension -> WebView) message types.

**Rationale**: `setDisposition` and `dispositionUpdated` already exist as the pattern. Notes follow the same request/response flow. Both must be added to discriminated unions in both vsix and webview packages.

**Alternatives considered**: Reusing `setDisposition` message for notes. Rejected because notes are semantically different from disposition and warrant their own message type for clarity.
