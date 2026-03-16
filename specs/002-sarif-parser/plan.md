# Implementation Plan: SARIF Parser

**Feature**: 002-sarif-parser
**Branch**: `002-sarif-parser`
**Date**: 2026-03-16

---

## Technical Context

| Aspect | Detail |
|--------|--------|
| Runtime | Node.js (VS Code extension host), TypeScript strict mode, ES2022, Node16 modules |
| Module type | Pure functions — no VS Code APIs, no database, no side effects |
| Testing | Mocha + `node:assert/strict`, factory builders in `sarif-factory.ts` |
| Linting | ESLint flat config, typescript-eslint |
| Existing code | `vsix/src/test/fixtures/sarif-factory.ts` (SARIF types + factories) |
| Dependencies | None — uses only existing project types |

## Constitution Check

| Principle | Status | Notes |
|-----------|--------|-------|
| I. VS Code Native | PASS | No external dependencies, pure in-process logic |
| II. Extension Host Owns State | PASS | Parser lives in `vsix/src/`, no WebView involvement |
| III. Ship Fast / Simplicity First | PASS | Pure functions, no abstractions beyond what's needed |
| IV. Typed Contracts at Boundaries | PASS | `ParsedFinding` is a typed output; SARIF types imported from existing factory |
| V. Theme Integration | N/A | No UI component |
| VI. Security by Default | PASS | No user input handling, no command injection, no eval |

## Implementation Phases

### Phase A: Type Definitions & Factory Updates

**Goal**: Establish shared SARIF types and extend the test factory for parser testing.

1. Move `SarifLog`, `SarifRun`, `SarifResult` interfaces from `sarif-factory.ts` so the parser can import them (keep them in the factory file but ensure they're importable by production code, or extract to a shared types file)
2. Define `ParsedFinding` interface and `Severity` type in `vsix/src/services/sarif.ts`
3. Add factory helpers to `sarif-factory.ts`:
   - `createAshSeverityResult(severity, level)` — result with ASH properties
   - `createMultiRunSarif(scannerConfigs[])` — multi-scanner SARIF log
   - `createMinimalResult(overrides)` — result with minimal fields (for missing-field tests)

### Phase B: Core Parser Functions

**Goal**: Implement all 4 exported functions.

1. `extractSeverity(result, run)` — ASH properties check → SARIF level fallback
2. `normalizeFilePath(uri, sourceDir)` — strip `file://`, make relative, handle edge cases
3. `parseSarif(sarifJson, sourceDir)` — iterate runs/results, build ParsedFinding array, call dedup
4. `deduplicateFindings(findings)` — group by (ruleId, file), merge per rules in data-model.md

### Phase C: Unit Tests

**Goal**: Full test coverage for all 5 user stories + edge cases.

Test file: `vsix/src/test/unit/sarif.test.ts`

**US1 tests** (multi-scanner extraction):
- Extracts findings from multi-run SARIF (all 8 ASH scanners)
- Handles empty results array (clean scan)
- Extracts scanner name from `run.tool.driver.name`

**US2 tests** (severity mapping):
- Maps ASH `properties.severity` when present
- Maps ASH `properties['ash/severity']` when present
- Falls back to SARIF level mapping for each level value
- Handles missing level (defaults to MEDIUM)

**US3 tests** (path normalization):
- Strips `file://` prefix
- Makes paths relative to source directory
- Handles trailing slash on sourceDir
- Handles already-relative paths

**US4 tests** (deduplication):
- Deduplicates by (ruleId, file)
- Merges line ranges (min start, max end)
- Concatenates scanner names
- Keeps highest severity
- Does not merge different ruleIds or different files

**US5 tests** (missing fields):
- No region → startLine 1
- No snippet → undefined
- No endLine → undefined
- No properties → SARIF level fallback
- Empty locations → defaults

**Edge case tests**:
- Zero runs → empty array
- Missing ruleId → "unknown"
- Missing artifactLocation.uri → "unknown"
- Title extraction from rules[].shortDescription
- Title fallback to message.text

### Phase D: Polish

**Goal**: Compile clean, lint clean, all tests pass.

1. `npm run compile` — zero TypeScript errors
2. `npm run lint` — zero ESLint errors in new/modified files
3. `npx mocha` — all tests pass (existing + new)
4. Verify test suite stays under 5 seconds total

## Artifacts Generated

| Artifact | Path |
|----------|------|
| Research | `specs/002-sarif-parser/research.md` |
| Data Model | `specs/002-sarif-parser/data-model.md` |
| Contract | `specs/002-sarif-parser/contracts/sarif-parser.md` |
| Quickstart | `specs/002-sarif-parser/quickstart.md` |
| Plan | `specs/002-sarif-parser/plan.md` (this file) |

## Risks

| Risk | Mitigation |
|------|------------|
| SARIF types in test fixtures can't be imported by production code | Extract to shared types file or re-export from a non-test location |
| Factory spread overrides may not handle nested objects (locations) | Write specific factory helpers for complex test scenarios |
| Dedup merge severity comparison | Define explicit severity ordering constant |
