# Implementation Plan: Scanner Service

**Feature**: 004-scanner-service
**Branch**: `004-scanner-service`
**Date**: 2026-03-16
**Spec**: [spec.md](spec.md)

---

## Summary

Implement the scanner service that spawns the ASH CLI as a child process, monitors its lifecycle, parses SARIF output using the existing parser (Spec 002), and stores findings in the database (Spec 001). Includes scan target management, cancellation, timeout handling, progress reporting, single-scan constraint enforcement, error handling for all failure modes, and stale scan recovery on activation.

## Technical Context

| Aspect | Detail |
|--------|--------|
| Runtime | Node.js (VS Code extension host), TypeScript strict mode, ES2022, Node16 modules |
| VS Code APIs | `workspace.getConfiguration()`, `child_process.spawn`, `fs.mkdtemp()`, `os.tmpdir()` |
| Database | PGLite + Prisma ORM via `DatabaseService` static singleton (Spec 001) |
| ORM operations | `db.scanTarget.upsert()`, `db.scan.create()`, `db.scan.update()`, `db.finding.createMany()`, `db.scan.updateMany()` |
| SARIF Parser | `parseSarif(sarifJson, sourceDir): ParsedFinding[]` from `vsix/src/services/sarif.ts` (Spec 002) |
| Process Mocking | SpawnFn dependency injection, sinon stubs, EventEmitter-based mock ChildProcess |
| Testing | Mocha + `node:assert/strict` + sinon for unit tests; PGLite in-memory for database isolation |
| Existing code | `DatabaseService`, `ensureProject()`, `parseSarif()`, `ScannerService` smoke test |
| Dependencies | Spec 001 (Database Layer), Spec 002 (SARIF Parser), Spec 003 (Project Lifecycle) |

## Constitution Check

| Principle | Status | Notes |
|-----------|--------|-------|
| I. VS Code Native | PASS | ASH CLI spawned as local child process (not remote). Settings via `contributes.configuration` in `package.json`. Temp dirs under `os.tmpdir()`. No network calls. |
| II. Extension Host Owns State | PASS | All scan logic in `vsix/src/services/scanner.ts`. No WebView involvement. |
| III. Ship Fast / Simplicity First | PASS | Single `ScannerService` class with 3 methods. No abstractions beyond what's needed. Callback for progress (not EventEmitter). |
| IV. Typed Contracts at Boundaries | PASS | `SpawnFn` type for process injection. `StartScanParams` and `ScanResult` typed interfaces. `ParsedFinding[]` from SARIF parser. Prisma typed queries. |
| V. Theme Integration | N/A | No UI changes in this spec. |
| VI. Security by Default | PASS | No command injection: `spawn()` with args array (not shell string). No user input passed unsanitized. Temp dirs have unique names via `mkdtemp()`. |

## Project Structure

### Documentation (this feature)

```text
specs/004-scanner-service/
├── spec.md
├── plan.md              # This file
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── scanner-service.md
└── checklists/
    └── requirements.md
```

### Source Code

```text
vsix/
├── package.json                             # MODIFY: add contributes.configuration
├── src/
│   ├── extension.ts                         # MODIFY: instantiate ScannerService, call recoverStaleScans()
│   ├── services/
│   │   ├── database.ts                      # EXISTING (Spec 001)
│   │   ├── project.ts                       # EXISTING (Spec 003)
│   │   ├── sarif.ts                         # EXISTING (Spec 002)
│   │   └── scanner.ts                       # CREATE: ScannerService class
│   └── test/
│       └── unit/
│           ├── scanner-mock.smoke.test.ts   # EXISTING: SpawnFn smoke tests
│           └── scanner.test.ts              # CREATE: ScannerService unit tests
```

**Structure Decision**: One new service file (`scanner.ts`), one new test file (`scanner.test.ts`), and modifications to `package.json` and `extension.ts`. No new directories needed.

## Implementation Phases

### Phase A: VS Code Configuration

**Goal**: Declare scanner settings in `package.json` so they are available via `vscode.workspace.getConfiguration()`.

1. Modify `vsix/package.json`:
   - Add `contributes.configuration` section with:
     - `ashWorkbench.ashPath` (string, default `"ash"`)
     - `ashWorkbench.ashMode` (enum: `local` | `container`, default `"local"`)
     - `ashWorkbench.scanTimeout` (number, default `600`, minimum `30`)

### Phase B: Scanner Service Core

**Goal**: Implement `ScannerService` class with `startScan()`, `cancelScan()`, and `recoverStaleScans()`.

1. Create `vsix/src/services/scanner.ts`:
   - Define `SpawnFn` type (matching `child_process.spawn` signature)
   - Define `ScanProgress` interface (`{ elapsed: number; statusText: string }`)
   - Define `StartScanParams` interface (`{ targetPath: string; severityThreshold?: string }`)
   - Define `ScanResult` interface (scanId, status, findingsCount, severityBreakdown, errorMessage)
   - Implement `ScannerService` class:
     - Constructor: `(db: PrismaClient, projectId: string, spawnFn?: SpawnFn)`
     - Private state: `currentScanId`, `currentProcess`, `progressTimer`, `timeoutTimer`

2. Implement `startScan()`:
   - Check single-scan constraint: query for RUNNING scans, reject if found (FR-010)
   - Find or create ScanTarget: `db.scanTarget.upsert()` with `path` and `displayName` from `path.basename()` (FR-011)
   - Create Scan record: `db.scan.create()` with `status: RUNNING` (FR-001)
   - Read config: `vscode.workspace.getConfiguration('ashWorkbench')` for ashPath, ashMode, scanTimeout (FR-014)
   - Create temp dir: `fs.mkdtemp(path.join(os.tmpdir(), 'ash-scan-'))` (FR-009)
   - Build args array: `['--source-dir', targetPath, '--output-dir', tempDir, '--output-formats', 'sarif', '--color', 'false', '--progress']` (FR-002)
   - If mode is container: add `'--mode', 'container'`
   - Spawn process via `spawnFn(ashPath, args)` (FR-002, FR-015)
   - Set up progress interval timer calling `onProgress` every 1 second (FR-013)
   - Set up timeout timer: `setTimeout()` per scanTimeout, kills process on expiry (FR-012)
   - Collect stderr chunks for error reporting
   - Handle `error` event on process (ENOENT → FR-007)
   - Handle `exit` event:
     - Exit 0/2: Read `<tempDir>/reports/ash.sarif`, `JSON.parse()`, `parseSarif()`, `db.finding.createMany()`, compute severity breakdown, update scan to COMPLETED (FR-003, FR-004, FR-005, FR-016)
     - Exit 1: Update scan to FAILED with stderr (FR-006)
   - Finally: clean up temp dir, clear timers (FR-009)

3. Implement `cancelScan()`:
   - If no current process or scanId doesn't match: return silently (FR-008)
   - Call `process.kill('SIGTERM')` (FR-008)
   - Update scan to CANCELLED (FR-008)
   - Clean up temp dir (FR-009)

4. Implement `recoverStaleScans()`:
   - Query: `db.scan.updateMany({ where: { projectId, status: 'RUNNING' }, data: { status: 'FAILED', errorMessage: '...', completedAt: new Date() } })` (FR-017)
   - Return count of updated records

### Phase C: Extension Integration

**Goal**: Wire ScannerService into the activation flow.

1. Modify `vsix/src/extension.ts`:
   - Import `ScannerService`
   - After `ensureProject()`: create `ScannerService` instance with `db`, `project.id`
   - Call `scanner.recoverStaleScans()` (FR-017)
   - Store reference for command handlers to access

### Phase D: Unit Tests

**Goal**: Test all scanner behaviors with mocked child process and in-memory PGLite.

Test file: `vsix/src/test/unit/scanner.test.ts`

**US1 tests** (execute a scan):
- Successful scan (exit 2) creates Scan and Finding records with correct counts
- Clean scan (exit 0) creates Scan with COMPLETED status and zero findings
- Scan creates ScanTarget on first run for a path

**US2 tests** (cancel a scan):
- Cancel sends SIGTERM and marks scan CANCELLED
- Cancel with no running scan does nothing (no error)

**US3 tests** (error handling):
- Failed scan (exit 1) marks FAILED with stderr as error message
- ENOENT error produces user-friendly install message
- Timeout kills process and marks FAILED with timeout message

**US4 tests** (scan target management):
- Same path scanned twice reuses existing ScanTarget (only 1 record)

**US6 tests** (single-scan constraint):
- Starting a second scan while one is running is rejected

**US5 tests** (progress — P2):
- Progress callback is called during scan execution with elapsed time

**Edge case tests**:
- Missing SARIF file after exit 0/2 marks scan as FAILED
- Stale scan recovery marks RUNNING scans as FAILED

### Phase E: Polish

**Goal**: Compile clean, lint clean, all tests pass.

1. `npm run compile` — zero TypeScript errors
2. `npm run lint` — zero ESLint errors in new/modified files
3. `npm run test:unit` — all tests pass (existing + new)
4. Verify temp directory cleanup (no orphaned dirs)

## Artifacts Generated

| Artifact | Path |
|----------|------|
| Research | `specs/004-scanner-service/research.md` |
| Data Model | `specs/004-scanner-service/data-model.md` |
| Contract | `specs/004-scanner-service/contracts/scanner-service.md` |
| Quickstart | `specs/004-scanner-service/quickstart.md` |
| Plan | `specs/004-scanner-service/plan.md` (this file) |

## Risks

| Risk | Mitigation |
|------|------------|
| `vscode.workspace.getConfiguration()` not available in unit tests (no VS Code runtime) | Pass config values as parameters or use a config-reading helper that can be stubbed in tests. |
| SARIF file may not exist at expected path after exit 0 (clean scan, no results to write) | Handle missing file gracefully: if exit 0 and no SARIF file, treat as zero findings. |
| `fs.mkdtemp()` failure due to permissions or disk space | Catch and mark scan as FAILED with clear error about temp directory creation. |
| Large SARIF files (10,000+ findings) may cause memory pressure during `JSON.parse()` | Acceptable per spec (SC-005 requires 1,000 findings with zero data loss). Monitor for edge cases. |
| Process.kill('SIGTERM') may not immediately terminate ASH CLI (Python) | Follow up with SIGKILL after a short grace period if process doesn't exit. |
| PGLite `createMany` performance with many findings | Batch in chunks if needed. Prisma's `createMany` handles this efficiently for PostgreSQL. |
