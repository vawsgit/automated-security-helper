# Research: Scanner Service

**Feature**: 004-scanner-service
**Date**: 2026-03-16

---

## Decision 1: ASH CLI Invocation Pattern

**Decision**: Spawn ASH CLI as a child process with explicit flags: `ash --source-dir <abs-path> --output-dir <temp-dir> --output-formats sarif --color false --progress`

**Rationale**: The ASH CLI (Python/Typer) is already installed separately by users. It accepts these documented flags: `--source-dir` for scan target, `--output-dir` for output location, `--output-formats sarif` (note: plural) for SARIF 2.1.0 output, `--color false` to suppress ANSI codes, and `--progress` for progress output on stdout.

**Alternatives considered**:
- Direct Python API call: Not viable — ASH is a CLI tool, not a library
- Docker-based execution: Supported via `--mode container` but optional (configurable via `ashWorkbench.ashMode` setting)

## Decision 2: SpawnFn Dependency Injection

**Decision**: Accept a `SpawnFn` type as a constructor parameter for testability, defaulting to `child_process.spawn`.

**Rationale**: sinon cannot stub `child_process.spawn` under Node16 module resolution (frozen ESM modules). The existing smoke test at `vsix/src/test/unit/scanner-mock.smoke.test.ts` already validates this pattern using EventEmitter-based mock ChildProcess objects.

**Alternatives considered**:
- proxyquire/rewire: Adds tooling complexity and fragile module interception
- Integration tests with real ASH: Too slow, requires ASH installation, non-deterministic

## Decision 3: Exit Code Handling

**Decision**: Map exit codes as: 0 = clean (no findings), 1 = error, 2 = findings found. Both 0 and 2 are "successful" exits that produce SARIF output.

**Rationale**: This matches the ASH CLI's documented behavior. Exit code 2 is not an error — it indicates the scanner completed successfully and found security issues. The SARIF file at `<outputDir>/reports/ash.sarif` is produced for both exit codes 0 and 2.

**Alternatives considered**: None — this is the CLI's documented contract.

## Decision 4: SARIF Pipeline Integration

**Decision**: Use the existing `parseSarif(sarifJson: SarifLog, sourceDir: string): ParsedFinding[]` from `vsix/src/services/sarif.ts` (Spec 002). Read the SARIF file from `<outputDir>/reports/ash.sarif`, JSON.parse it, then pass to `parseSarif()`.

**Rationale**: The SARIF parser already handles deduplication, severity extraction, file path normalization, and produces typed `ParsedFinding[]` records ready for database storage.

**Alternatives considered**:
- Re-parse SARIF in the scanner service: Violates DRY, duplicates Spec 002 work
- Stream parsing for large files: YAGNI — SARIF files are typically <10MB even with thousands of findings

## Decision 5: Configuration Settings

**Decision**: Add VS Code configuration settings via `package.json` `contributes.configuration`:
- `ashWorkbench.ashPath` (string, default `"ash"`) — path to ASH CLI executable
- `ashWorkbench.ashMode` (enum: `"local"` | `"container"`, default `"local"`) — ASH execution mode
- `ashWorkbench.scanTimeout` (number, default `600`) — scan timeout in seconds

**Rationale**: No `contributes.configuration` section exists in `package.json` yet. These settings are required by FR-014 and must be declared as contribution points per Constitution Principle I.

**Alternatives considered**:
- Hardcode defaults without settings: Violates FR-014 and Constitution I (settings must use VS Code APIs)
- Environment variables: Not idiomatic for VS Code extensions

## Decision 6: Temporary Directory Management

**Decision**: Create temp directories via `fs.mkdtemp()` under `os.tmpdir()` with prefix `ash-scan-`. Clean up in a `finally` block after scan completion, failure, or cancellation.

**Rationale**: `os.tmpdir()` is the standard Node.js approach. Using `fs.mkdtemp()` ensures unique directories. Cleanup in `finally` guarantees removal regardless of outcome (FR-009).

**Alternatives considered**:
- Use extension storage path: Would accumulate scan artifacts on disk; temp is more appropriate
- Leave cleanup to OS: Orphaned directories waste disk space and violate SC-007

## Decision 7: Stale Scan Recovery

**Decision**: On scanner service initialization, query for any scans with `status: RUNNING` for the current project. Mark each as `FAILED` with `errorMessage: "Scan interrupted: VS Code was closed while this scan was running."`.

**Rationale**: If VS Code crashes or force-quits, the child process is killed but the database record stays RUNNING. This blocks the single-scan constraint (FR-010). Recovery at initialization (FR-017) unblocks users without manual intervention.

**Alternatives considered**:
- Ignore stale scans: Leaves users permanently blocked
- Auto-retry stale scans: Over-complex; the user should decide when to re-scan

## Decision 8: Severity Breakdown Computation

**Decision**: After parsing findings, compute a severity breakdown as `Record<Severity, number>` counting findings per severity level. Store as JSON on the Scan record.

**Rationale**: The Prisma schema already has `severityBreakdown Json?` on the Scan model. Computing at scan completion avoids expensive re-aggregation on read. FR-016 requires this explicitly.

**Alternatives considered**:
- Compute on-read from findings: Expensive for scans with many findings
- Store as separate columns: Inflexible if severity levels change

## Decision 9: Progress Reporting Pattern

**Decision**: Accept an optional `onProgress` callback of type `(status: ScanProgress) => void` where `ScanProgress = { elapsed: number; statusText: string }`. The scanner service calls this on a 1-second interval timer while the scan runs.

**Rationale**: FR-013 requires elapsed time and status text. A callback pattern decouples the scanner from any specific UI (WebView, status bar, notifications). The consumer (extension.ts or a future command handler) decides how to display it.

**Alternatives considered**:
- VS Code `Progress` API directly: Couples the service to VS Code; harder to test
- EventEmitter: More infrastructure for a single event type; callback is simpler
