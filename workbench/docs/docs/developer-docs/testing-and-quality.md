---
title: Testing and Quality
sidebar_position: 3
---

# Testing and Quality

Quality tooling for the VS Code extension (`vsix/`): formatting, linting, TypeScript strictness, and a split test infrastructure with unit tests in plain Node.js and integration tests in VS Code Electron.

## Quick Reference

All commands run from `workbench/vsix/`:

```bash
npm run compile       # TypeScript compile (strict mode)
npm run lint          # ESLint with recommended preset
npm run format        # Auto-format all TypeScript files
npm run format:check  # Check formatting without modifying files
npm run test:unit     # Fast unit tests (Mocha in Node.js, ~1-2s)
npm run test:integration  # Extension tests (VS Code Electron, ~15s)
npm run test          # Both: test:unit then test:integration
```

## Formatting

**Prettier** handles all code formatting. Configuration is in `vsix/.prettierrc`:

| Setting | Value | Rationale |
|---------|-------|-----------|
| `semi` | `true` | Explicit semicolons |
| `singleQuote` | `true` | VS Code ecosystem convention |
| `trailingComma` | `"all"` | Cleaner diffs |
| `printWidth` | `100` | Wider than default 80 for readability |
| `tabWidth` | `2` | Standard TypeScript |

`vsix/.prettierignore` excludes `out/`, `node_modules/`, `*.vsix`, and `prisma/migrations/`.

**Usage:** Run `npm run format` to auto-fix. CI and pre-commit checks should use `npm run format:check` (exits non-zero on unformatted files).

## Linting

ESLint uses `typescript-eslint`'s `recommended` preset, which includes ~40 rules that catch real bugs (unused variables, unreachable code, unsafe `any` usage, etc.). Configuration is in `vsix/eslint.config.mjs`.

### Rule severity

All project-specific rules are set to `error` (not `warn`), so `npm run lint` fails on violations:

- `curly` -- Require curly braces for all control statements
- `eqeqeq` -- Require `===` and `!==`
- `no-throw-literal` -- Only throw `Error` objects

The `@typescript-eslint/naming-convention` rule is `warn` only (import names must be camelCase or PascalCase).

### Test file relaxations

Files under `src/test/**/*.ts` have these rules disabled:

- `@typescript-eslint/no-non-null-assertion` -- Tests often assert on known-good data
- `@typescript-eslint/no-explicit-any` -- Mock objects frequently need `any`
- `@typescript-eslint/no-require-imports` -- Some test patterns need `require()`

### Prettier integration

`eslint-config-prettier` is included as the last config entry to disable all formatting-related ESLint rules. This prevents conflicts between ESLint and Prettier.

## TypeScript Strictness

`vsix/tsconfig.json` enables strict mode plus additional checks:

| Check | What it catches |
|-------|-----------------|
| `strict` | All base strict checks (noImplicitAny, strictNullChecks, etc.) |
| `noImplicitReturns` | Functions that don't return in all code paths |
| `noFallthroughCasesInSwitch` | Missing `break` in switch cases |
| `noUnusedParameters` | Unused function parameters (prefix with `_` to suppress) |
| `noUnusedLocals` | Unused local variables |
| `skipLibCheck` | Skips type-checking `.d.ts` in node_modules (required for PGLite's WASM/browser types) |

## Test Architecture

### Two runtimes, two runners

VS Code extension testing has a fundamental split:

```mermaid
graph LR
    subgraph "Unit Tests (fast)"
        M[Mocha in Node.js]
        M --> SF[SARIF parser tests]
        M --> DB[PGLite database tests]
        M --> SC[Scanner service tests]
    end

    subgraph "Integration Tests (slow)"
        VT["@vscode/test-electron"]
        VT --> EX[Extension activation]
        VT --> CM[Command registration]
        VT --> PR[Provider tests]
    end
```

| Runtime | What it tests | Speed | Runner | Config |
|---------|---------------|-------|--------|--------|
| **Node.js** | Pure logic: parsers, database, utilities | ~1-2s | `mocha` | `vsix/.mocharc.yaml` |
| **VS Code Electron** | Anything using `vscode.*` APIs | ~15s | `vscode-test` | `vsix/.vscode-test.mjs` |

Unit tests run 10-100x faster because they skip downloading and launching VS Code. Always prefer unit tests when the module under test doesn't import `vscode`.

### Directory structure

```
vsix/src/test/
  unit/                            # Plain Node.js tests (npm run test:unit)
    sarif-factory.smoke.test.ts    # SARIF factory validation
    pglite.smoke.test.ts           # PGLite WASM validation
    scanner-mock.smoke.test.ts     # sinon + spawn mock validation
  integration/                     # VS Code Electron tests (npm run test:integration)
    extension.test.ts              # Extension activation test
  fixtures/
    sarif-factory.ts               # SARIF test data builders
```

### Configuration files

**`.mocharc.yaml`** -- Unit test runner:

```yaml
spec: "out/test/unit/**/*.test.js"
timeout: 10000
recursive: true
```

The 10s timeout accommodates PGLite WASM initialization (~500ms on first run).

**`.vscode-test.mjs`** -- Integration test runner:

```javascript
import { defineConfig } from '@vscode/test-cli';

export default defineConfig({
  files: 'out/test/integration/**/*.test.js',
});
```

## Writing Unit Tests

### Assertion library

Use `node:assert/strict` (zero dependencies, strict equality by default):

```typescript
import assert from 'node:assert/strict';

assert.equal(actual, expected);           // strict equality
assert.deepEqual(obj1, obj2);            // deep structural equality
assert.ok(value);                         // truthy check
assert.throws(() => fn(), /pattern/);     // error matching
assert.rejects(asyncFn(), /pattern/);     // async error matching
```

### SARIF test data factory

`vsix/src/test/fixtures/sarif-factory.ts` provides builder functions for generating SARIF 2.1.0 structures. Use these instead of hand-writing JSON fixtures.

**Available functions:**

| Function | Returns | Use case |
|----------|---------|----------|
| `createSarifResult(overrides?)` | `SarifResult` | Single finding with sensible defaults |
| `createSarifRun(results, toolName?)` | `SarifRun` | One scanner's results |
| `createSarifLog(runs)` | `SarifLog` | Complete SARIF document with multiple runs |
| `createSingleRunSarif(results, toolName?)` | `SarifLog` | Shorthand: one log, one run |

**Example:**

```typescript
import { createSarifResult, createSingleRunSarif } from '../fixtures/sarif-factory';

it('parses multi-severity findings', () => {
  const sarif = createSingleRunSarif([
    createSarifResult({ ruleId: 'B101', level: 'error' }),
    createSarifResult({ ruleId: 'B102', level: 'warning' }),
    createSarifResult({
      ruleId: 'B103',
      level: 'note',
      properties: { severity: 'CRITICAL' },  // ASH severity override
    }),
  ], 'bandit');

  const findings = parseSarif(sarif, '/project');
  // ... assertions
});
```

Defaults produce a result with `ruleId: 'test-rule-001'`, `level: 'warning'`, file `file:///project/src/app.ts`, lines 10-15.

### Mocking with sinon

sinon is available for stubs, spies, and fakes. Always call `sinon.restore()` in `afterEach`:

```typescript
import sinon from 'sinon';

afterEach(() => {
  sinon.restore();
});
```

### Mocking `child_process.spawn`

`child_process.spawn` is non-configurable under Node16 modules -- sinon cannot stub it directly. The scanner service uses **dependency injection** instead: it accepts a `SpawnFn` parameter that tests can replace with a sinon stub.

**Pattern for creating a mock child process:**

```typescript
import { EventEmitter } from 'node:events';
import type { ChildProcess } from 'node:child_process';

function createMockProcess(): ChildProcess {
  const proc = new EventEmitter() as any;
  proc.stdout = new EventEmitter();
  proc.stderr = new EventEmitter();
  proc.kill = sinon.stub().returns(true);
  proc.pid = 12345;
  proc.stdin = null;
  proc.stdio = [null, proc.stdout, proc.stderr];
  return proc as ChildProcess;
}
```

**Simulating process lifecycle:**

```typescript
const mockProcess = createMockProcess();
const spawnStub = sinon.stub().returns(mockProcess);

// Trigger events to simulate ASH CLI behavior:
mockProcess.stdout.emit('data', Buffer.from('Scanning...'));
mockProcess.emit('exit', 0, null);   // clean scan
mockProcess.emit('exit', 2, null);   // findings detected
mockProcess.emit('exit', 1, null);   // error
```

### PGLite in tests

PGLite is ESM-only. In the CommonJS test context, use dynamic `import()` in a `before()` hook:

```typescript
let PGlite: any;

before(async () => {
  const mod = await import('@electric-sql/pglite');
  PGlite = mod.PGlite;
});
```

Create in-memory instances for test isolation (no filesystem persistence, no cleanup needed):

```typescript
const db = new PGlite();          // in-memory
await db.exec('CREATE TABLE ...');
await db.query('SELECT ...');
await db.close();                  // data is gone
```

## Writing Integration Tests

Integration tests run inside a real VS Code instance and can use the full `vscode.*` API. They use Mocha's TDD interface (`suite`/`test`) rather than BDD (`describe`/`it`):

```typescript
import * as assert from 'assert';
import * as vscode from 'vscode';

suite('Extension Test Suite', () => {
  test('extension activates', async () => {
    const ext = vscode.extensions.getExtension('ash-workbench');
    assert.ok(ext);
    await ext.activate();
    assert.strictEqual(ext.isActive, true);
  });
});
```

Integration tests are slow (~15s startup) because `@vscode/test-electron` downloads and launches VS Code. Use them only for behavior that requires the VS Code runtime.

## Extending / Maintaining

### Adding a new unit test file

1. Create `vsix/src/test/unit/<name>.test.ts`
2. Use `describe`/`it` (BDD) syntax with `node:assert/strict`
3. Run `npm run compile && npm run test:unit` to verify
4. The `.mocharc.yaml` glob (`out/test/unit/**/*.test.js`) picks it up automatically

### Adding a new integration test file

1. Create `vsix/src/test/integration/<name>.test.ts`
2. Use `suite`/`test` (TDD) syntax -- the VS Code test runner expects this
3. Run `npm run compile && npm run test:integration` to verify
4. The `.vscode-test.mjs` glob (`out/test/integration/**/*.test.js`) picks it up automatically

### Adding test fixtures

Place shared test data builders in `vsix/src/test/fixtures/`. Follow the factory function pattern established by `sarif-factory.ts`:

- Export a `createXxx(overrides?)` function that returns a fully-formed object with sensible defaults
- Accept `Partial<T>` overrides spread onto the defaults
- Keep fixtures stateless -- no side effects, no shared mutable state

### Keeping ESLint rules in sync

When adding new test patterns that clash with ESLint, add targeted overrides in the test file block of `vsix/eslint.config.mjs` rather than disabling rules inline with `// eslint-disable`. This keeps relaxations visible in one place.

### Key files

| File | Purpose |
|------|---------|
| `vsix/package.json` | npm scripts, devDependencies |
| `vsix/tsconfig.json` | TypeScript compiler strictness |
| `vsix/eslint.config.mjs` | ESLint rules and test overrides |
| `vsix/.prettierrc` | Formatting rules |
| `vsix/.prettierignore` | Files excluded from formatting |
| `vsix/.mocharc.yaml` | Unit test runner config |
| `vsix/.vscode-test.mjs` | Integration test runner config |
| `vsix/src/test/fixtures/` | Shared test data builders |
