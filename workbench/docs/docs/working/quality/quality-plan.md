---
title: quality-plan
---

# Quality Tooling Implementation Plan

Set up formatting, linting, and test infrastructure for the ASH Workbench VS Code extension (`vsix/`). Includes a POC spike to validate PGLite and scanner service test patterns before application code is written.

## 1. Executive Summary

- **Objective:** Establish quality tooling (Prettier, ESLint recommended, TypeScript strict checks, split test infrastructure) so all future application code benefits from day one.
- **Architecture:** Two test runtimes -- fast unit tests in plain Node.js (Mocha), slow extension tests in VS Code Electron (`@vscode/test-electron`). Separate npm scripts, separate configs.
- **Key decisions:**
  - Prettier for formatting (with `eslint-config-prettier` to avoid conflicts)
  - `tseslint.configs.recommended` preset replaces the current 5-rule ESLint config
  - Mocha as the unit test runner (ecosystem standard, already scaffolded)
  - sinon for mocking (installed now, used in Phase 1.5)
  - SARIF test data via factory functions (not JSON fixtures)
- **Phase 1.5 spike:** Minimal PGLite + Prisma test and mocked scanner service test to prove the libraries install and execute in a VS Code extension context.

## 2. What Will Be Done

- Add Prettier with project config, npm scripts, and `eslint-config-prettier`
- Upgrade ESLint from 5 custom rules to `tseslint.configs.recommended` with rules at `error` level
- Enable TypeScript additional strict checks
- Create split test directory structure (`test/unit/`, `test/integration/`, `test/fixtures/`)
- Add `.mocharc.yaml` for standalone unit test runner
- Update `.vscode-test.mjs` to only find integration tests
- Add `test:unit` and `test:integration` npm scripts
- Move existing extension test to `test/integration/`
- Install sinon, `@types/sinon` as dev dependencies
- Create SARIF test data factory (`test/fixtures/sarif-factory.ts`)
- **Phase 1.5:** Create minimal PGLite smoke test (prove WASM init + raw SQL works)
- **Phase 1.5:** Create minimal scanner service smoke test (prove sinon + spawn mocking works)

## 3. What Will NOT Be Done

- No CI/CD GitHub Actions workflow (deferred per user decision)
- No pre-commit hooks (lint-staged, husky)
- No code coverage tooling (c8)
- No full SARIF parser tests (those require the parser module which doesn't exist yet)
- No full database integration tests with Prisma (Phase 1.5 only validates raw PGLite)
- No WebView quality tooling (webview package doesn't exist yet)
- No application code changes -- this is purely infrastructure

## 4. Files to Modify

```
vsix/
  package.json                    # MODIFY - scripts, devDependencies
  tsconfig.json                   # MODIFY - enable additional checks
  eslint.config.mjs               # MODIFY - replace with recommended preset
  .prettierrc                     # CREATE - Prettier config
  .prettierignore                 # CREATE - exclude build output
  .mocharc.yaml                   # CREATE - unit test runner config
  .vscode-test.mjs                # MODIFY - narrow to integration tests only
  src/
    test/
      extension.test.ts           # DELETE (moved to integration/)
      unit/
        sarif-factory.smoke.test.ts    # CREATE - validates factory compiles and runs
        pglite.smoke.test.ts           # CREATE - Phase 1.5: PGLite WASM smoke test
        scanner-mock.smoke.test.ts     # CREATE - Phase 1.5: sinon + spawn mock smoke test
      integration/
        extension.test.ts              # MOVE from test/extension.test.ts
      fixtures/
        sarif-factory.ts               # CREATE - SARIF test data builder
```

## 5. Implementation Phases

### Phase 1: Quality Tooling Setup

All steps in this phase modify configuration files and create test infrastructure. No application code is written or changed.

#### Step 1: TypeScript Strict Checks

Enable the commented-out compiler checks in `vsix/tsconfig.json`.

**Modify `vsix/tsconfig.json`:**

```json
{
  "compilerOptions": {
    "module": "Node16",
    "target": "ES2022",
    "outDir": "out",
    "lib": ["ES2022"],
    "sourceMap": true,
    "rootDir": "src",
    "strict": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "noUnusedParameters": true,
    "noUnusedLocals": true
  }
}
```

**Verify:** `npm run compile` still succeeds. The existing `extension.ts` has no violations (confirmed by reading it -- no unused vars, no missing returns, no switch statements).

#### Step 2: Add Prettier

Install Prettier and the ESLint conflict resolver.

**Commands:**

```bash
cd vsix
npm install --save-dev prettier eslint-config-prettier
```

**Create `vsix/.prettierrc`:**

```json
{
  "semi": true,
  "singleQuote": true,
  "trailingComma": "all",
  "printWidth": 100,
  "tabWidth": 2
}
```

**Create `vsix/.prettierignore`:**

```
out/
node_modules/
*.vsix
prisma/migrations/
```

**Update `vsix/package.json` scripts** (shown in Step 5 with all script changes).

**Verify:** `npx prettier --check "src/**/*.ts"` reports files. `npx prettier --write "src/**/*.ts"` formats them. Run once to format existing code.

#### Step 3: Upgrade ESLint

Replace the minimal config with `tseslint.configs.recommended`, add `eslint-config-prettier`, upgrade rules to `error`.

**Replace `vsix/eslint.config.mjs`:**

```javascript
import tseslint from 'typescript-eslint';
import prettierConfig from 'eslint-config-prettier';

export default tseslint.config(
  {
    files: ['src/**/*.ts'],
    extends: [
      ...tseslint.configs.recommended,
    ],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: 'module',
      },
    },
    rules: {
      '@typescript-eslint/naming-convention': ['warn', {
        selector: 'import',
        format: ['camelCase', 'PascalCase'],
      }],
      'curly': 'error',
      'eqeqeq': 'error',
      'no-throw-literal': 'error',
    },
  },
  {
    files: ['src/test/**/*.ts'],
    rules: {
      '@typescript-eslint/no-non-null-assertion': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-require-imports': 'off',
    },
  },
  prettierConfig,
  {
    ignores: ['out/', 'node_modules/'],
  },
);
```

**Key changes:**
- `tseslint.configs.recommended` adds ~40 rules that catch real bugs
- `prettierConfig` disables formatting rules that conflict with Prettier
- `semi` rule removed (Prettier handles it)
- Test files get relaxed rules for `any`, non-null assertions, and `require()` (needed for sinon module mocking)
- All custom rules upgraded from `warn` to `error`

**Verify:** `npm run lint` passes on the existing `extension.ts`. Fix any violations introduced by the `recommended` preset (likely minor -- unused imports or variables).

#### Step 4: Create Test Directory Structure

Reorganize tests into `unit/` and `integration/` directories.

**Actions:**
1. Create directories: `src/test/unit/`, `src/test/integration/`, `src/test/fixtures/`
2. Move `src/test/extension.test.ts` to `src/test/integration/extension.test.ts`
3. Update the import paths in the moved file if needed (they're absolute `vscode` imports, so no change needed)

#### Step 5: Configure Split Test Runners

**Create `vsix/.mocharc.yaml`:**

```yaml
spec: "out/test/unit/**/*.test.js"
timeout: 10000
recursive: true
```

Timeout is 10s to accommodate PGLite WASM initialization in Phase 1.5 smoke tests.

**Modify `vsix/.vscode-test.mjs`:**

```javascript
import { defineConfig } from '@vscode/test-cli';

export default defineConfig({
  files: 'out/test/integration/**/*.test.js',
});
```

Changed from `out/test/**/*.test.js` to `out/test/integration/**/*.test.js` so the VS Code electron runner only picks up integration tests.

**Update `vsix/package.json` scripts and devDependencies:**

```json
{
  "scripts": {
    "vscode:prepublish": "npm run compile",
    "compile": "tsc -p ./",
    "watch": "tsc -watch -p ./",
    "pretest": "npm run compile && npm run lint",
    "lint": "eslint src",
    "format": "prettier --write \"src/**/*.ts\"",
    "format:check": "prettier --check \"src/**/*.ts\"",
    "test": "npm run test:unit && npm run test:integration",
    "test:unit": "mocha",
    "test:integration": "vscode-test"
  },
  "devDependencies": {
    "@types/vscode": "^1.110.0",
    "@types/mocha": "^10.0.10",
    "@types/node": "22.x",
    "@types/sinon": "^17.0.0",
    "typescript-eslint": "^8.56.1",
    "eslint": "^9.39.3",
    "eslint-config-prettier": "^10.0.0",
    "prettier": "^3.5.0",
    "sinon": "^19.0.0",
    "typescript": "^5.9.3",
    "@vscode/test-cli": "^0.0.12",
    "@vscode/test-electron": "^2.5.2"
  }
}
```

**Changes:**
- Added `format`, `format:check` scripts
- Split `test` into `test:unit` (Mocha) + `test:integration` (vscode-test)
- Added devDependencies: `prettier`, `eslint-config-prettier`, `sinon`, `@types/sinon`

#### Step 6: Create SARIF Test Data Factory

**Create `vsix/src/test/fixtures/sarif-factory.ts`:**

```typescript
/**
 * Factory functions for generating SARIF 2.1.0 test data.
 * Used by unit tests to create realistic SARIF structures
 * without depending on real ASH CLI output.
 */

export interface SarifResult {
  ruleId: string;
  level: 'error' | 'warning' | 'note' | 'none';
  message: { text: string };
  locations: Array<{
    physicalLocation: {
      artifactLocation: { uri: string };
      region?: {
        startLine: number;
        endLine?: number;
        snippet?: { text: string };
      };
    };
  }>;
  properties?: Record<string, unknown>;
}

export interface SarifRun {
  tool: {
    driver: {
      name: string;
      rules: Array<{ id: string; shortDescription?: { text: string } }>;
    };
  };
  results: SarifResult[];
}

export interface SarifLog {
  version: '2.1.0';
  $schema?: string;
  runs: SarifRun[];
}

export function createSarifResult(
  overrides?: Partial<SarifResult>,
): SarifResult {
  return {
    ruleId: 'test-rule-001',
    level: 'warning',
    message: { text: 'Test finding description' },
    locations: [
      {
        physicalLocation: {
          artifactLocation: { uri: 'file:///project/src/app.ts' },
          region: { startLine: 10, endLine: 15 },
        },
      },
    ],
    ...overrides,
  };
}

export function createSarifRun(
  results: SarifResult[],
  toolName = 'test-scanner',
): SarifRun {
  return {
    tool: {
      driver: {
        name: toolName,
        rules: results.map((r) => ({
          id: r.ruleId,
          shortDescription: { text: r.message.text },
        })),
      },
    },
    results,
  };
}

export function createSarifLog(runs: SarifRun[]): SarifLog {
  return {
    version: '2.1.0',
    $schema:
      'https://raw.githubusercontent.com/oasis-tcs/sarif-spec/main/sarif-2.1/schema/sarif-schema-2.1.0.json',
    runs,
  };
}

/** Create a complete SARIF log with one run containing the given results. */
export function createSingleRunSarif(
  results: SarifResult[],
  toolName = 'test-scanner',
): SarifLog {
  return createSarifLog([createSarifRun(results, toolName)]);
}
```

**Create `vsix/src/test/unit/sarif-factory.smoke.test.ts`:**

A minimal test that proves the factory compiles and produces valid structures:

```typescript
import assert from 'node:assert/strict';
import {
  createSarifResult,
  createSingleRunSarif,
} from '../fixtures/sarif-factory';

describe('SARIF Factory (smoke test)', () => {
  it('creates a valid SARIF result with defaults', () => {
    const result = createSarifResult();
    assert.equal(result.ruleId, 'test-rule-001');
    assert.equal(result.level, 'warning');
    assert.equal(result.locations.length, 1);
  });

  it('creates a valid SARIF log with one run', () => {
    const sarif = createSingleRunSarif([
      createSarifResult({ ruleId: 'R001' }),
      createSarifResult({ ruleId: 'R002', level: 'error' }),
    ]);
    assert.equal(sarif.version, '2.1.0');
    assert.equal(sarif.runs.length, 1);
    assert.equal(sarif.runs[0].results.length, 2);
    assert.equal(sarif.runs[0].tool.driver.name, 'test-scanner');
  });

  it('accepts overrides for all fields', () => {
    const result = createSarifResult({
      ruleId: 'custom-rule',
      level: 'error',
      properties: { severity: 'CRITICAL' },
    });
    assert.equal(result.ruleId, 'custom-rule');
    assert.equal(result.level, 'error');
    assert.equal(result.properties?.severity, 'CRITICAL');
  });
});
```

**Verify:** `npm run compile && npm run test:unit` runs and all 3 tests pass.

### Phase 1.5: Technology Validation Spike

Minimal smoke tests that prove PGLite and sinon/spawn mocking work in this project context. These are NOT full test suites -- they are "does the library even work here?" validations.

#### Step 7: PGLite Smoke Test

Install PGLite and create a minimal test that initializes the WASM engine and runs raw SQL.

**Commands:**

```bash
cd vsix
npm install --save-dev @electric-sql/pglite
```

Note: PGLite is installed as a devDependency for now (test-only). It moves to a regular dependency when the database service is built.

**Create `vsix/src/test/unit/pglite.smoke.test.ts`:**

```typescript
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';

describe('PGLite smoke test', () => {
  let db: PGlite;

  before(async () => {
    db = new PGlite(); // in-memory, no persistence
  });

  after(async () => {
    await db.close();
  });

  it('initializes WASM engine without error', () => {
    assert.ok(db, 'PGlite instance should exist');
  });

  it('executes CREATE TABLE and INSERT', async () => {
    await db.exec(`
      CREATE TABLE IF NOT EXISTS test_table (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await db.exec(
      `INSERT INTO test_table (name) VALUES ('smoke-test')`,
    );

    const result = await db.query<{ name: string }>(
      'SELECT name FROM test_table WHERE name = $1',
      ['smoke-test'],
    );

    assert.equal(result.rows.length, 1);
    assert.equal(result.rows[0].name, 'smoke-test');
  });

  it('supports JSON columns (PostgreSQL feature)', async () => {
    await db.exec(`
      CREATE TABLE IF NOT EXISTS json_test (
        id SERIAL PRIMARY KEY,
        data JSONB NOT NULL
      )
    `);

    await db.query(
      `INSERT INTO json_test (data) VALUES ($1::jsonb)`,
      [JSON.stringify({ severity: 'HIGH', count: 5 })],
    );

    const result = await db.query<{ data: { severity: string } }>(
      "SELECT data FROM json_test WHERE data->>'severity' = 'HIGH'",
    );

    assert.equal(result.rows.length, 1);
  });

  it('works in in-memory mode (no filesystem artifacts)', async () => {
    const ephemeral = new PGlite();
    await ephemeral.exec('CREATE TABLE ephemeral_test (id INT)');
    await ephemeral.exec('INSERT INTO ephemeral_test VALUES (1)');
    const result = await ephemeral.query(
      'SELECT * FROM ephemeral_test',
    );
    assert.equal(result.rows.length, 1);
    await ephemeral.close();
  });
});
```

**What this validates:**
- PGLite WASM binary loads correctly in Node.js (not just browser)
- In-memory mode works (no filesystem persistence needed for tests)
- Basic SQL operations work (CREATE, INSERT, SELECT with parameters)
- JSONB columns work (critical -- the Prisma schema uses `Json?` fields for `severityBreakdown`)
- Multiple PGLite instances can coexist (needed for test isolation)

**Verify:** `npm run compile && npm run test:unit` -- the PGLite tests pass. Note the first run may be slower (~1-2s) due to WASM compilation.

#### Step 8: Scanner Mock Smoke Test

Create a minimal test that proves sinon can mock `child_process.spawn` and simulate process lifecycle events.

**Create `vsix/src/test/unit/scanner-mock.smoke.test.ts`:**

```typescript
import assert from 'node:assert/strict';
import sinon from 'sinon';
import { EventEmitter } from 'node:events';
import * as childProcess from 'node:child_process';

describe('Scanner mock smoke test', () => {
  afterEach(() => {
    sinon.restore();
  });

  it('sinon can stub child_process.spawn', () => {
    const mockProcess = new EventEmitter() as any;
    mockProcess.stdout = new EventEmitter();
    mockProcess.stderr = new EventEmitter();
    mockProcess.kill = sinon.stub().returns(true);
    mockProcess.pid = 12345;

    const spawnStub = sinon
      .stub(childProcess, 'spawn')
      .returns(mockProcess);

    const proc = childProcess.spawn('ash', ['--source-dir', '/test']);

    assert.ok(spawnStub.calledOnce, 'spawn should be called');
    assert.deepEqual(spawnStub.firstCall.args[0], 'ash');
    assert.deepEqual(spawnStub.firstCall.args[1], [
      '--source-dir',
      '/test',
    ]);
    assert.equal(proc.pid, 12345);
  });

  it('can simulate process exit with code 0 (clean scan)', (done) => {
    const mockProcess = new EventEmitter() as any;
    mockProcess.stdout = new EventEmitter();
    mockProcess.stderr = new EventEmitter();

    sinon.stub(childProcess, 'spawn').returns(mockProcess);

    const proc = childProcess.spawn('ash', []);

    proc.on('exit', (code: number) => {
      assert.equal(code, 0);
      done();
    });

    mockProcess.emit('exit', 0, null);
  });

  it('can simulate process exit with code 2 (findings detected)', (done) => {
    const mockProcess = new EventEmitter() as any;
    mockProcess.stdout = new EventEmitter();
    mockProcess.stderr = new EventEmitter();

    sinon.stub(childProcess, 'spawn').returns(mockProcess);

    const proc = childProcess.spawn('ash', []);

    proc.on('exit', (code: number) => {
      assert.equal(code, 2);
      done();
    });

    mockProcess.emit('exit', 2, null);
  });

  it('can simulate stdout data events (progress output)', (done) => {
    const mockProcess = new EventEmitter() as any;
    mockProcess.stdout = new EventEmitter();
    mockProcess.stderr = new EventEmitter();

    sinon.stub(childProcess, 'spawn').returns(mockProcess);

    const proc = childProcess.spawn('ash', []);
    const chunks: string[] = [];

    proc.stdout.on('data', (data: Buffer) => {
      chunks.push(data.toString());
    });

    proc.on('exit', () => {
      assert.equal(chunks.length, 2);
      assert.ok(chunks[0].includes('Scanning'));
      done();
    });

    mockProcess.stdout.emit('data', Buffer.from('Scanning source...'));
    mockProcess.stdout.emit('data', Buffer.from('Running bandit...'));
    mockProcess.emit('exit', 0, null);
  });

  it('can simulate SIGTERM kill (cancel scan)', () => {
    const mockProcess = new EventEmitter() as any;
    mockProcess.stdout = new EventEmitter();
    mockProcess.stderr = new EventEmitter();
    mockProcess.kill = sinon.stub().returns(true);

    sinon.stub(childProcess, 'spawn').returns(mockProcess);

    const proc = childProcess.spawn('ash', []);
    const killed = proc.kill('SIGTERM');

    assert.ok(killed);
    assert.ok(
      (proc.kill as sinon.SinonStub).calledWith('SIGTERM'),
    );
  });
});
```

**What this validates:**
- sinon can successfully stub `child_process.spawn` in this project's module/compilation setup
- EventEmitter-based mock processes work for simulating ASH CLI lifecycle
- Exit code handling (0, 2) can be tested
- stdout/stderr data events can be simulated
- Process kill (SIGTERM for cancel) can be tested
- The `afterEach` + `sinon.restore()` pattern works for test isolation

**Verify:** `npm run compile && npm run test:unit` -- all scanner mock tests pass.

## 6. KISS Opportunities

### Skip `.editorconfig`

The quality guidance mentions an EditorConfig file. Prettier already handles all formatting concerns. One fewer config file.

### Use `node:assert/strict` Instead of Chai

Zero-dependency, adequate for the test volume in this project. Revisit only if assertion debugging becomes painful.

### PGLite as devDependency for Now

PGLite is only needed for smoke tests in Phase 1.5. It becomes a real dependency when the database service is built. Keeps the production dependency list clean.

## 7. Testing Strategy

| Phase | Tests | Runner | What They Prove |
|-------|-------|--------|-----------------|
| Phase 1, Step 6 | SARIF factory smoke (3 tests) | Mocha (Node.js) | Factory compiles, produces valid structures |
| Phase 1.5, Step 7 | PGLite smoke (4 tests) | Mocha (Node.js) | WASM loads, SQL works, JSONB works, in-memory isolation |
| Phase 1.5, Step 8 | Scanner mock smoke (5 tests) | Mocha (Node.js) | sinon stubs spawn, exit codes, stdout streams, kill works |
| Existing | Extension sample test (1 test) | vscode-test (Electron) | Extension test infrastructure still works after reorg |

**Total: 13 tests across 4 files.**

After all steps, `npm test` executes both `test:unit` (12 tests, ~2-3s) and `test:integration` (1 test, ~10-15s).

## 8. Verification Checklist

After implementation, all of these must pass:

```bash
# TypeScript compiles cleanly with strict checks
npm run compile

# ESLint passes with recommended preset
npm run lint

# Prettier reports no unformatted files
npm run format:check

# Unit tests pass (SARIF factory + PGLite + scanner mock)
npm run test:unit

# Extension integration test still passes
npm run test:integration

# Full test suite
npm test
```
