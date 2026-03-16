# Contract: SARIF Parser Module

**Feature**: 002-sarif-parser
**Module**: `vsix/src/services/sarif.ts`

---

## Exported Functions

### parseSarif

```
parseSarif(sarifJson: SarifLog, sourceDir: string): ParsedFinding[]
```

Main entry point. Iterates all runs and results in the SARIF log, maps each result to a ParsedFinding, normalizes file paths relative to `sourceDir`, and deduplicates the output.

**Parameters**:
- `sarifJson` — A parsed SARIF 2.1.0 log object (caller is responsible for JSON parsing)
- `sourceDir` — Absolute path to the scanned source directory, used to make file paths relative

**Returns**: Array of deduplicated `ParsedFinding` objects. Empty array if no results exist.

**Behavior**:
1. If `sarifJson.runs` is empty or missing, return `[]`
2. For each run, extract scanner name from `run.tool.driver.name`
3. For each result in `run.results`, build a `ParsedFinding`:
   - Extract severity via `extractSeverity(result, run)`
   - Normalize file path via `normalizeFilePath(uri, sourceDir)`
   - Extract title from `run.tool.driver.rules[]` matching `result.ruleId`, fallback to `result.message.text`
   - Apply defaults for missing fields (see data-model.md)
4. Deduplicate all findings via `deduplicateFindings()`
5. Return deduplicated array

**Error handling**: Does not throw. Missing/malformed fields produce findings with default values.

---

### extractSeverity

```
extractSeverity(result: SarifResult, run: SarifRun): Severity
```

Determines severity for a single SARIF result.

**Priority chain**:
1. `result.properties?.severity` — if present, uppercase and return
2. `result.properties?.['ash/severity']` — if present, uppercase and return
3. SARIF level mapping: `error→HIGH`, `warning→MEDIUM`, `note→LOW`, `none→INFO`
4. If level is missing, treat as `"warning"` (SARIF spec default) → `MEDIUM`

**Returns**: One of `CRITICAL`, `HIGH`, `MEDIUM`, `LOW`, `INFO`

---

### normalizeFilePath

```
normalizeFilePath(uri: string, sourceDir: string): string
```

Converts a SARIF artifact URI to a relative file path.

**Steps**:
1. Strip `file://` prefix (if present)
2. Decode URI-encoded characters (e.g., `%20` → space)
3. Compute path relative to `sourceDir`
4. Handle trailing slash on `sourceDir`
5. If URI is already relative, return as-is
6. If URI is empty or missing, return `"unknown"`

**Returns**: Relative file path string (e.g., `src/app.py`)

---

### deduplicateFindings

```
deduplicateFindings(findings: ParsedFinding[]): ParsedFinding[]
```

Groups findings by `(ruleId, file)` and merges duplicates.

**Merge strategy** per group:
- `startLine`: min of all
- `endLine`: max of all (if any defined)
- `description`: longest text
- `scanner`: unique names joined with `", "`
- `title`: first non-empty
- `snippet`: first non-empty
- `severity`: highest (CRITICAL > HIGH > MEDIUM > LOW > INFO)

**Returns**: Deduplicated array, one finding per unique `(ruleId, file)` pair.

---

## Exported Types

### ParsedFinding

```typescript
interface ParsedFinding {
  ruleId: string;
  scanner: string;
  severity: Severity;
  file: string;
  startLine: number;
  endLine?: number;
  title: string;
  description: string;
  snippet?: string;
}
```

### Severity

```typescript
type Severity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO';
```

### SARIF Types

Imported from `vsix/src/test/fixtures/sarif-factory.ts`:
- `SarifLog`
- `SarifRun`
- `SarifResult`

---

## Invariants

- `parseSarif()` never throws — all missing data produces defaults
- Output `file` fields are always relative (no `file://` prefix, no absolute paths)
- Output is always deduplicated — no two findings share the same `(ruleId, file)` pair
- `severity` is always a valid Severity enum value
- Empty input (no runs, no results) always returns `[]`
