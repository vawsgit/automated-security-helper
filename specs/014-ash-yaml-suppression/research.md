# Research: .ash.yaml Read Service & Suppression Matching

**Branch**: `014-ash-yaml-suppression` | **Date**: 2026-03-19

## R-001: ASH CLI Config File Search Order

**Decision**: Search 6 filenames in 2 locations (12 total candidates), first match wins.

**Rationale**: The ASH CLI (`core/constants.py:26-33`) defines `ASH_CONFIG_FILE_NAMES` as:
```
.ash.yml, .ash.yaml, .ash.json, ash.yml, ash.yaml, ash.json
```
For each filename, it checks `source_dir/{filename}` then `source_dir/.ash/{filename}`.
This means the full priority order is:
1. `{root}/.ash.yml`
2. `{root}/.ash.yaml`
3. `{root}/.ash.json`
4. `{root}/ash.yml`
5. `{root}/ash.yaml`
6. `{root}/ash.json`
7. `{root}/.ash/.ash.yml`
8. `{root}/.ash/.ash.yaml`
9. `{root}/.ash/.ash.json`
10. `{root}/.ash/ash.yml`
11. `{root}/.ash/ash.yaml`
12. `{root}/.ash/ash.json`

**Note**: The spec (FR-001) only listed dot-prefixed filenames. The plan must include the non-dot-prefixed variants (`ash.yml`, `ash.yaml`, `ash.json`) for CLI parity.

**Alternatives considered**: Hardcode only `.ash.yaml` — rejected for CLI parity (SC-006).

## R-002: Suppression Matching Algorithm

**Decision**: Replicate the 4-step algorithm from `suppression_matcher.py`.

**Rationale**: The CLI's `should_suppress_finding()` (lines 107-141) iterates suppressions:
1. **Expiration check** — parse `YYYY-MM-DD`, skip if `< today()`; invalid dates → skip + warn
2. **Rule ID match** — `fnmatch.fnmatch(finding.rule_id, suppression.rule_id)`; if `rule_id` is None on suppression, matches all; if None on finding, returns False
3. **File path match** — exact equality first (optimization), then `fnmatch.fnmatch()`; None finding path → False
4. **Line range overlap** — four sub-cases:
   - Both `line_start` and `line_end` None → always matches
   - Finding has no line info but suppression requires it → False
   - Only `line_start` specified → `finding.line_start >= suppression.line_start`
   - Only `line_end` specified → `finding_end <= suppression.line_end`
   - Both specified → overlap: `finding_start <= suppression.line_end AND finding_end >= suppression.line_start`

First matching suppression wins (short-circuit on match).

**Alternatives considered**: Simplified matching (exact string only) — rejected for CLI parity.

## R-003: Glob Matching Library (picomatch)

**Decision**: Use `picomatch` for fnmatch-style glob matching.

**Rationale**: picomatch is the most widely used glob matcher in the Node.js ecosystem (used by micromatch, chokidar, fast-glob). It supports all fnmatch patterns: `*`, `?`, `[seq]`, `[!seq]`, `**`. It compiles patterns to RegExp for reuse, which benefits batch matching (compile once, test many findings). Zero dependencies.

**Alternatives considered**:
- `minimatch` — heavier, more features than needed
- `micromatch` — wrapper around picomatch, unnecessary indirection
- Manual RegExp conversion — error-prone, no benefit

## R-004: YAML Parsing Library (js-yaml)

**Decision**: Use `js-yaml` for YAML parsing.

**Rationale**: js-yaml is the de facto YAML parser for Node.js. `yaml` (v2) is an alternative but js-yaml is lighter and sufficient for reading config files. Use `yaml.load()` with `DEFAULT_SCHEMA` (no custom tags) to avoid executing arbitrary constructors.

**Alternatives considered**:
- `yaml` (v2) — more features (round-trip, comments), heavier, not needed for read-only
- Built-in JSON.parse for .json files — yes, use this for `.json` format; js-yaml only for `.yml`/`.yaml`

## R-005: File System Watcher Pattern

**Decision**: Use `vscode.workspace.createFileSystemWatcher` with `RelativePattern` scoped to the scan root, plus a 200ms debounce timer.

**Rationale**: VS Code's built-in file watcher integrates with the editor's file watching infrastructure and is lifecycle-managed via disposables. A `RelativePattern` scoped to the scan root avoids watching the entire workspace. The debounce prevents thrashing during rapid saves (auto-save, format-on-save).

**Pattern**:
- Create watchers for glob patterns covering all 6 config filenames in root and `.ash/` subdirectory
- On create/change/delete → reset debounce timer → re-parse after 200ms
- After re-parse → fire `onDidChangeConfig` EventEmitter
- Dispose watchers when scan root changes or extension deactivates

**Alternatives considered**:
- `fs.watch` / `chokidar` — external dependency, no VS Code lifecycle integration
- Polling — wasteful, delayed detection

## R-006: ScanRootService Integration

**Decision**: Subscribe to `vscode.workspace.onDidChangeConfiguration` for `ashWorkbench.scanRoot` changes, same as existing pattern in extension.ts.

**Rationale**: The existing extension.ts (lines 143-153) already listens for scan root changes and calls `scanRootService.refresh()` plus cascading UI updates. The AshYamlService will be added to this same listener block. When the scan root changes:
1. Get new root from `scanRootService.getEffectiveScanRoot()`
2. Dispose old file watchers
3. Create new file watchers for new root
4. Re-discover and re-parse config from new root
5. Fire change event

**Alternatives considered**: Have ScanRootService emit its own event — rejected because the existing pattern is simpler (central listener in extension.ts).

## R-007: Service Pattern for AshYamlService

**Decision**: Domain service with constructor injection, EventEmitter for change notifications, disposable file watchers.

**Rationale**: Following the existing pattern (ScanRootService for simple state, FindingsService for data access):
- Constructor takes `scanRoot: string` (initial scan root)
- Exposes `getConfig(): AshYamlConfig` (synchronous, returns cached state)
- Exposes `matchesSuppression(finding): AshSuppression | null`
- Exposes `getMatchingSuppressions(findings): Map<string, AshSuppression>`
- Exposes `onDidChangeConfig: vscode.Event<AshYamlConfig>` for downstream subscribers
- Has `setScanRoot(newRoot: string)` to handle root changes
- Has `dispose()` to clean up watchers and timers

**Alternatives considered**: Static utility service (like AdminService) — rejected because the service needs mutable state (cached config, file watchers, debounce timer).

## R-008: Case Sensitivity in Glob Matching

**Decision**: Use case-sensitive matching (picomatch default), matching Python's `fnmatch.fnmatch()` behavior on case-sensitive filesystems.

**Rationale**: Python's `fnmatch.fnmatch()` is case-sensitive on Linux and case-insensitive on Windows/macOS. Since ASH primarily targets Linux CI environments and the SARIF paths from the CLI are case-preserved, case-sensitive matching is the safest default. picomatch's default is case-sensitive, matching the Linux behavior. This may differ from macOS filesystem behavior but aligns with CLI parity for the primary deployment target.

**Alternatives considered**: OS-dependent case sensitivity — adds complexity, marginal benefit for the VS Code extension use case.
