# Implementation Plan: .ash.yaml Read Service & Suppression Matching

**Branch**: `014-ash-yaml-suppression` | **Date**: 2026-03-19 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/014-ash-yaml-suppression/spec.md`

## Summary

Introduce an `AshYamlService` in the extension host that discovers and parses `.ash.yaml` configuration files from the scan root, caches the parsed state, and provides a suppression matching function that replicates the ASH CLI's `suppression_matcher.py` logic. The service watches for file changes (debounced), re-discovers config on scan root changes, and emits events for downstream consumers. New type interfaces (`AshSuppression`, `AshIgnorePath`, `AshYamlConfig`) are added to both vsix and webview type files. Dependencies `js-yaml` and `picomatch` are added for YAML parsing and glob matching.

## Technical Context

**Language/Version**: TypeScript / ES2022, Node16 modules, strict mode
**Primary Dependencies**: js-yaml (YAML parsing), picomatch (glob matching), vscode API (file watchers, events, config)
**Storage**: N/A — in-memory cached state only (reads from filesystem)
**Testing**: Mocha (unit, Node.js) — pure logic service, no VS Code API mocking needed for core parsing/matching
**Target Platform**: VS Code extension host (Node.js runtime)
**Project Type**: VS Code extension (monorepo: vsix/ + webview/)
**Performance Goals**: 500 findings × 100 rules < 500ms batch matching (SC-005)
**Constraints**: No env var interpolation (literal strings only); read-only (no writes to .ash.yaml)
**Scale/Scope**: < 1000 suppression rules typical

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
| --------- | ------ | ----- |
| I. VS Code Native | PASS | Uses vscode.workspace.createFileSystemWatcher, vscode.EventEmitter. No external services. File read via fs (Node.js built-in within extension host). |
| II. Extension Host Owns State | PASS | AshYamlService lives in vsix/src/services/. All parsing, matching, and caching in extension host. WebView receives results via existing message protocol. |
| III. Ship Fast / Simplicity First | PASS | Single service file. No abstractions beyond the service class itself. picomatch and js-yaml are minimal, proven libraries. |
| IV. Typed Contracts at Boundaries | PASS | New interfaces (AshSuppression, AshIgnorePath, AshYamlConfig) defined in types.ts, mirrored to webview. Discriminated union not needed (no new messages in this spec). |
| V. Theme Integration | N/A | No UI changes in this spec. |
| VI. Security by Default | PASS | js-yaml used with DEFAULT_SCHEMA (no custom tags, no code execution). No eval(). File paths from config are used for matching only, not for file access. |

**Post-Phase 1 Re-check**: All gates still pass. No new dependencies or patterns introduced beyond what was assessed above.

## Project Structure

### Documentation (this feature)

```text
specs/014-ash-yaml-suppression/
├── plan.md              # This file
├── spec.md              # Feature specification
├── research.md          # Phase 0: research decisions
├── data-model.md        # Phase 1: entity definitions
├── quickstart.md        # Phase 1: build & verify guide
├── contracts/
│   └── ash-yaml-service.md  # Phase 1: service interface contract
└── checklists/
    └── requirements.md  # Spec quality checklist
```

### Source Code (repository root)

```text
workbench/
├── vsix/
│   ├── src/
│   │   ├── models/
│   │   │   └── types.ts              # MODIFY: add AshSuppression, AshIgnorePath, AshScannerEntry, AshYamlConfig
│   │   ├── services/
│   │   │   └── ashYaml.ts            # NEW: AshYamlService
│   │   ├── extension.ts              # MODIFY: create and wire AshYamlService
│   │   └── test/
│   │       └── unit/
│   │           └── ashYaml.test.ts   # NEW: unit tests
│   └── package.json                  # MODIFY: add js-yaml, picomatch deps
└── webview/
    └── src/
        └── types/
            └── types.ts              # MODIFY: mirror new interfaces
```

**Structure Decision**: Follows existing monorepo layout. New service in `vsix/src/services/` alongside existing domain services. Unit tests in `vsix/src/test/unit/` (new subdirectory for pure Node.js tests that don't require VS Code electron).

## Complexity Tracking

No constitution violations to justify.

## Implementation Phases

### Phase A: Types & Dependencies

**Goal**: Add type interfaces and npm dependencies.

1. **Add npm dependencies**
   - `npm install js-yaml picomatch` in vsix/
   - `npm install -D @types/js-yaml @types/picomatch` in vsix/
   - Verify `npm run compile` still passes

2. **Add type interfaces to `vsix/src/models/types.ts`**
   ```typescript
   export interface AshSuppression {
     path: string;
     reason: string;
     rule_id: string | null;
     line_start: number | null;
     line_end: number | null;
     expiration: string | null;
   }

   export interface AshIgnorePath {
     path: string;
     reason: string;
     expiration: string | null;
   }

   export interface AshScannerEntry {
     name: string;
     enabled: boolean;
   }

   export interface AshYamlConfig {
     suppressions: AshSuppression[];
     ignorePaths: AshIgnorePath[];
     severityThreshold: 'ALL' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
     projectName: string;
     scanners: AshScannerEntry[];
     failOnFindings: boolean;
     configFilePath: string | null;
   }
   ```

3. **Mirror interfaces to `webview/src/types/types.ts`**
   - Copy the same four interfaces verbatim

### Phase B: Core Service — Parsing & Discovery

**Goal**: Implement config file discovery and YAML/JSON parsing.

1. **Create `vsix/src/services/ashYaml.ts`** with:
   - `ASH_CONFIG_FILE_NAMES` constant array (6 filenames from CLI constants.py)
   - `ASH_CONFIG_SEARCH_DIRS` — `['', '.ash']` (root and .ash/ subdirectory)
   - `discoverConfigFile(scanRoot: string): string | null` — iterate filenames × dirs, return first existing path
   - `parseConfigFile(filePath: string): AshYamlConfig` — read file, detect format (YAML vs JSON by extension), parse, validate structure, return typed config
   - `parseRawConfig(raw: unknown): AshYamlConfig` — validate and extract fields from parsed YAML/JSON object, skip malformed sections with warnings
   - `DEFAULT_CONFIG` constant for empty/default state
   - Individual parse helpers: `parseSuppressions(raw)`, `parseIgnorePaths(raw)`, `parseScanners(raw)`

2. **Validation logic**:
   - Skip suppression entries missing `path` or `reason` (log warning)
   - Skip ignore path entries missing `path` or `reason` (log warning)
   - Coerce `severity_threshold` to uppercase, validate against enum, default to `'MEDIUM'`
   - Coerce `fail_on_findings` to boolean, default to `true`
   - Coerce `project_name` to string, default to `'ash-scan'`

### Phase C: Core Service — Suppression Matching

**Goal**: Implement the matching algorithm identical to the CLI's `suppression_matcher.py`.

1. **Add matching functions to `ashYaml.ts`**:
   - `isExpired(expiration: string | null): boolean` — parse YYYY-MM-DD, return true if < today; invalid format → false + warn
   - `matchesRuleId(findingRuleId: string, suppressionRuleId: string | null): boolean` — null suppression rule_id = match all; use picomatch for glob
   - `matchesFilePath(findingPath: string, suppressionPath: string): boolean` — exact match first, then picomatch glob
   - `matchesLineRange(finding: FindingRow, suppression: AshSuppression): boolean` — 4 sub-cases per research R-002
   - `matchesSuppression(finding: FindingRow, suppression: AshSuppression): boolean` — combines all checks

2. **Public matching methods on AshYamlService class**:
   - `matchesSuppression(finding: FindingRow): AshSuppression | null` — iterate non-expired suppressions, return first match
   - `getMatchingSuppressions(findings: FindingRow[]): Map<string, AshSuppression>` — batch match, compile picomatch patterns once for reuse across findings

3. **Performance optimization for batch matching**:
   - Pre-filter expired suppressions once
   - Pre-compile picomatch patterns for `rule_id` and `path` fields
   - Reuse compiled matchers across all findings in the batch

### Phase D: File Watching & Events

**Goal**: Watch for config file changes, debounce, and emit events.

1. **File system watchers**:
   - Create watchers using `vscode.workspace.createFileSystemWatcher` with `RelativePattern`
   - Watch pattern: `{.ash.yml,.ash.yaml,.ash.json,ash.yml,ash.yaml,ash.json}` in scan root
   - Watch pattern: `.ash/{.ash.yml,.ash.yaml,.ash.json,ash.yml,ash.yaml,ash.json}` in scan root
   - On create/change/delete → trigger debounced re-parse

2. **Debounce mechanism**:
   - 200ms debounce timer (clearTimeout / setTimeout)
   - On timer fire: re-discover config file, re-parse, update cached state

3. **Event emission**:
   - `private _onDidChangeConfig = new vscode.EventEmitter<AshYamlConfig>()`
   - `readonly onDidChangeConfig = this._onDidChangeConfig.event`
   - Fire after every successful re-parse (including on delete → default config)

4. **Dispose**:
   - Dispose all file watchers
   - Dispose EventEmitter
   - Clear debounce timer

### Phase E: Extension Wiring

**Goal**: Create AshYamlService in extension.ts and wire to existing services/providers.

1. **Create service in `activate()`** (after ScanRootService initialization):
   ```
   const ashYamlService = new AshYamlService(scanRootService.getEffectiveScanRoot());
   context.subscriptions.push(ashYamlService);
   ```

2. **Wire to providers via setters**:
   - `findingsPanelManager.setAshYamlService(ashYamlService)`
   - `sidebarProvider.setAshYamlService(ashYamlService)`

3. **Add to scan root change listener**:
   ```
   if (e.affectsConfiguration('ashWorkbench.scanRoot')) {
     scanRootService.refresh();
     ashYamlService.setScanRoot(scanRootService.getEffectiveScanRoot());
     // ... existing cascading updates
   }
   ```

4. **Subscribe to config changes for UI refresh**:
   ```
   context.subscriptions.push(
     ashYamlService.onDidChangeConfig(() => {
       findingsPanelManager.postStateUpdate();
       sidebarProvider.queryStateAndPost();
     })
   );
   ```

### Phase F: Unit Tests

**Goal**: Comprehensive unit tests for parsing and matching logic.

1. **Test file**: `vsix/src/test/unit/ashYaml.test.ts`

2. **Parsing tests**:
   - Parse valid YAML with all fields populated
   - Parse valid YAML with minimal fields (only required)
   - Parse valid JSON format
   - Handle invalid YAML syntax → default config
   - Handle valid YAML with wrong structure → skip malformed sections
   - Handle missing required fields on individual rules → skip rule
   - Parse severity threshold (valid enum, invalid value → default)
   - Parse scanners section (object → array of entries)

3. **Config file discovery tests** (mock fs):
   - Find `.ash.yml` in root (first priority)
   - Fall through to `.ash/` subdirectory when root has no config
   - Respect priority order (`.ash.yml` before `.ash.yaml` before `.ash.json`)
   - Return null when no config file exists
   - Include non-dot-prefixed filenames (`ash.yml`, `ash.yaml`, `ash.json`)

4. **Suppression matching tests**:
   - Exact rule_id match
   - Glob rule_id match (`B*` matches `B605`)
   - Null rule_id matches any finding
   - Exact file path match
   - Glob file path match (`src/**/*.py` matches `src/app/main.py`)
   - File path non-match (`src/**/*.py` does not match `tests/test.py`)
   - Line range overlap (finding 15-25, suppression 10-20 → match)
   - Line range non-overlap (finding 30-35, suppression 10-20 → no match)
   - No line range on suppression → matches any line
   - Only line_start specified
   - Only line_end specified
   - Expired suppression → no match
   - Future expiration → match
   - No expiration → match (permanent)
   - Invalid expiration date → treat as non-expiring + warn
   - First match wins (multiple rules, second matches)
   - No match returns null

5. **Batch matching tests**:
   - Multiple findings, some match, some don't
   - Returns Map with correct findingId keys
   - Empty suppressions → empty Map
   - Empty findings → empty Map

## Risk Assessment

| Risk | Impact | Mitigation |
| ---- | ------ | ---------- |
| picomatch glob behavior differs from Python fnmatch | Medium — SC-006 parity failure | Unit test edge cases from CLI test suite; picomatch supports fnmatch patterns natively |
| Large .ash.yaml causes parse delay | Low — rare in practice | Pre-filter expired rules; compile patterns once in batch mode |
| File watcher misses changes on some OS/editors | Low — VS Code watcher is well-tested | Debounce handles rapid changes; manual refresh possible via scan root re-set |
| js-yaml security (code execution via YAML tags) | High if mishandled | Use `yaml.load()` with `DEFAULT_SCHEMA` only — no custom tags, no code execution |
