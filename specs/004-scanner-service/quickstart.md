# Quickstart: Scanner Service

**Feature**: 004-scanner-service
**Date**: 2026-03-16

---

## Integration Scenarios

### Scenario 1: Successful Scan with Findings (Exit Code 2)

```typescript
// In extension.ts activate(), after project initialization:
const scanner = new ScannerService(db, project.id);
await scanner.recoverStaleScans();

// When user triggers a scan (e.g., from command or context menu):
const result = await scanner.startScan(
  { targetPath: '/home/user/my-project/src' },
  (progress) => {
    console.log(`[${progress.elapsed}s] ${progress.statusText}`);
  },
);

// result = {
//   scanId: "uuid-...",
//   status: "COMPLETED",
//   findingsCount: 12,
//   severityBreakdown: { CRITICAL: 0, HIGH: 3, MEDIUM: 5, LOW: 4, INFO: 0 },
//   errorMessage: null,
// }
```

### Scenario 2: Clean Scan (Exit Code 0)

```typescript
const result = await scanner.startScan({ targetPath: '/home/user/clean-project' });

// result = {
//   scanId: "uuid-...",
//   status: "COMPLETED",
//   findingsCount: 0,
//   severityBreakdown: { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0, INFO: 0 },
//   errorMessage: null,
// }
```

### Scenario 3: Cancel a Running Scan

```typescript
// Start scan (non-blocking — start returns a promise)
const scanPromise = scanner.startScan({ targetPath: '/home/user/big-project' });

// Later, cancel it
await scanner.cancelScan(currentScanId);

// The scanPromise resolves with:
// { scanId: "uuid-...", status: "CANCELLED", findingsCount: 0, ... }
```

### Scenario 4: ASH Not Installed

```typescript
const result = await scanner.startScan({ targetPath: '/home/user/project' });

// result = {
//   scanId: "uuid-...",
//   status: "FAILED",
//   findingsCount: 0,
//   severityBreakdown: null,
//   errorMessage: "ASH CLI not found. Install it with: pip install ash-cli ...",
// }
```

### Scenario 5: Scan Already Running (Rejection)

```typescript
// First scan is running
const scan1 = scanner.startScan({ targetPath: '/path/a' });

// Second attempt is rejected
try {
  await scanner.startScan({ targetPath: '/path/b' });
} catch (err) {
  // Error: "A scan is already in progress for this project."
}
```

### Scenario 6: Stale Scan Recovery on Activation

```typescript
// During extension activation, after creating ScannerService:
const recovered = await scanner.recoverStaleScans();
if (recovered > 0) {
  console.log(`[ASH] Recovered ${recovered} stale scan(s) from previous session`);
}
// Any RUNNING scans from a crashed session are now FAILED,
// and the user can start a new scan immediately.
```

## Unit Test Pattern

Tests use the SpawnFn injection pattern with sinon stubs and EventEmitter-based mock processes:

```typescript
import sinon from 'sinon';
import { EventEmitter } from 'node:events';
import { DatabaseService } from '../../services/database';

function createMockProcess() {
  const proc = new EventEmitter() as any;
  proc.stdout = new EventEmitter();
  proc.stderr = new EventEmitter();
  proc.kill = sinon.stub().returns(true);
  proc.pid = 12345;
  proc.stdin = null;
  proc.stdio = [null, proc.stdout, proc.stderr];
  return proc;
}

describe('ScannerService', () => {
  let db: PrismaClient;
  let spawnStub: sinon.SinonStub;

  before(async () => {
    db = await DatabaseService.initialize(); // in-memory PGLite
  });

  beforeEach(() => {
    spawnStub = sinon.stub();
  });

  afterEach(() => sinon.restore());
  after(async () => DatabaseService.close());

  it('stores findings on exit code 2', async () => {
    const mockProc = createMockProcess();
    spawnStub.returns(mockProc);

    const scanner = new ScannerService(db, projectId, spawnStub);
    const resultPromise = scanner.startScan({ targetPath: '/test' });

    // Simulate scanner completing with findings
    mockProc.emit('exit', 2, null);

    const result = await resultPromise;
    assert.equal(result.status, 'COMPLETED');
    assert.ok(result.findingsCount > 0);
  });
});
```
