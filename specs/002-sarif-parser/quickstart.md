# Quickstart: SARIF Parser

**Feature**: 002-sarif-parser

---

## What This Builds

A pure-function SARIF 2.1.0 parser module (`vsix/src/services/sarif.ts`) that converts ASH CLI output into typed `ParsedFinding` records. No database, no VS Code APIs, no side effects.

## Files

| File | Action | Purpose |
|------|--------|---------|
| `vsix/src/services/sarif.ts` | Create | Parser module: `parseSarif`, `extractSeverity`, `normalizeFilePath`, `deduplicateFindings` |
| `vsix/src/test/fixtures/sarif-factory.ts` | Modify | Move SARIF type interfaces to shared location; add factory helpers for ASH properties and multi-run scenarios |
| `vsix/src/test/unit/sarif.test.ts` | Create | Unit tests covering all 5 user stories + edge cases |

## Key Commands

```bash
cd workbench/vsix

# Compile
npm run compile

# Run just SARIF parser tests
npx mocha out/test/unit/sarif.test.js

# Run all unit tests
npm run test:unit

# Lint
npm run lint
```

## Architecture

```
SarifLog (JSON) ──► parseSarif(log, sourceDir) ──► ParsedFinding[]
                         │
                         ├── For each run.results[]:
                         │     ├── extractSeverity(result, run)
                         │     ├── normalizeFilePath(uri, sourceDir)
                         │     └── Extract title, description, snippet
                         │
                         └── deduplicateFindings(rawFindings)
                               └── Group by (ruleId, file), merge
```

## Type Flow

```
SarifLog          →  ParsedFinding[]    →  (Spec 004: Storage)  →  Finding (DB row)
  (no id fields)      (no id fields)        adds scanId, etc.       (has all FKs)
```

## Severity Mapping Quick Reference

| ASH Property | SARIF Level | Result |
|--------------|-------------|--------|
| `"CRITICAL"` | (ignored) | CRITICAL |
| `"HIGH"` | (ignored) | HIGH |
| (absent) | `"error"` | HIGH |
| (absent) | `"warning"` | MEDIUM |
| (absent) | `"note"` | LOW |
| (absent) | `"none"` | INFO |
