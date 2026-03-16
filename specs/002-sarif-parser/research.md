# Research: SARIF Parser

**Feature**: 002-sarif-parser
**Date**: 2026-03-16

---

## R1: Severity Mapping — Authoritative Source

**Decision**: SARIF level maps as: `error→HIGH`, `warning→MEDIUM`, `note→LOW`, `none→INFO`. ASH properties override when present.

**Rationale**: The technical design contains two mappings — Section 3.3 shows `error→CRITICAL` while Section 5.3 shows `error→HIGH`. Section 5.3 is the authoritative SARIF mapping table and the `extractSeverity()` reference implementation. The `CRITICAL` severity is only assigned when ASH explicitly sets it via the `properties.severity` or `properties['ash/severity']` bag. This matches the spec's FR-004.

**Alternatives considered**:
- `error→CRITICAL` (Section 3.3) — rejected as inconsistent with the reference implementation in Section 5.3
- Using the SARIF `level` as the primary source — rejected because ASH enriches results with more granular severity

---

## R2: Existing SARIF Type Definitions

**Decision**: Reuse the types from `vsix/src/test/fixtures/sarif-factory.ts` (`SarifLog`, `SarifRun`, `SarifResult`) as the canonical SARIF types. Import them in the parser module rather than duplicating.

**Rationale**: The factory already defines well-typed interfaces covering all fields the parser needs. The `properties?: Record<string, unknown>` on `SarifResult` supports ASH-specific severity extraction. Moving the interfaces to a shared location (or re-exporting from the factory) avoids duplication.

**Alternatives considered**:
- Install `@types/sarif` npm package — rejected, adds unnecessary dependency for 3 interfaces
- Duplicate the types in `sarif.ts` — rejected, violates DRY

---

## R3: Deduplication Key — Parser vs Database

**Decision**: Parser deduplicates on `(ruleId, file)`. Database indexes on `(scanTargetId, ruleId, file)`.

**Rationale**: The parser produces `ParsedFinding` objects which have no `scanTargetId` (that's a database identity field added during storage). The parser's job is to merge findings within a single SARIF log where the same rule flags the same file across scanners. The database's composite index adds `scanTargetId` for cross-scan cumulative deduplication, which is a storage concern (Spec 004).

**Alternatives considered**:
- Deduplicate in the storage layer instead — rejected, parser should produce clean output regardless of storage

---

## R4: Scanner Name Concatenation Format

**Decision**: During deduplication, multiple scanner names are joined as a comma-separated string (e.g., `"bandit, semgrep"`).

**Rationale**: The database `Finding.scanner` field is `String` (not JSON/array). A comma-separated string is human-readable, simple to parse if needed later, and directly storable. The `ruleIds` JSON field on the database Finding model can hold an array of all original rule IDs from different scanners if needed by the storage layer.

**Alternatives considered**:
- Array type on ParsedFinding.scanner — rejected, doesn't match DB schema and adds complexity
- Keep only first scanner name — rejected, spec requires "concatenating scanner names"

---

## R5: parseSarif() and deduplicateFindings() — Pipeline Design

**Decision**: `parseSarif()` is the main entry point and calls `deduplicateFindings()` internally before returning. Both functions are exported for independent use and testing.

**Rationale**: The functional design (Section 4.2) states "deduplication by (ruleId, file) happens at parse time." This means `parseSarif()` returns already-deduplicated results. Exporting `deduplicateFindings()` separately enables unit testing of the dedup logic in isolation and allows callers to skip dedup if they need raw results (by calling internal extraction functions).

**Alternatives considered**:
- Separate pipeline where caller must call dedup — rejected, contradicts "happens at parse time"
- Only export parseSarif, hide dedup — rejected, testability requires independent access

---

## R6: Default Values for Missing SARIF Fields

**Decision**: Use these defaults when SARIF fields are absent:

| Missing Field | Default Value | Rationale |
|---------------|---------------|-----------|
| `ruleId` | `"unknown"` | FR-013, allows finding to exist without rule |
| `artifactLocation.uri` | `"unknown"` | FR-013, allows finding without file |
| `region` (entire object) | `startLine: 1`, `endLine: undefined` | FR-014, reasonable first-line default |
| `region.endLine` | `undefined` | Single-line finding |
| `region.snippet` | `undefined` | No code excerpt available |
| `properties` | `{}` (treated as absent) | Falls through to SARIF level mapping |
| `locations` (empty array) | file: `"unknown"`, startLine: `1` | Combines file and region defaults |
| `level` (missing) | `"warning"` | SARIF spec default per Section 3.27.10 |

**Rationale**: These defaults ensure every SARIF result produces a valid ParsedFinding. The SARIF 2.1.0 spec defines `"warning"` as the default level when the field is absent.

---

## R7: Title Extraction Strategy

**Decision**: Extract title using this priority chain:
1. `run.tool.driver.rules[]` — find rule matching `result.ruleId`, use `shortDescription.text`
2. `result.message.text` — truncated to first sentence or 120 characters
3. `result.ruleId` — last resort fallback

**Rationale**: The `shortDescription` in the rules array is purpose-built as a title. The full `message.text` is the description and may be very long. When rules array is missing or doesn't contain the ruleId, the message serves as both title and description (FR-008).

**Alternatives considered**:
- Always use `message.text` as title — rejected, often too verbose for a title field
- Use `ruleId` as title — rejected, not human-readable
