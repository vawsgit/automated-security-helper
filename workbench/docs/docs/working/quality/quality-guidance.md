---
title: Quality Guidance - ASH Workbench
---

# Quality Guidance: Formatting, Linting, and Testing

Comprehensive quality guidance for the ASH Workbench VS Code extension. This document examines best practices for formatting, linting, and testing at every level (unit, integration, e2e), then recommends what to implement and in what order -- prioritized for a single-developer POC that needs fast feedback without heavyweight infrastructure.

**Scope:** The `vsix/` extension host package (TypeScript/Node.js). The `webview/` React package is not yet created; guidance for its quality tooling is noted separately where relevant.

---

## 1. Current State

### 1.1 What Exists

The project was scaffolded from the VS Code Extension Generator (`yo code`). Quality tooling is minimal:

| Tool | Config | State |
|------|--------|-------|
| **TypeScript** | `vsix/tsconfig.json` | Strict mode ON. Additional checks (`noImplicitReturns`, `noFallthroughCasesInSwitch`, `noUnusedParameters`) commented out. |
| **ESLint** | `vsix/eslint.config.mjs` | Flat config, `typescript-eslint` parser. Only 5 rules: naming-convention, curly, eqeqeq, no-throw-literal, semi. All set to `warn`. |
| **Test runner** | `@vscode/test-cli` + `@vscode/test-electron` | Tests run inside a real VS Code electron instance. Configured in `.vscode-test.mjs` to find `out/test/**/*.test.js`. |
| **Test file** | `vsix/src/test/extension.test.ts` | Boilerplate sample test (Mocha `suite`/`test` syntax, `assert`). |
| **Formatter** | None | No Prettier, no EditorConfig, no formatting tool. |
| **Pre-commit hooks** | None (workbench level) | Parent ASH project has `.pre-commit-config.yaml` with Ruff + JSON formatting, but nothing for TypeScript. |
| **CI/CD** | None (workbench level) | Parent ASH has GitHub Actions for Python tests. No workflow for the workbench extension. |

### 1.2 Parent ASH Project Patterns

The parent repository establishes quality conventions worth aligning with:

- **Pre-commit hooks** (`.pre-commit-config.yaml`): Ruff lint/format, JSON formatting, schema generation
- **Test markers** (`pytest.ini`): `unit`, `integration`, `slow`, `scanner`, `reporter`, `config`, `model`
- **Coverage gates** (`.coveragerc`): 60% minimum coverage threshold
- **CI matrix** (`ash-repo-unit-tests.yml`): Multi-OS (Linux/macOS/Windows), multi-version, JUnit XML + coverage reporting
- **Test fixture factories** (`tests/utils/mock_factories.py`): SARIF report factories for creating test data programmatically

---

## 2. Formatting

### 2.1 The Case for Prettier

The project currently has **no formatter**. This means formatting varies by editor settings and developer habits. For a single-developer POC this is tolerable, but formatting inconsistency becomes an issue as soon as Claude Code or any AI tool generates code -- each generation may produce subtly different formatting.

**Prettier** is the standard TypeScript/JavaScript formatter. It is opinionated by design: minimal configuration, deterministic output. Unlike ESLint's formatting rules (which require extensive config and produce ambiguous results), Prettier produces one canonical output.

### 2.2 Recommended Configuration

**Install:**

```bash
cd vsix
npm install --save-dev prettier
```

**Config file (`vsix/.prettierrc`):**

```json
{
  "semi": true,
  "singleQuote": true,
  "trailingComma": "all",
  "printWidth": 100,
  "tabWidth": 2
}
```

These settings align with the existing ESLint `semi: "warn"` rule and common VS Code extension conventions. `singleQuote: true` is the dominant convention in the VS Code extension ecosystem (VS Code's own source uses single quotes).

**Ignore file (`vsix/.prettierignore`):**

```
out/
node_modules/
*.vsix
prisma/migrations/
```

**NPM scripts:**

```json
{
  "format": "prettier --write \"src/**/*.ts\"",
  "format:check": "prettier --check \"src/**/*.ts\""
}
```

### 2.3 ESLint + Prettier Interaction

With Prettier handling formatting, remove formatting rules from ESLint to avoid conflicts. The `semi` rule in the current ESLint config overlaps with Prettier. After adding Prettier:

1. Remove `semi: "warn"` from `eslint.config.mjs` (Prettier handles it)
2. Optionally add `eslint-config-prettier` to disable all formatting-related ESLint rules:

```bash
npm install --save-dev eslint-config-prettier
```

```javascript
// eslint.config.mjs
import prettierConfig from 'eslint-config-prettier';

export default [
  // ... existing config
  prettierConfig,
];
```

### 2.4 EditorConfig

An `.editorconfig` file ensures consistent whitespace across editors and tools:

```ini
# vsix/.editorconfig
root = true

[*]
indent_style = space
indent_size = 2
end_of_line = lf
charset = utf-8
trim_trailing_whitespace = true
insert_final_newline = true
```

### 2.5 Value Assessment

| Item | Effort | Value | Verdict |
|------|--------|-------|---------|
| Prettier | 15 min setup | High -- eliminates all formatting noise in diffs and AI-generated code | **Implement immediately** |
| EditorConfig | 5 min | Low -- Prettier covers most cases | Nice to have |
| `eslint-config-prettier` | 5 min | Medium -- prevents conflicting rules | Include with Prettier |

---

## 3. Linting

### 3.1 Current ESLint Gap Analysis

The existing ESLint config (`vsix/eslint.config.mjs:1-27`) is minimal. It uses `typescript-eslint` as parser but does NOT extend any recommended preset. The 5 configured rules are all set to `warn` (not `error`), meaning ESLint never causes a non-zero exit code -- `npm run lint` always passes.

**Critical gaps:**

| What's Missing | Impact |
|----------------|--------|
| No `recommended` preset | Misses 40+ rules that catch real bugs (unused vars, unreachable code, etc.) |
| All rules are `warn` | Lint never fails, no enforcement |
| No `@typescript-eslint/recommended` | Misses type-aware rules (`no-floating-promises`, `no-misused-promises`, etc.) |
| No `import` rules | No detection of circular imports, missing imports, import ordering |
| No `test` file handling | Test files should be allowed different patterns (e.g., non-null assertions in tests) |

### 3.2 Recommended ESLint Configuration

Upgrade to use typescript-eslint's recommended presets. This is the single highest-value linting change -- the `recommended` and `recommended-type-checked` presets catch real bugs that TypeScript's compiler misses.

```javascript
// vsix/eslint.config.mjs
import tseslint from 'typescript-eslint';

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
      // Project-specific rules (on top of recommended)
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
    // Relaxed rules for test files
    files: ['src/test/**/*.ts'],
    rules: {
      '@typescript-eslint/no-non-null-assertion': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
  {
    ignores: ['out/', 'node_modules/'],
  },
);
```

**Key changes from current config:**

1. **`tseslint.configs.recommended`** -- Adds `no-unused-vars`, `no-explicit-any`, `no-non-null-assertion`, `no-require-imports`, and ~40 more rules
2. **Rules upgraded from `warn` to `error`** -- Lint now fails on violations (enforces quality)
3. **Test file overrides** -- Allows common test patterns (non-null assertions, `any` for mocks)
4. **Proper `ignores`** -- Excludes compiled output

### 3.3 Type-Checked Rules (Future Enhancement)

The `recommended-type-checked` preset adds rules that require type information (slower but catches more bugs):

```javascript
extends: [
  ...tseslint.configs.recommendedTypeChecked,
],
languageOptions: {
  parserOptions: {
    projectService: true,
    tsconfigRootDir: import.meta.dirname,
  },
},
```

Notable type-checked rules:

| Rule | What It Catches |
|------|-----------------|
| `@typescript-eslint/no-floating-promises` | Promises without `await` or `.catch()` -- critical for async VS Code APIs |
| `@typescript-eslint/no-misused-promises` | Passing async functions where sync callbacks are expected |
| `@typescript-eslint/await-thenable` | `await` on non-Promise values |
| `@typescript-eslint/no-unnecessary-type-assertion` | Redundant type casts |

`no-floating-promises` is particularly valuable for VS Code extensions where forgotten `await` on `vscode.window.showXxx()` or `vscode.commands.executeCommand()` causes silent failures.

**Tradeoff:** Type-checked rules make ESLint ~3-5x slower (requires full TypeScript project analysis). For a small codebase this is negligible. Recommend adding in Phase 2 once the codebase has async services.

### 3.4 TypeScript Compiler Strictness

The commented-out checks in `vsix/tsconfig.json:13-15` should be enabled:

```json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "noUnusedParameters": true,
    "noUnusedLocals": true
  }
}
```

| Check | What It Catches | Risk |
|-------|-----------------|------|
| `noImplicitReturns` | Functions that don't return in all code paths | None -- pure correctness |
| `noFallthroughCasesInSwitch` | Missing `break` in switch cases (the SARIF parser uses switch for severity mapping) | None -- pure correctness |
| `noUnusedParameters` | Unused function parameters | Low -- prefix with `_` to suppress |
| `noUnusedLocals` | Unused local variables | Low -- just delete them |

### 3.5 Value Assessment

| Item | Effort | Value | Verdict |
|------|--------|-------|---------|
| `tseslint.configs.recommended` | 30 min (fix violations) | Very High -- catches real bugs | **Implement immediately** |
| Rules to `error` instead of `warn` | 5 min | High -- actually enforces | **Implement immediately** |
| TypeScript additional checks | 10 min | High -- zero runtime cost | **Implement immediately** |
| Type-checked rules | 1 hr | High -- catches async bugs | Implement in Phase 2 |
| Import ordering rules | 15 min | Low -- cosmetic | Optional |

---

## 4. Testing Strategy

### 4.1 The Two Test Runtimes Problem

VS Code extension testing has a fundamental split that most web development doesn't:

| Runtime | What It Tests | Speed | Setup |
|---------|---------------|-------|-------|
| **Node.js (plain)** | Pure logic: parsers, data transforms, utilities, database queries | Fast (ms) | None -- just run Mocha/vitest |
| **VS Code Electron** | Anything touching `vscode.*` APIs: commands, providers, webview, settings | Slow (5-15s startup) | Requires `@vscode/test-electron` to download and launch VS Code |

The current scaffold runs ALL tests through `@vscode/test-electron` (via `@vscode/test-cli`). This means even a trivial SARIF parser test takes 5-15 seconds to start because it launches an entire VS Code instance.

**Best practice: Separate test suites by runtime requirement.**

```
vsix/
  src/
    test/                    # Extension integration tests (need vscode)
      extension.test.ts      # Tests that use vscode.* APIs
    services/
      __tests__/             # Unit tests (pure Node.js)
        sarif.test.ts
        database.test.ts
```

Or, more commonly for VS Code extensions:

```
vsix/
  src/
    test/
      unit/                  # Run with plain Mocha in Node.js
        sarif.test.ts
        database.test.ts
      integration/           # Run with @vscode/test-electron
        extension.test.ts
        commands.test.ts
```

### 4.2 Unit Testing Framework Choice

**Mocha** is the VS Code extension ecosystem standard. The generator scaffolds it. `@vscode/test-cli` assumes Mocha. The VS Code documentation uses Mocha exclusively.

**Vitest** is the modern alternative -- faster, better DX, native ESM, built-in coverage, watch mode. However, it has friction with VS Code extensions:
- `@vscode/test-cli` doesn't support vitest
- The `vscode` module import requires special handling in vitest
- Less ecosystem documentation for VS Code + vitest

**Recommendation: Mocha for extension tests, and also for unit tests** -- for consistency and because the scaffolding already exists. If the WebView package (`webview/`) uses Vite, vitest is the natural choice there.

### 4.3 Assertion Library

The scaffold uses Node.js built-in `assert`. This works but produces poor error messages:

```typescript
// Built-in assert -- cryptic failure message
assert.strictEqual(findings.length, 3);
// AssertionError: Expected values to be strictly equal: 5 !== 3

// chai -- readable failure message
expect(findings).to.have.length(3);
// AssertionError: expected [ Array(5) ] to have a length of 3 but got 5
```

**Options:**

| Library | Pros | Cons |
|---------|------|------|
| `assert` (built-in) | Zero dependencies, always available | Poor error messages, verbose API |
| `chai` | Rich assertions, readable messages, widely used | Extra dependency |
| `node:assert/strict` (Node 16+) | No dependency, stricter defaults | Same poor messages as `assert` |

**Recommendation:** Use `node:assert/strict` for now (zero dependencies, matches Node16 target). Switch to `chai` if assertion quality becomes a friction point. The SARIF parser tests will benefit from `deepStrictEqual` for comparing complex objects.

### 4.4 Mocking

The technical design specifies `sinon` for the scanner service tests (mocking child process spawn). **Sinon** is the standard Mocha companion for mocking.

**What needs mocking in this project:**

| Module | What to Mock | Why |
|--------|--------------|-----|
| `child_process.spawn` | Scanner service tests | Don't actually run ASH CLI |
| `vscode.*` APIs | Command handler tests, providers | Not available in Node.js runtime |
| `fs` operations | Migration runner, SARIF file reading | Deterministic test fixtures |
| `PrismaClient` | Service tests that query DB (when not using PGLite in-memory) | Isolate from database |

**For unit tests (no vscode):** `sinon` is the right choice. Stubs, spies, and fakes for Node.js APIs.

**For vscode API mocking in unit tests:** If a module imports `vscode` but you want to test it in plain Node.js, you need to mock the `vscode` module itself. Common approaches:

1. **Dependency injection** -- Pass vscode APIs as constructor parameters instead of importing directly. This is the cleanest approach and what the technical design already does (services receive `vscode.ExtensionContext` parts as parameters).

2. **Module aliasing** -- Configure the test runner to substitute a mock `vscode` module. With TypeScript path mapping:

```json
// tsconfig.test.json
{
  "compilerOptions": {
    "paths": {
      "vscode": ["./src/test/mocks/vscode.ts"]
    }
  }
}
```

**Recommendation:** Design services so core logic doesn't import `vscode` directly. The technical design already does this well -- `ScannerService`, `DatabaseService`, and the SARIF parser are all pure Node.js modules. Only providers and command handlers need `vscode` APIs.

### 4.5 Test Fixture Strategy for SARIF

SARIF parser tests are the highest-priority tests (P0 per technical design). They need realistic test data.

**Approaches:**

1. **Hand-written JSON fixtures** -- Create `.sarif` JSON files in a test fixtures directory. Full control, but tedious to write correctly.

2. **Factory functions** -- Programmatic SARIF builders (similar to the parent ASH project's `mock_factories.py`). More flexible for edge cases:

```typescript
// test/fixtures/sarif-factory.ts
function createSarifResult(overrides?: Partial<SarifResult>): SarifResult {
  return {
    ruleId: 'test-rule-001',
    level: 'warning',
    message: { text: 'Test finding description' },
    locations: [{
      physicalLocation: {
        artifactLocation: { uri: 'file:///src/app.ts' },
        region: { startLine: 10, endLine: 15 },
      },
    }],
    ...overrides,
  };
}

function createSarifReport(results: SarifResult[], toolName = 'test-scanner'): SarifLog {
  return {
    version: '2.1.0',
    $schema: 'https://raw.githubusercontent.com/oasis-tcs/sarif-spec/main/sarif-2.1/schema/sarif-schema-2.1.0.json',
    runs: [{
      tool: { driver: { name: toolName, rules: [] } },
      results,
    }],
  };
}
```

3. **Real ASH output snapshots** -- Run ASH against a known test project and save the SARIF output. Most realistic but requires ASH to be installed.

**Recommendation:** Use factory functions (approach 2) for unit tests, supplemented by 1-2 real ASH SARIF snapshots for smoke testing. The factory approach lets you easily create edge cases (empty results, multi-run, missing fields, ASH severity properties).

The parent project's `tests/utils/mock_factories.py` provides the pattern to follow.

---

## 5. Unit Tests (Node.js Runtime)

### 5.1 What to Unit Test

These modules contain pure logic that can be tested without VS Code APIs:

| Module | Key Functions | Test Priority | Rationale |
|--------|---------------|---------------|-----------|
| `services/sarif.ts` | `parseSarif()`, `extractSeverity()`, deduplication | **P0** | Correctness of finding extraction is critical to the entire extension |
| `models/types.ts` | Type definitions | **P0** (compile-time) | TypeScript compiler validates -- no runtime tests needed |
| `models/messages.ts` | Message type definitions | **P0** (compile-time) | Same -- compile-time safety |
| `services/database.ts` | Migration runner, query helpers | **P0** (integration) | See Section 6 |
| `services/scanner.ts` | Process lifecycle, output directory handling | **P1** | Mock `child_process.spawn` |

### 5.2 Test Runner Configuration

Create a separate Mocha configuration for unit tests that runs in plain Node.js (no VS Code):

**File: `vsix/.mocharc.yaml`**

```yaml
spec: "out/test/unit/**/*.test.js"
timeout: 5000
recursive: true
```

**NPM scripts update:**

```json
{
  "scripts": {
    "test:unit": "mocha",
    "test:integration": "vscode-test",
    "test": "npm run test:unit && npm run test:integration",
    "pretest": "npm run compile && npm run lint"
  }
}
```

**Dependencies:**

```bash
npm install --save-dev mocha @types/mocha
```

Note: `mocha` and `@types/mocha` are already in devDependencies. The only change is adding the `.mocharc.yaml` and the separate npm script.

### 5.3 SARIF Parser Test Examples

The technical design (`technical-design.md:1082-1109`) provides test outlines. Here they are fleshed out with the factory approach:

```typescript
// src/test/unit/sarif.test.ts
import assert from 'node:assert/strict';
import { parseSarif, extractSeverity } from '../../services/sarif';
import { createSarifResult, createSarifReport } from '../fixtures/sarif-factory';

describe('SARIF Parser', () => {

  describe('parseSarif()', () => {
    it('extracts findings from a single-run SARIF', () => {
      const sarif = createSarifReport([
        createSarifResult({ ruleId: 'bandit/B101' }),
        createSarifResult({ ruleId: 'bandit/B102' }),
      ], 'bandit');

      const findings = parseSarif(sarif, '/home/user/project');

      assert.equal(findings.length, 2);
      assert.ok(findings.every(f => f.scanner === 'bandit'));
    });

    it('extracts findings from multi-run SARIF', () => {
      const sarif = {
        version: '2.1.0' as const,
        runs: [
          {
            tool: { driver: { name: 'bandit', rules: [] } },
            results: [createSarifResult({ ruleId: 'B101' })],
          },
          {
            tool: { driver: { name: 'semgrep', rules: [] } },
            results: [createSarifResult({ ruleId: 'SG001' })],
          },
        ],
      };

      const findings = parseSarif(sarif, '/project');

      assert.equal(findings.length, 2);
      const scanners = findings.map(f => f.scanner);
      assert.ok(scanners.includes('bandit'));
      assert.ok(scanners.includes('semgrep'));
    });

    it('deduplicates findings by (ruleId, file)', () => {
      const sarif = createSarifReport([
        createSarifResult({ ruleId: 'R001' }),
        createSarifResult({ ruleId: 'R001' }), // same rule, same file
      ]);

      const findings = parseSarif(sarif, '/project');

      const keys = findings.map(f => `${f.ruleId}:${f.file}`);
      assert.equal(keys.length, new Set(keys).size);
    });

    it('makes file paths relative to source dir', () => {
      const sarif = createSarifReport([
        createSarifResult({
          locations: [{
            physicalLocation: {
              artifactLocation: { uri: 'file:///home/user/project/src/app.ts' },
              region: { startLine: 1 },
            },
          }],
        }),
      ]);

      const findings = parseSarif(sarif, '/home/user/project');

      assert.ok(findings.every(f => !f.file.startsWith('/')));
      assert.equal(findings[0].file, 'src/app.ts');
    });

    it('handles SARIF with no results gracefully', () => {
      const sarif = createSarifReport([]);
      const findings = parseSarif(sarif, '/project');
      assert.equal(findings.length, 0);
    });

    it('handles missing optional fields', () => {
      const sarif = createSarifReport([
        createSarifResult({
          locations: [{
            physicalLocation: {
              artifactLocation: { uri: 'src/app.ts' },
              // no region
            },
          }],
        }),
      ]);

      const findings = parseSarif(sarif, '/project');

      assert.equal(findings.length, 1);
      assert.equal(findings[0].startLine, 0); // or whatever the default
    });
  });

  describe('extractSeverity()', () => {
    it('uses ASH properties.severity when present', () => {
      const result = createSarifResult({
        level: 'warning',
        properties: { severity: 'CRITICAL' },
      });

      assert.equal(extractSeverity(result), 'CRITICAL');
    });

    it('falls back to SARIF level mapping', () => {
      assert.equal(
        extractSeverity(createSarifResult({ level: 'error' })),
        'HIGH',
      );
      assert.equal(
        extractSeverity(createSarifResult({ level: 'warning' })),
        'MEDIUM',
      );
      assert.equal(
        extractSeverity(createSarifResult({ level: 'note' })),
        'LOW',
      );
    });
  });
});
```

### 5.4 Scanner Service Test Examples

These tests mock `child_process.spawn` to verify process lifecycle handling:

```typescript
// src/test/unit/scanner.test.ts
import assert from 'node:assert/strict';
import sinon from 'sinon';
import { EventEmitter } from 'events';

describe('Scanner Service', () => {
  let spawnStub: sinon.SinonStub;

  beforeEach(() => {
    // Create a mock child process
    const mockProcess = new EventEmitter() as any;
    mockProcess.stdout = new EventEmitter();
    mockProcess.stderr = new EventEmitter();
    mockProcess.kill = sinon.stub();

    spawnStub = sinon.stub(require('child_process'), 'spawn')
      .returns(mockProcess);
  });

  afterEach(() => {
    sinon.restore();
  });

  it('spawns ASH with correct arguments', async () => {
    // ... verify spawn called with expected args
  });

  it('marks scan as COMPLETED on exit code 0', async () => {
    // Emit exit with code 0, verify scan status
  });

  it('marks scan as COMPLETED with findings on exit code 2', async () => {
    // Emit exit with code 2, verify SARIF parsing triggered
  });

  it('marks scan as FAILED on exit code 1', async () => {
    // Emit exit with code 1, verify error stored
  });

  it('sends SIGTERM on cancel', async () => {
    // Call cancelScan, verify kill() called
  });
});
```

### 5.5 Test Directory Structure

```
vsix/src/test/
  unit/                          # Plain Node.js tests (fast)
    sarif.test.ts                # SARIF parser tests
    scanner.test.ts              # Scanner service tests (mocked spawn)
  integration/                   # @vscode/test-electron tests (slow)
    extension.test.ts            # Extension activation, commands
  fixtures/
    sarif-factory.ts             # SARIF test data builders
    sample-findings.sarif        # Real ASH SARIF snapshot (optional)
```

---

## 6. Integration Tests (PGLite In-Memory)

### 6.1 Why PGLite Integration Tests Are High-Value

The technical design designates database tests as **P0**. This is correct because:

1. **PGLite is unproven in VS Code extensions** -- No published extensions use it. Integration tests validate the fundamental technology choice.
2. **Prisma + PGLite adapter is community-maintained** -- `prisma-pglite` could have subtle incompatibilities. Tests catch them early.
3. **Schema correctness** -- The Prisma schema defines relationships, cascades, and indexes. Integration tests validate these work with PGLite's PostgreSQL dialect.
4. **Migration reliability** -- The custom migration runner (`runMigrations()` in `database.ts`) applies raw SQL. Tests verify migrations apply cleanly.

### 6.2 PGLite In-Memory Mode

PGLite supports in-memory mode (no filesystem persistence) -- ideal for tests:

```typescript
import { PGlite } from '@electric-sql/pglite';

// In-memory -- no persistence, destroyed when process exits
const pglite = new PGlite();

// vs. persistent (used in production)
const pglite = new PGlite('/path/to/data');
```

In-memory mode means:
- Each test suite gets a fresh database
- No cleanup needed
- Fast startup (~100-200ms for WASM init)
- No filesystem artifacts

### 6.3 Database Test Structure

```typescript
// src/test/unit/database.test.ts
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import { PrismaClient } from '@prisma/client';
import { createPgliteAdapter } from 'prisma-pglite/adapter';
import { runMigrations } from '../../services/database';

describe('Database Service', () => {
  let pglite: PGlite;
  let db: PrismaClient;

  before(async () => {
    pglite = new PGlite(); // in-memory
    await runMigrations(pglite);

    const adapter = createPgliteAdapter(pglite);
    db = new PrismaClient({ adapter });
  });

  after(async () => {
    await db.$disconnect();
    await pglite.close();
  });

  describe('Project', () => {
    it('creates a project and retrieves by rootPath', async () => {
      const project = await db.project.create({
        data: { name: 'test-project', rootPath: '/tmp/test' },
      });

      const found = await db.project.findUnique({
        where: { rootPath: '/tmp/test' },
      });

      assert.equal(found?.id, project.id);
      assert.equal(found?.name, 'test-project');
    });

    it('enforces unique rootPath constraint', async () => {
      await db.project.create({
        data: { name: 'p1', rootPath: '/unique/path' },
      });

      await assert.rejects(
        () => db.project.create({
          data: { name: 'p2', rootPath: '/unique/path' },
        }),
        /unique/i,
      );
    });
  });

  describe('Scan lifecycle', () => {
    it('creates a scan linked to a project', async () => {
      const project = await db.project.create({
        data: { name: 'scan-test', rootPath: '/tmp/scan-test' },
      });

      const scan = await db.scan.create({
        data: {
          projectId: project.id,
          sourceDir: '/tmp/scan-test/src',
          status: 'RUNNING',
        },
      });

      assert.equal(scan.projectId, project.id);
      assert.equal(scan.status, 'RUNNING');
    });

    it('updates scan status on completion', async () => {
      // Create scan, update to COMPLETED, verify
    });
  });

  describe('Finding cascade', () => {
    it('deletes findings when scan is deleted', async () => {
      // Create project -> scan -> findings
      // Delete scan
      // Verify findings are gone (onDelete: Cascade)
    });
  });

  describe('Migration runner', () => {
    it('applies migrations idempotently', async () => {
      const freshPglite = new PGlite();

      // Run migrations twice -- should not throw
      await runMigrations(freshPglite);
      await runMigrations(freshPglite);

      // Verify tracking table shows each migration applied once
      const result = await freshPglite.query(
        'SELECT COUNT(*) as count FROM _ash_migrations',
      );
      assert.ok(Number(result.rows[0].count) > 0);

      await freshPglite.close();
    });
  });
});
```

### 6.4 Running Database Tests

Database tests use PGLite (WASM) but don't need VS Code APIs. They run in the plain Node.js Mocha runner alongside SARIF parser tests:

```yaml
# .mocharc.yaml -- covers both unit and database integration tests
spec: "out/test/unit/**/*.test.js"
timeout: 10000  # PGLite WASM init can take a moment
```

The PGLite initialization (~200ms) is fast enough to run in the unit test suite. If it becomes slow, use `before()` at the suite level (not per-test).

### 6.5 Fallback: SQLite Testing

If PGLite proves unreliable (per the technical design's risk assessment), the same test structure works with `better-sqlite3`. The only changes:

- Replace `PGlite` constructor with `better-sqlite3` open
- Remove `prisma-pglite` adapter (Prisma has native SQLite support)
- Adjust SQL dialect in any raw queries

This is another reason PGLite integration tests are high-value -- they serve as the decision point for the technology choice documented in the technical design.

---

## 7. Extension Integration Tests (VS Code Electron)

### 7.1 What Extension Tests Validate

Extension tests run inside a real VS Code instance. They validate:

- Extension activates without errors
- Commands register correctly
- Tree view providers return expected items
- WebView provider creates valid HTML
- Configuration settings are read correctly
- Diagnostics appear in the problems panel (future)

### 7.2 Current Setup

The existing `.vscode-test.mjs` and `@vscode/test-cli` + `@vscode/test-electron` setup is correct for extension tests. The configuration:

```javascript
// .vscode-test.mjs
import { defineConfig } from '@vscode/test-cli';

export default defineConfig({
  files: 'out/test/integration/**/*.test.js',
  // Optionally specify VS Code version:
  // version: 'stable',
  // Optionally specify workspace:
  // workspaceFolder: './test-workspace',
});
```

Note: Update the `files` glob from `out/test/**/*.test.js` to `out/test/integration/**/*.test.js` to separate from unit tests.

### 7.3 Practical Extension Test Examples

```typescript
// src/test/integration/extension.test.ts
import * as assert from 'assert';
import * as vscode from 'vscode';

suite('Extension Integration', () => {
  test('extension activates', async () => {
    const ext = vscode.extensions.getExtension('ash-workbench');
    assert.ok(ext);
    await ext.activate();
    assert.strictEqual(ext.isActive, true);
  });

  test('commands are registered', async () => {
    const commands = await vscode.commands.getCommands(true);
    assert.ok(commands.includes('ashWorkbench.startScan'));
    assert.ok(commands.includes('ashWorkbench.openWorkbench'));
  });

  test('scan history tree view is registered', () => {
    // Tree views are harder to test directly
    // Verify the view container exists via the extension manifest
    const ext = vscode.extensions.getExtension('ash-workbench');
    const views = ext?.packageJSON?.contributes?.views?.ashWorkbench;
    assert.ok(views?.some((v: any) => v.id === 'ashWorkbench.scanHistory'));
  });
});
```

### 7.4 Value Assessment for POC

| Test Target | Value | Effort | Verdict |
|-------------|-------|--------|---------|
| Extension activation | Medium | Low | Include -- catches import/init errors |
| Command registration | Low | Low | Include -- trivial to write |
| Tree view data | Medium | Medium | Defer -- tested implicitly by manual testing |
| WebView content | Low | High | Defer -- too brittle, manual test instead |
| Full scan-to-findings flow | High | Very High | Defer -- requires ASH CLI installed in CI |

**Recommendation for POC:** Write 2-3 basic extension tests (activation, command registration). Defer complex integration tests. The unit tests for SARIF parsing and database are far higher value.

---

## 8. E2E Testing

### 8.1 What E2E Means for a VS Code Extension

True end-to-end testing for the ASH Workbench would mean:

1. Launch VS Code with the extension installed
2. Open a workspace with scannable code
3. Trigger a scan (which runs the real ASH CLI)
4. Wait for scan completion
5. Verify findings appear in the WebView
6. Interact with the WebView (filter, triage)
7. Verify data persisted to PGLite

### 8.2 Why E2E Is Impractical for POC

| Challenge | Impact |
|-----------|--------|
| Requires ASH CLI installed in CI | Complex setup, Python environment in Node.js CI runner |
| Scan execution takes 30-120 seconds | Extremely slow test suite |
| WebView testing requires DOM interaction | `@vscode/test-electron` can't easily interact with WebView content |
| PGLite WASM in Electron has untested behavior | May work differently than in plain Node.js |
| Flaky by nature | Process spawning, file system, timing issues |

### 8.3 Pragmatic Alternative: Smoke Testing

Instead of automated E2E tests, use a **manual smoke test checklist** during development:

```markdown
## Smoke Test Checklist

### Extension Activation
- [ ] Extension activates when opening the ASH Workbench sidebar
- [ ] No errors in the Developer Tools console
- [ ] Database initializes (check Output channel)

### Scan Execution
- [ ] "ASH: Start Scan" command appears in command palette
- [ ] Scan starts and shows progress
- [ ] Scan completes and findings appear
- [ ] Scan can be cancelled mid-execution
- [ ] Failed scan shows error message

### Finding Display
- [ ] Findings list shows after scan completion
- [ ] Findings can be filtered by severity
- [ ] Clicking a finding shows detail view
- [ ] "Navigate to code" opens the correct file at the correct line

### Finding Triage
- [ ] Disposition can be set (Fix, Suppress, Defer)
- [ ] Disposition persists after closing and reopening the panel
- [ ] Summary counts update when disposition changes

### Scan History
- [ ] Past scans appear in the sidebar tree
- [ ] Selecting a past scan loads its findings
- [ ] Deleting a scan removes it and its findings
```

This checklist is more practical than automated E2E tests for a POC and catches the same class of issues.

### 8.4 Future E2E Considerations

If automated E2E testing becomes worthwhile post-POC:

- **Playwright** can interact with Electron apps (VS Code is Electron). The `@vscode/test-electron` team has discussed Playwright integration but it's not official.
- **VS Code's built-in test runner** supports `workspaceFolder` configuration for setting up test workspaces with known content.
- **Docker-based CI** could provide ASH CLI + Python environment alongside the Node.js test runner.

These are complex, high-effort investments that are not justified during POC.

---

## 9. Code Coverage

### 9.1 Coverage for Unit Tests

**c8** is the recommended coverage tool for Node.js (based on V8's built-in coverage, zero instrumentation overhead):

```bash
npm install --save-dev c8
```

```json
{
  "scripts": {
    "test:unit": "c8 mocha",
    "test:unit:coverage": "c8 --reporter=text --reporter=html mocha"
  }
}
```

**c8 configuration (in `package.json` or `.c8rc.json`):**

```json
{
  "c8": {
    "include": ["out/services/**", "out/models/**"],
    "exclude": ["out/test/**"],
    "reporter": ["text", "html"],
    "report-dir": "test-results/coverage"
  }
}
```

### 9.2 Coverage Threshold

The parent ASH project uses 60% minimum coverage. For the workbench POC:

- **Don't enforce a coverage threshold initially** -- During rapid development, coverage gates slow down iteration without proportional quality improvement.
- **Track coverage, don't gate on it** -- Generate reports to see what's tested, but don't fail builds on percentage.
- **Set a threshold when the codebase stabilizes** -- After Phase 2 (scan execution working), set a threshold on the critical modules (SARIF parser, database service). 80% on `services/sarif.ts` is more valuable than 60% across the whole codebase.

### 9.3 What to Cover vs. What Not to Cover

| Module | Cover? | Rationale |
|--------|--------|-----------|
| `services/sarif.ts` | **Yes** (target 90%) | Pure logic, many edge cases, highest-risk module |
| `services/database.ts` | **Yes** (target 80%) | Migration runner and query helpers |
| `services/scanner.ts` | **Yes** (target 70%) | Process lifecycle branching |
| `extension.ts` | **No** | Glue code, tested by extension integration tests |
| `providers/*.ts` | **No** | VS Code API wrappers, tested manually |
| `commands/*.ts` | **Minimal** | Thin wrappers that delegate to services |
| `models/*.ts` | **No** | Type definitions, no runtime logic |

---

## 10. CI/CD Pipeline

### 10.1 Recommended GitHub Actions Workflow

A CI workflow for the workbench that aligns with the parent project's patterns:

```yaml
# .github/workflows/workbench-quality.yml
name: Workbench - Lint & Test

on:
  push:
    branches: ['!main']
    paths: ['workbench/vsix/**']
  pull_request:
    branches: ['*']
    paths: ['workbench/vsix/**']

permissions:
  contents: read

jobs:
  lint-and-test:
    name: Lint & Unit Test
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '22'
          cache: 'npm'
          cache-dependency-path: workbench/vsix/package-lock.json

      - name: Install dependencies
        working-directory: workbench/vsix
        run: npm ci

      - name: Compile
        working-directory: workbench/vsix
        run: npm run compile

      - name: Lint
        working-directory: workbench/vsix
        run: npm run lint

      - name: Format check
        working-directory: workbench/vsix
        run: npx prettier --check "src/**/*.ts"

      - name: Unit tests
        working-directory: workbench/vsix
        run: npm run test:unit

  extension-test:
    name: Extension Integration Test
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '22'
          cache: 'npm'
          cache-dependency-path: workbench/vsix/package-lock.json

      - name: Install dependencies
        working-directory: workbench/vsix
        run: npm ci

      - name: Compile
        working-directory: workbench/vsix
        run: npm run compile

      - name: Extension tests
        working-directory: workbench/vsix
        run: xvfb-run -a npm run test:integration
```

**Key points:**

- **Path filter** (`paths: ['workbench/vsix/**']`) -- Only runs when extension code changes, not on docs changes
- **Two jobs** -- Lint/unit tests are fast and run first. Extension tests require `xvfb-run` for headless VS Code on Linux.
- **`xvfb-run`** -- Required for `@vscode/test-electron` on Linux CI (VS Code needs a display server). No additional install needed on `ubuntu-latest`.

### 10.2 CI Priority

For POC, the CI workflow is **nice to have but not blocking**. The single developer is running tests locally. CI becomes valuable when:
- Multiple contributors exist
- PRs are opened against the feature branch
- The extension is published and releases need gating

**Recommendation:** Create the workflow file early (it's just a YAML file), but don't block on making it green. Focus on local quality tooling first.

---

## 11. Pre-Commit Hooks

### 11.1 Options

| Tool | Approach | Tradeoff |
|------|----------|----------|
| **lint-staged + husky** | Git hooks that run lint/format on staged files only | Fast (only changed files), but requires two npm packages |
| **lefthook** | Single binary, YAML config, no npm dependency | Faster than husky, but less common in JS ecosystem |
| **pre-commit** (Python) | Parent project already uses this | Requires Python runtime, overkill for JS-only hooks |

### 11.2 Recommended: lint-staged + husky

```bash
cd vsix
npm install --save-dev husky lint-staged
npx husky init
```

**`.husky/pre-commit`:**

```bash
cd vsix && npx lint-staged
```

**`vsix/package.json` (add `lint-staged` config):**

```json
{
  "lint-staged": {
    "src/**/*.ts": [
      "prettier --write",
      "eslint --fix"
    ]
  }
}
```

This runs Prettier and ESLint auto-fix on staged TypeScript files before each commit. Fast (only staged files) and catches formatting/lint issues before they reach the repository.

### 11.3 Value Assessment

| Item | Effort | Value | Verdict |
|------|--------|-------|---------|
| lint-staged + husky | 15 min | Medium -- prevents bad commits | Implement in Phase 2 |
| Pre-commit unit tests | 5 min | Low -- tests are slow for pre-commit | Skip (run in CI instead) |

---

## 12. WebView Quality (Future Reference)

The `webview/` package doesn't exist yet. When it's created with Vite + React, the quality story differs:

| Tool | Recommendation | Rationale |
|------|----------------|-----------|
| **Test framework** | vitest | Native Vite integration, fast, ESM-first |
| **Component testing** | React Testing Library + vitest | Test behavior, not implementation |
| **Linting** | ESLint with `eslint-plugin-react-hooks` | Catches hook rule violations |
| **Formatting** | Prettier (shared config with vsix) | Consistency across packages |
| **Type checking** | `tsc --noEmit` | Vite doesn't type-check during builds |

WebView tests would cover:
- Component rendering with mock data
- User interactions (filter clicks, disposition buttons)
- Message protocol encoding (verify messages sent to extension host)

These tests run in Node.js (jsdom environment) and are fast. They do NOT require VS Code.

---

## 13. Recommended Implementation Plan

### Phase 1: Immediate (Before Writing Application Code)

Set up the foundational quality tooling so all new code benefits from the start.

1. **Enable TypeScript additional checks** -- Uncomment `noImplicitReturns`, `noFallthroughCasesInSwitch`, add `noUnusedLocals` and `noUnusedParameters` in `tsconfig.json`
2. **Upgrade ESLint to `recommended` preset** -- Replace the 5-rule config with `tseslint.configs.recommended`, upgrade rules from `warn` to `error`
3. **Add Prettier** -- Install, configure, add `format` and `format:check` npm scripts, add `eslint-config-prettier`
4. **Create test directory structure** -- Set up `src/test/unit/`, `src/test/integration/`, `src/test/fixtures/`
5. **Add Mocha config for unit tests** -- Create `.mocharc.yaml`, add `test:unit` npm script separate from `test:integration`
6. **Create SARIF factory** -- Build `src/test/fixtures/sarif-factory.ts` for generating test data

### Phase 2: With Scan Execution (Technical Design Phase 2)

Add tests as modules are built. This is when the highest-value tests get written.

1. **SARIF parser unit tests** -- Full test coverage for `parseSarif()` and `extractSeverity()` using factory-generated data
2. **PGLite integration tests** -- Validate schema, migrations, CRUD operations, and cascade deletes with in-memory PGLite
3. **Scanner service unit tests** -- Mock `child_process.spawn`, test process lifecycle (exit codes, cancel, timeout)
4. **Add type-checked ESLint rules** -- Enable `recommendedTypeChecked` now that async services exist and `no-floating-promises` is valuable

### Phase 3: Stabilization (Technical Design Phase 4)

Add infrastructure quality tooling once the codebase is stable enough to benefit.

1. **Coverage reporting** -- Add c8, configure per-module thresholds for critical services
2. **Pre-commit hooks** -- Add lint-staged + husky for format/lint on commit
3. **CI pipeline** -- Create GitHub Actions workflow for lint + unit tests + extension tests
4. **Extension integration tests** -- Write 2-3 basic tests for activation and command registration

---

## 14. Key Takeaways

1. **Separate test runtimes.** Unit tests (SARIF parser, database, scanner mock) run in plain Node.js with Mocha. Extension tests (activation, commands) run in VS Code Electron. Don't mix them -- the speed difference is 100x.

2. **SARIF parser tests are the highest-value investment.** The entire extension's correctness depends on accurately parsing ASH's SARIF output. Use factory functions to generate edge cases. Target 90% coverage.

3. **PGLite integration tests double as a technology validation.** They prove the PGLite + Prisma stack works before building features on it. If tests fail, that's the signal to switch to SQLite.

4. **Prettier + ESLint recommended preset are the highest-ROI lint changes.** Together they take 45 minutes to set up and catch real bugs + eliminate formatting noise permanently.

5. **E2E tests are not worth the investment for POC.** A manual smoke test checklist covers the same scenarios with 1% of the effort. Automated E2E testing is a post-POC concern.

6. **Design for testability from the start.** Keep `vscode` imports out of core logic modules. Pass dependencies as parameters. This is already reflected in the technical design's service architecture -- just follow through on it.

7. **Align with parent project patterns where applicable.** Use test markers/categories (unit, integration), generate JUnit XML for CI reporting, track coverage without hard-gating during POC.
