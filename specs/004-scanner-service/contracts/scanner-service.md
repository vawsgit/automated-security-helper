# Contract: Scanner Service

**Feature**: 004-scanner-service
**Date**: 2026-03-16

---

## Module

`vsix/src/services/scanner.ts`

## Types

```typescript
type SpawnFn = (
  command: string,
  args: string[],
  options?: SpawnOptionsWithoutStdio,
) => ChildProcess;

interface ScanProgress {
  elapsed: number;      // seconds since scan started
  statusText: string;   // human-readable status (e.g., "Scanning...")
}

interface StartScanParams {
  targetPath: string;           // absolute path to folder to scan
  severityThreshold?: string;   // minimum severity, default "LOW"
}

interface ScanResult {
  scanId: string;
  status: 'COMPLETED' | 'FAILED' | 'CANCELLED';
  findingsCount: number;
  severityBreakdown: Record<string, number> | null;
  errorMessage: string | null;
}
```

## Class: ScannerService

### Constructor

```typescript
constructor(
  db: PrismaClient,
  projectId: string,
  spawnFn?: SpawnFn,  // defaults to child_process.spawn
)
```

### Methods

#### `startScan(params: StartScanParams, onProgress?: (progress: ScanProgress) => void): Promise<ScanResult>`

Initiates a security scan on the given folder.

**Preconditions**:
- No scan with `status: RUNNING` exists for this project (FR-010)

**Behavior**:
1. Check single-scan constraint — reject with error if a RUNNING scan exists
2. Find or create ScanTarget for `targetPath` (FR-011)
3. Create Scan record with `status: RUNNING` (FR-001)
4. Read `ashWorkbench.ashPath` and `ashWorkbench.ashMode` from VS Code settings (FR-014)
5. Create temp output directory via `fs.mkdtemp()` (FR-009)
6. Spawn ASH CLI child process (FR-002):
   - Command: configured ash path
   - Args: `--source-dir <targetPath> --output-dir <tempDir> --output-formats sarif --color false --progress`
   - If mode is "container": add `--mode container`
7. Start progress timer (1-second interval), calling `onProgress` (FR-013)
8. Start timeout timer per `ashWorkbench.scanTimeout` setting (FR-012)
9. Wait for process exit:
   - **Exit 0**: Read SARIF, parse (expect empty results), store findings, mark COMPLETED (FR-003, FR-005)
   - **Exit 2**: Read SARIF from `<tempDir>/reports/ash.sarif`, parse via `parseSarif()`, store findings, compute severity breakdown, mark COMPLETED (FR-003, FR-004, FR-005, FR-016)
   - **Exit 1**: Capture stderr, mark FAILED with error message (FR-006)
   - **ENOENT error**: Mark FAILED, return user-friendly install message (FR-007)
   - **Timeout**: Kill process, mark FAILED with timeout message (FR-012)
10. Clean up temp directory (FR-009)

**Postconditions**:
- Scan record exists with terminal status
- If COMPLETED: findings stored, findingsCount and severityBreakdown populated
- Temp directory removed

**Error cases**:
- Scan already running → throws/rejects with "A scan is already in progress"
- ASH not installed (ENOENT) → Scan marked FAILED, errorMessage includes install instructions
- Scanner error (exit 1) → Scan marked FAILED, errorMessage from stderr
- Timeout exceeded → Process killed, Scan marked FAILED, errorMessage "Scan timed out"
- SARIF file missing after exit 0/2 → Scan marked FAILED
- Database write failure → Scan marked FAILED with DB error message

#### `cancelScan(scanId: string): Promise<void>`

Cancels a running scan.

**Preconditions**:
- Scan with given ID exists and has `status: RUNNING`

**Behavior**:
1. If no scan is running or scanId doesn't match: return silently (no error)
2. Send SIGTERM to the scanner child process (FR-008)
3. Update Scan record to `status: CANCELLED` (FR-008)
4. Clean up temp directory (FR-009)
5. Stop progress and timeout timers

**Postconditions**:
- Scanner process terminated
- Scan record has `status: CANCELLED`
- Temp directory removed

#### `recoverStaleScans(): Promise<number>`

Recovers from stale RUNNING scans left by crashes. Called once during initialization.

**Behavior**:
1. Query all scans for this project where `status: RUNNING` (FR-017)
2. Update each to `status: FAILED` with `errorMessage: "Scan interrupted: VS Code was closed while this scan was running."`
3. Return count of recovered scans

**Postconditions**:
- No RUNNING scans exist for this project
- Single-scan constraint is unblocked

## VS Code Configuration (package.json)

```json
{
  "contributes": {
    "configuration": {
      "title": "ASH Workbench",
      "properties": {
        "ashWorkbench.ashPath": {
          "type": "string",
          "default": "ash",
          "description": "Path to the ASH CLI executable"
        },
        "ashWorkbench.ashMode": {
          "type": "string",
          "enum": ["local", "container"],
          "default": "local",
          "description": "ASH execution mode (local or container)"
        },
        "ashWorkbench.scanTimeout": {
          "type": "number",
          "default": 600,
          "minimum": 30,
          "description": "Scan timeout in seconds"
        }
      }
    }
  }
}
```
